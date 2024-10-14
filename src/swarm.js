import { OpenAI } from 'openai';
import { debugPrint, mergeChunk } from './util.js';
import { Response, Result, Agent } from './types.js';

const createOpenAIClient = (client = null) => client || new OpenAI();

const createChatCompletionParams = (agent, history, contextVariables, modelOverride, stream) => {
  const instructions = typeof agent.instructions === 'function' 
    ? agent.instructions(contextVariables) 
    : agent.instructions;

  const messages = [{ role: 'system', content: instructions }, ...history];
  const tools = agent.functions.map(f => ({
    type: 'function',
    function: {
      name: f.name,
      description: f.description,
      parameters: f.function.length > 0 ? { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } : {}
    }
  }));

  return {
    model: modelOverride || agent.model,
    messages,
    tools: tools.length ? tools : undefined,
    stream
  };
};

const getChatCompletion = async (openai, agent, history, contextVariables, modelOverride, stream, debug) => {
  debugPrint(debug, `Getting chat completion for agent: ${agent.name}`);
  const params = createChatCompletionParams(agent, history, contextVariables, modelOverride, stream);
  debugPrint(debug, `Chat completion parameters: ${JSON.stringify(params, null, 2)}`);
  return openai.chat.completions.create(params);
};

const handleFunctionResult = (result, debug) => {
  debugPrint(debug, `Handling function result: ${JSON.stringify(result)}`);
  if (result instanceof Result) {
    return result;
  }
  if (result instanceof Agent) {
    return new Result({ value: JSON.stringify({ assistant: result.name }), agent: result });
  }
  return new Result({ value: String(result) });
};

const handleToolCalls = async (toolCalls, agent, contextVariables, debug) => {
  debugPrint(debug, `Handling ${toolCalls.length} tool calls for agent: ${agent.name}`);
  const partialResponse = new Response();

  for (const toolCall of toolCalls) {
    const name = toolCall.function.name;
    debugPrint(debug, `Processing tool call: ${name}`);
    const func = agent.functions.find(f => f.name === name)?.function;

    if (!func) {
      partialResponse.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `Error: Tool ${name} not found.` });
      continue;
    }

    let args;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      partialResponse.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `Error: Invalid arguments for ${name}.` });
      continue;
    }

    try {
      debugPrint(debug, `Executing function ${name} with args: ${JSON.stringify(args)}`);
      const rawResult = await func(args);
      const result = handleFunctionResult(rawResult, debug);
      partialResponse.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result.value });
      Object.assign(partialResponse.contextVariables, result.contextVariables);
      if (result.agent) {
        partialResponse.agent = result.agent;
      }
    } catch (error) {
      partialResponse.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `Error executing ${name}: ${error.message}` });
    }
  }

  return partialResponse;
};

const run = async ({ openai, agent, messages, contextVariables = {}, modelOverride = null, stream = false, debug = false, maxTurns = Infinity, executeTools = true }) => {
  debugPrint(debug, `Starting run with agent: ${agent.name}`);

  if (stream) {
    return runAndStream({ openai, agent, messages, contextVariables, modelOverride, debug, maxTurns, executeTools });
  }

  let activeAgent = agent;
  let history = [...messages];

  while (history.length - messages.length < maxTurns && activeAgent) {
    const completion = await getChatCompletion(openai, activeAgent, history, contextVariables, modelOverride, false, debug);
    const message = { ...completion.choices[0].message, sender: activeAgent.name };
    history.push(message);

    if (!message.tool_calls || !executeTools) {
      break;
    }

    const partialResponse = await handleToolCalls(message.tool_calls, activeAgent, contextVariables, debug);
    history.push(...partialResponse.messages);
    Object.assign(contextVariables, partialResponse.contextVariables);
    if (partialResponse.agent) {
      activeAgent = partialResponse.agent;
    }
  }

  return new Response({ messages: history.slice(messages.length), agent: activeAgent, contextVariables });
};

const runAndStream = async function* ({ openai, agent, messages, contextVariables = {}, modelOverride = null, debug = false, maxTurns = Infinity, executeTools = true }) {
  debugPrint(debug, `Starting streaming run with agent: ${agent.name}`);

  let activeAgent = agent;
  let history = [...messages];

  while (history.length - messages.length < maxTurns) {
    let message = { content: "", sender: agent.name, role: "assistant", function_call: null };

    const completion = await getChatCompletion(openai, activeAgent, history, contextVariables, modelOverride, true, debug);

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

    history.push(message);

    if (!message.function_call || !executeTools) {
      break;
    }

    const partialResponse = await handleToolCalls([message.function_call], activeAgent, contextVariables, debug);
    history.push(...partialResponse.messages);
    Object.assign(contextVariables, partialResponse.contextVariables);
    if (partialResponse.agent) {
      activeAgent = partialResponse.agent;
    }
  }

  yield { response: new Response({ messages: history.slice(messages.length), agent: activeAgent, contextVariables }) };
};

export const createSwarm = (client = null) => {
  const openai = createOpenAIClient(client);
  return {
    run: (params) => run({ ...params, openai }),
    runAndStream: (params) => runAndStream({ ...params, openai })
  };
};

export { Result, Response };
