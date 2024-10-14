import 'dotenv/config';
import { createSwarm, Result } from './src/swarm.js';
import { Agent } from './src/types.js';

// Define an agent with custom functions (tools)
const mathAgent = new Agent({
  name: 'MathAgent',
  model: 'gpt-4',
  instructions: 'You are a helpful assistant that can perform mathematical operations.',
  functions: [
    {
      name: 'addNumbers',
      description: 'Returns the sum of two numbers and an explanation of how the result was calculated.',
      parameters: {
        type: 'object',
        properties: {
          a: {
            type: 'number',
            description: 'The first number to add.',
          },
          b: {
            type: 'number',
            description: 'The second number to add.',
          },
        },
        required: ['a', 'b'],
      },
      function: ({ a, b }) => {
        const sum = a + b;
        return new Result({
          answer: sum.toString(),
          explanation: `Added ${a} and ${b} to get ${sum}.`,
        });
      },
    },
    {
      name: 'multiplyNumbers',
      description: 'Returns the product of two numbers and an explanation of how the result was calculated.',
      parameters: {
        type: 'object',
        properties: {
          a: {
            type: 'number',
            description: 'The first number to multiply.',
          },
          b: {
            type: 'number',
            description: 'The second number to multiply.',
          },
        },
        required: ['a', 'b'],
      },
      function: ({ a, b }) => {
        const product = a * b;
        return new Result({
          answer: product.toString(),
          explanation: `Multiplied ${a} by ${b} to get ${product}.`,
        });
      },
    },
  ],
});

// Initialize the swarm instance
const swarm = createSwarm();

// Define the initial conversation
const messages = [
  { role: 'user', content: 'Can you multiply two numbers, 5 and 7, for me?' },
];

// Run the agent
(async () => {
  try {
    const response = await swarm.run({
      agent: mathAgent,
      messages,
      debug: true,
    });

    // Output the assistant's response
    for (const message of response.messages) {
      console.log(`${message.role}: ${message.content || ''}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
})();
