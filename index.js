import 'dotenv/config';
import { Swarm } from './src/swarm.js';
import { runDemoLoop } from './src/repl.js';
import Agent from './src/agent.js';
import { Result } from './src/types.js';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to get user input
function getUserInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Example usage
const client = new Swarm();

const architectAgent = new Agent({
  name: 'ArchitectAgent',
  instructions: 'You are a software architect. Gather requirements, create a high-level plan for the project, and design the overall structure of the application.',
  functions: [
    {
      name: 'transferToDeveloper',
      description: 'Transfer the conversation to the developer agent',
      function: () => new Result({ value: 'Transferring to developer...', agent: developerAgent })
    },
    {
      name: 'askUser',
      description: 'Ask the user a question and get their response',
      function: async (args) => {
        const question = args.question || 'Please provide more information: ';
        const answer = await getUserInput(question);
        return new Result({ value: answer });
      }
    }
  ]
});

const developerAgent = new Agent({
  name: 'DeveloperAgent',
  instructions: 'You are a skilled developer. Implement the code based on the architect\'s design.',
  functions: [
    {
      name: 'transferToReviewer',
      description: 'Transfer the conversation to the code reviewer agent',
      function: () => new Result({ value: 'Transferring to reviewer...', agent: reviewerAgent })
    }
  ]
});

const reviewerAgent = new Agent({
  name: 'ReviewerAgent',
  instructions: 'You are a code reviewer. Review the implemented code and suggest improvements.',
  functions: [
    {
      name: 'approveCode',
      description: 'Approve the code and finish the process',
      function: () => new Result({ value: 'Code approved. Process complete.' })
    }
  ]
});

async function createRepository(projectDescription) {
  try {
    let currentAgent = architectAgent;
    let response;
    let isComplete = false;

    while (!isComplete) {
      response = await client.run({
        agent: currentAgent,
        messages: response ? response.messages : [{ role: 'user', content: `Create a new repository for: ${projectDescription}` }],
        contextVariables: response ? response.contextVariables : { projectDescription },
        debug: true
      });

      console.log('Current agent:', currentAgent.name);
      console.log('Response:', response.messages[response.messages.length - 1].content);

      if (response.agent && response.agent !== currentAgent) {
        currentAgent = response.agent;
        console.log('Transferring to:', currentAgent.name);
      } else if (!response.agent) {
        isComplete = true;
      }
    }

    console.log('Process complete.');
    console.log('Final context variables:', response.contextVariables);
  } catch (error) {
    console.error('Error running Swarm:', error);
  } finally {
    rl.close();
  }
}

// Example usage
const projectDescription = "Create a simple weather app that displays current weather conditions for a given location using a weather API.";
createRepository(projectDescription);
