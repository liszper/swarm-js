export class MockOpenAIClient {
  constructor() {
    this.responses = [];
    this.currentResponseIndex = 0;
  }

  setResponse(response) {
    this.responses = [response];
  }

  setSequentialResponses(responses) {
    this.responses = responses;
    this.currentResponseIndex = 0;
  }

  chat = {
    completions: {
      create: async (params) => {
        if (this.currentResponseIndex >= this.responses.length) {
          throw new Error("No more mock responses available");
        }
        const response = this.responses[this.currentResponseIndex];
        this.currentResponseIndex++;
        
        if (params.stream) {
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { choices: [{ delta: response.choices[0].message }] };
            }
          };
        }
        
        return response;
      }
    }
  };
}

export function createMockResponse(message, toolCalls = []) {
  return {
    choices: [
      {
        message: {
          ...message,
          tool_calls: toolCalls.map((call, index) => ({
            id: `call_${index}`,
            type: 'function',
            function: call
          }))
        }
      }
    ]
  };
}