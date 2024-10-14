import OpenAI from 'openai';
import { debugPrint, mergeChunk, functionToJson } from './util.js';
import { Agent, Response, Result } from './types.js';

const __CTX_VARS_NAME__ = "context_variables";

export class Swarm {
  constructor(client = null) {
    this.openai = client || new OpenAI();
  }

  async getChatCompletion(agent, history, contextVariables, modelOverride, stream, debug) {
    const instructions = typeof agent.instructions === 'function' 
      ? agent.instructions(contextVariables) 
      : agent.instructions;

    const messages = [{ role: 'system', content: instructions }, ...history];
    debugPrint(debug, "Getting chat completion for...:", messages);

    const tools = agent.functions.map(f => functionToJson(f));
    // Hide context_variables from model
    for (const tool of tools) {
      const params = tool.function.parameters;
      delete params.properties[__CTX_VARS_NAME__];
      if (params.required) {
        params.required = params.required.filter(param => param !== __CTX_VARS_NAME__);
      }
    }

    const createParams = {
      model: modelOverride || agent.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: agent.toolChoice,
      stream
    };

    if (tools.length > 0) {
      // Ensure agent.parallelToolCalls is a boolean
      createParams.parallel_tool_calls = Boolean(agent.parallelToolCalls);
      debugPrint(debug, `Setting parallel_tool_calls to: ${createParams.parallel_tool_calls}`);
    }

    return this.openai.chat.completions.create(createParams);
  }

  handleFunctionResult(result, debug) {
    if (result instanceof Result) {
      return result;
    } else if (result instanceof Agent) {
      return new Result({
        value: JSON.stringify({ assistant: result.name }),
        agent: result
      });
    } else {
      try {
        return new Result({ value: String(result) });
      } catch (e) {
        const errorMessage = `Failed to cast response to string: ${result}. Make sure agent functions return a string or Result object. Error: ${e.message}`;
        debugPrint(debug, errorMessage);
        throw new TypeError(errorMessage);
      }
    }
  }

  async handleToolCalls(toolCalls, functions, contextVariables, debug) {
    const functionMap = Object.fromEntries(functions.map(f => [f.name, f.function]));
    const partialResponse = new Response();

    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;
      if (!(name in functionMap)) {
        debugPrint(debug, `Tool ${name} not found in function map.`);
        partialResponse.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          tool_name: name,
          content: `Error: Tool ${name} not found.`
        });
        continue;
      }

      const args = JSON.parse(toolCall.function.arguments);
      debugPrint(debug, `Processing tool call: ${name} with arguments ${JSON.stringify(args)}`);

      const func = functionMap[name];
      if (typeof func !== 'function') {
        const errorMessage = `Error: ${name} is not a function.`;
        debugPrint(debug, errorMessage);
        partialResponse.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          tool_name: name,
          content: errorMessage
        });
        continue;
      }

      if (func.length > 0 && func.toString().includes(__CTX_VARS_NAME__)) {
        args[__CTX_VARS_NAME__] = contextVariables;
      }

      try {
        const rawResult = await func(args);
        const result = this.handleFunctionResult(rawResult, debug);

        partialResponse.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          tool_name: name,
          content: result.value
        });

        partialResponse.contextVariables = { ...partialResponse.contextVariables, ...result.contextVariables };
        if (result.agent) {
          partialResponse.agent = result.agent;
        }
      } catch (error) {
        const errorMessage = `Error executing ${name}: ${error.message}`;
        debugPrint(debug, errorMessage);
        partialResponse.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          tool_name: name,
          content: errorMessage
        });
      }
    }

    return partialResponse;
  }

  async run({ agent, messages, contextVariables = {}, modelOverride = null, stream = false, debug = false, maxTurns = Infinity, executeTools = true }) {
    if (stream) {
      return this.runAndStream({ agent, messages, contextVariables, modelOverride, debug, maxTurns, executeTools });
    }

    let activeAgent = agent;
    let history = [...messages];
    const initLen = messages.length;

    while (history.length - initLen < maxTurns && activeAgent) {
      const completion = await this.getChatCompletion(
        activeAgent,
        history,
        contextVariables,
        modelOverride,
        stream,
        debug
      );

      const message = completion.choices[0].message;
      debugPrint(debug, "Received completion:", message);
      message.sender = activeAgent.name;
      history.push(JSON.parse(JSON.stringify(message)));

      if (!message.tool_calls || !executeTools) {
        debugPrint(debug, "Ending turn.");
        break;
      }

      const partialResponse = await this.handleToolCalls(
        message.tool_calls,
        activeAgent.functions,
        contextVariables,
        debug
      );

      history.push(...partialResponse.messages);
      contextVariables = { ...contextVariables, ...partialResponse.contextVariables };
      if (partialResponse.agent) {
        activeAgent = partialResponse.agent;
      }
    }

    return new Response({
      messages: history.slice(initLen),
      agent: activeAgent,
      contextVariables
    });
  }

  async *runAndStream({ agent, messages, contextVariables = {}, modelOverride = null, debug = false, maxTurns = Infinity, executeTools = true }) {
    let activeAgent = agent;
    let history = [...messages];
    const initLen = messages.length;

    while (history.length - initLen < maxTurns) {
      let message = {
        content: "",
        sender: agent.name,
        role: "assistant",
        function_call: null,
        tool_calls: {}
      };

      const completion = await this.getChatCompletion(
        activeAgent,
        history,
        contextVariables,
        modelOverride,
        true,
        debug
      );

      yield { delim: "start" };
      for await (const chunk of completion) {
        const delta = chunk.choices[0].delta;
        if (delta.role === "assistant") {
          delta.sender = activeAgent.name;
        }
        yield delta;
        mergeChunk(message, delta);
      }
      yield { delim: "end" };

      message.tool_calls = Object.values(message.tool_calls);
      if (message.tool_calls.length === 0) {
        message.tool_calls = null;
      }
      debugPrint(debug, "Received completion:", message);
      history.push(message);

      if (!message.tool_calls || !executeTools) {
        debugPrint(debug, "Ending turn.");
        break;
      }

      const partialResponse = await this.handleToolCalls(
        message.tool_calls,
        activeAgent.functions,
        contextVariables,
        debug
      );

      history.push(...partialResponse.messages);
      contextVariables = { ...contextVariables, ...partialResponse.contextVariables };
      if (partialResponse.agent) {
        activeAgent = partialResponse.agent;
      }
    }

    yield {
      response: new Response({
        messages: history.slice(initLen),
        agent: activeAgent,
        contextVariables
      })
    };
  }
}

export { Result, Response };
