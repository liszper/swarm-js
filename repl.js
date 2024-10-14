import { runDemoLoop } from './src/repl.js';
import { Agent, Result } from './src/types.js';

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

runDemoLoop(greetAgent, {}, true, true);