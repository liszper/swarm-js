import { z } from 'zod';

// Define AgentFunction type
const AgentFunction = z.function().returns(z.union([z.string(), z.lazy(() => AgentSchema), z.record(z.any())]));

// Update FunctionSchema to match AgentFunction
const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  function: AgentFunction
});

export const AgentSchema = z.object({
  name: z.string().default('Agent'),
  model: z.string().default('gpt-4'),
  instructions: z.union([z.string(), z.function().returns(z.string())]).default('You are a helpful agent.'),
  functions: z.array(FunctionSchema).default([]),
  toolChoice: z.string().nullable().default(null),
  parallelToolCalls: z.boolean().default(true)
});

export const ResponseSchema = z.object({
  messages: z.array(z.any()).default([]),
  agent: AgentSchema.nullable().default(null),
  contextVariables: z.record(z.any()).default({})
});

export const ResultSchema = z.object({
  value: z.string().default(''),
  agent: AgentSchema.nullable().default(null),
  contextVariables: z.record(z.any()).default({})
});

export class Agent {
  constructor(data) {
    const parsedData = AgentSchema.parse(data);
    Object.assign(this, parsedData);
  }
}

export class Response {
  constructor(data = {}) {
    Object.assign(this, ResponseSchema.parse(data));
  }
}

export class Result {
  constructor({ value, contextVariables = {}, agent = null }) {
    this.value = value;
    this.contextVariables = contextVariables;
    this.agent = agent;
  }
}
