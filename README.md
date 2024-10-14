# Swarm (JavaScript Version)

An educational framework exploring ergonomic, lightweight multi-agent orchestration, now implemented in JavaScript.

> [!WARNING]
> Swarm is currently an experimental sample framework intended to explore ergonomic interfaces for multi-agent systems. It is not intended to be used in production, and therefore has no official support.
>
> The primary goal of Swarm is to showcase the handoff & routines patterns explored in agent orchestration. It is not meant as a standalone library, and is primarily for educational purposes.

## Install

Requires Node.js 14+

```shell
bun i && bun run
```

## Usage

```javascript
import { Swarm, Agent, Result } from 'swarm-nodejs';

const client = new Swarm();

const transferToAgentB = () => {
    return agentB;
};

const agentA = new Agent({
    name: "Agent A",
    instructions: "You are a helpful agent.",
    functions: [
        {
            name: "transferToAgentB",
            description: "Transfer to Agent B",
            function: transferToAgentB
        }
    ]
});

const agentB = new Agent({
    name: "Agent B",
    instructions: "Only speak in Haikus.",
});

async function run() {
    const response = await client.run({
        agent: agentA,
        messages: [{ role: "user", content: "I want to talk to agent B." }],
    });

    console.log(response.messages[response.messages.length - 1].content);
}

run();
```

```
Hope glimmers brightly,
New paths converge gracefully,
What can I assist?
```

## Table of Contents

- [Overview](#overview)
- [Documentation](#documentation)
  - [Running Swarm](#running-swarm)
  - [Agents](#agents)
  - [Functions](#functions)
  - [Streaming](#streaming)

# Overview

Swarm focuses on making agent coordination and execution lightweight, highly controllable, and easily testable.

It accomplishes this through two primitive abstractions: Agents and handoffs. An Agent encompasses instructions and functions, and can at any point choose to hand off a conversation to another Agent.

These primitives are powerful enough to express rich dynamics between tools and networks of agents, allowing you to build scalable, real-world solutions while avoiding a steep learning curve.

# Documentation

## Running Swarm

Start by instantiating a Swarm client:

```javascript
import { Swarm } from 'swarm-nodejs';

const client = new Swarm();
```

### `client.run()`

Swarm's `run()` function is analogous to the `chat.completions.create()` function in the OpenAI API – it takes messages and returns messages and saves no state between calls. It also handles Agent function execution, hand-offs, context variable references, and can take multiple turns before returning to the user.

#### Arguments

| Argument | Type | Description | Default |
|----------|------|-------------|---------|
| **agent** | `Agent` | The (initial) agent to be called. | (required) |
| **messages** | `Array` | An array of message objects, similar to OpenAI API messages | (required) |
| **contextVariables** | `Object` | An object of additional context variables, available to functions and Agent instructions | `{}` |
| **maxTurns** | `Number` | The maximum number of conversational turns allowed | `Infinity` |
| **modelOverride** | `String` | An optional string to override the model being used by an Agent | `null` |
| **executeTools** | `Boolean` | If false, interrupt execution and immediately returns tool_calls message when an Agent tries to call a function | `true` |
| **stream** | `Boolean` | If true, enables streaming responses | `false` |
| **debug** | `Boolean` | If true, enables debug logging | `false` |

The `run()` method returns a `Response` object containing all the relevant updated state.

#### `Response` Fields

| Field | Type | Description |
|-------|------|-------------|
| **messages** | `Array` | An array of message objects generated during the conversation. |
| **agent** | `Agent` | The last agent to handle a message. |
| **contextVariables** | `Object` | The same as the input variables, plus any changes. |

## Agents

An `Agent` encapsulates a set of instructions with a set of functions, and has the capability to hand off execution to another `Agent`.

### `Agent` Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| **name** | `String` | The name of the agent. | `"Agent"` |
| **model** | `String` | The model to be used by the agent. | `"gpt-4"` |
| **instructions** | `String` or `Function` | Instructions for the agent, can be a string or a function returning a string. | `"You are a helpful agent."` |
| **functions** | `Array` | An array of function objects that the agent can call. | `[]` |
| **toolChoice** | `String` | The tool choice for the agent, if any. | `null` |
| **parallelToolCalls** | `Boolean` | Whether to allow parallel tool calls. | `true` |

### Instructions

Agent instructions are directly converted into the system prompt of a conversation. The instructions can be a string or a function that returns a string.

```javascript
const agent = new Agent({
   instructions: "You are a helpful agent."
});
```

Or with a function:

```javascript
const instructions = (contextVariables) => {
   const userName = contextVariables.userName;
   return `Help the user, ${userName}, do whatever they want.`;
};

const agent = new Agent({
   instructions: instructions
});

const response = await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Hi!" }],
   contextVariables: { userName: "John" }
});
console.log(response.messages[response.messages.length - 1].content);
```

## Functions

- Swarm Agents can call JavaScript functions directly.
- Functions should usually return a string or a Result object.
- If a function returns an Agent, execution will be transferred to that Agent.
- Functions can access contextVariables if needed.

```javascript
const greet = ({ contextVariables, language }) => {
   const userName = contextVariables.userName;
   const greeting = language.toLowerCase() === "spanish" ? "Hola" : "Hello";
   console.log(`${greeting}, ${userName}!`);
   return "Done";
};

const agent = new Agent({
   functions: [
      {
         name: "greet",
         description: "Greet the user",
         function: greet
      }
   ]
});

await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Use greet() please." }],
   contextVariables: { userName: "John" }
});
```

### Handoffs and Updating Context Variables

An Agent can hand off to another Agent by returning it in a function.

```javascript
const salesAgent = new Agent({ name: "Sales Agent" });

const transferToSales = () => {
   return new Result({ agent: salesAgent });
};

const agent = new Agent({
   functions: [
      {
         name: "transferToSales",
         description: "Transfer to sales agent",
         function: transferToSales
      }
   ]
});

const response = await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Transfer me to sales." }]
});
console.log(response.agent.name);
```

Functions can also update contextVariables by returning a Result object:

```javascript
const talkToSales = () => {
   console.log("Hello, World!");
   return new Result({
       value: "Done",
       agent: salesAgent,
       contextVariables: { department: "sales" }
   });
};

const agent = new Agent({
   functions: [
      {
         name: "talkToSales",
         description: "Talk to sales",
         function: talkToSales
      }
   ]
});

const response = await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Transfer me to sales" }],
   contextVariables: { userName: "John" }
});
console.log(response.agent.name);
console.log(response.contextVariables);
```

## Streaming

```javascript
const stream = await client.run({
   agent: agent,
   messages: messages,
   stream: true
});

for await (const chunk of stream) {
   console.log(chunk);
}
```

The streaming implementation is similar to the OpenAI API streaming, with two additional event types:

- `{ delim: "start" }` and `{ delim: "end" }`, to signal each time an Agent handles a single message.
- `{ response: Response }` will return a Response object at the end of a stream with the aggregated response.

## Testing

Use Jest for running tests. Example test cases are provided in the `src/swarm.test.js` file.

```shell
npm test
```

## REPL

Use the `runDemoLoop` function to test your swarm interactively. This will run a REPL in your terminal. It supports streaming.

```javascript
import { runDemoLoop } from './src/repl.js';
import { Agent, Result } from './src/types.js';

// Define your agents and run the demo loop
runDemoLoop(yourAgent, {}, true, true);
```

This documentation provides an overview of the JavaScript implementation of Swarm, highlighting its key features and usage patterns. Developers can use this as a guide to understand and work with the Swarm framework in a JavaScript environment.
