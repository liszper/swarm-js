import 'dotenv/config';
import { Swarm } from './src/swarm.js';
import { runDemoLoop } from './src/repl.js';
import Agent from './src/agent.js';
import { Result } from './src/types.js';

// Example usage
const client = new Swarm();

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);

const salesAgent = new Agent({
  name: 'SalesAgent',
  instructions: 'You are a knowledgeable sales agent. Help the user with their purchase inquiries.',
  functions: []
});

const greetAgent = new Agent({
  name: 'GreetAgent',
  instructions: 'You are a friendly greeting agent. Greet the user and ask how you can help.',
  functions: [
    {
      name: 'transferToSales',
      description: 'Transfer the conversation to the sales agent',
      function: () => new Result({ value: 'Transferring to sales...', agent: salesAgent })
    }
  ]
});

async function runDemo() {
  try {
    const response = await client.run({
      agent: greetAgent,
      messages: [{ role: 'user', content: 'Hello, I need help with a purchase, transfer me to the sales agent.' }],
      contextVariables: { userName: 'John' },
      debug: true
    });

    console.log('Final response:', response.messages[response.messages.length - 1].content);
    console.log('Last agent:', response.agent.name);
    console.log('Updated context variables:', response.contextVariables);
  } catch (error) {
    console.error('Error running Swarm:', error);
  }
}

runDemo();
