import readline from 'readline';
import { Swarm } from './swarm.js';
import chalk from 'chalk';

function processAndPrintStreamingResponse(response) {
  let content = "";
  let lastSender = "";

  return new Promise((resolve) => {
    (async () => {
      for await (const chunk of response) {
        if (chunk.sender) {
          lastSender = chunk.sender;
        }

        if (chunk.content != null) {
          if (!content && lastSender) {
            process.stdout.write(chalk.blue(`${lastSender}: `));
            lastSender = "";
          }
          process.stdout.write(chunk.content);
          content += chunk.content;
        }

        if (chunk.tool_calls != null) {
          for (const toolCall of chunk.tool_calls) {
            const f = toolCall.function;
            const name = f.name;
            if (!name) continue;
            console.log(chalk.blue(`${lastSender}: `) + chalk.magenta(`${name}()`));
          }
        }

        if (chunk.delim === "end" && content) {
          console.log(); // End of response message
          content = "";
        }

        if (chunk.response) {
          resolve(chunk.response);
        }
      }
    })();
  });
}

function prettyPrintMessages(messages) {
  for (const message of messages) {
    if (message.role !== "assistant") continue;

    // print agent name in blue
    process.stdout.write(chalk.blue(`${message.sender}: `));

    // print response, if any
    if (message.content) {
      console.log(message.content);
    }

    // print tool calls in purple, if any
    const toolCalls = message.tool_calls || [];
    if (toolCalls.length > 1) {
      console.log();
    }
    for (const toolCall of toolCalls) {
      const f = toolCall.function;
      const { name, arguments: args } = f;
      const argStr = JSON.stringify(JSON.parse(args)).replace(/:/g, "=");
      console.log(chalk.magenta(`${name}`) + `(${argStr.slice(1, -1)})`);
    }
  }
}

async function runDemoLoop(startingAgent, contextVariables = {}, stream = false, debug = false) {
  const client = new Swarm();
  console.log("Starting Swarm CLI 🐝");

  const messages = [];
  let agent = startingAgent;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const userInput = await new Promise((resolve) => {
      rl.question(chalk.gray("User: "), resolve);
    });

    messages.push({ role: "user", content: userInput });

    const response = await client.run({
      agent,
      messages,
      contextVariables,
      stream,
      debug,
    });

    if (stream) {
      const processedResponse = await processAndPrintStreamingResponse(response);
      messages.push(...processedResponse.messages);
      agent = processedResponse.agent;
    } else {
      prettyPrintMessages(response.messages);
      messages.push(...response.messages);
      agent = response.agent;
    }
  }
}

export { runDemoLoop };