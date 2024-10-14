import { createSwarm, Agent, Result } from './src/swarm.js';

// Define an agent with custom functions (tools)
const mathAgent = new Agent({
  name: 'MathAgent',
  model: 'gpt-4o', // Use a model version that supports function calling
  instructions: 'You are a helpful assistant that can perform mathematical operations.',
  functions: [
    {
      name: 'addNumbers',
      description: 'Adds two numbers and returns the result.',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number to add' },
          b: { type: 'number', description: 'Second number to add' },
        },
        required: ['a', 'b'],
      },
      function: ({ a, b }) => {
        const sum = a + b;
        return new Result({ value: `The sum of ${a} and ${b} is ${sum}.` });
      },
    },
    {
      name: 'multiplyNumbers',
      description: 'Multiplies two numbers and returns the result.',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number to multiply' },
          b: { type: 'number', description: 'Second number to multiply' },
        },
        required: ['a', 'b'],
      },
      function: ({ a, b }) => {
        const product = a * b;
        return new Result({ value: `The product of ${a} and ${b} is ${product}.` });
      },
    },
  ],
});

// ... rest of your code remains unchanged
