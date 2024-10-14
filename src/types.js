import { z } from 'zod';

const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  function: z.function()
});

export const AgentSchema = z.object({
  name: z.string().default('Agent'),
  model: z.string().default('gpt-4'),
  instructions: z.union([z.string(), z.function()]).default('You are a helpful agent.'),
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
  constructor(data) {
    Object.assign(this, ResponseSchema.parse(data));
  }
}

export class Result {
  constructor(data) {
    Object.assign(this, ResultSchema.parse(data));
  }
}