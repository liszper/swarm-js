import { Swarm } from './swarm.js';
import { Agent, Result } from './types.js';
import { MockOpenAIClient, createMockResponse } from './mockOpenAIClient.js';

const DEFAULT_RESPONSE_CONTENT = "sample response content";

describe('Swarm', () => {
  let mockOpenAIClient;
  let swarm;

  beforeEach(() => {
    console.log('Creating new MockOpenAIClient and Swarm');
    mockOpenAIClient = new MockOpenAIClient();
    swarm = new Swarm(mockOpenAIClient);
  });

  afterEach(() => {
    console.log('Resetting mock client after test');
    mockOpenAIClient.resetResponseIndex();
  });

  test('run with simple message', async () => {
    console.log('Starting simple message test');
    mockOpenAIClient.setResponse(createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT }));
    
    const agent = new Agent({ name: "Test Agent" });
    const messages = [{ role: "user", content: "Hello, how are you?" }];
    
    const response = await swarm.run({ agent, messages });

    expect(response.messages[response.messages.length - 1].role).toBe("assistant");
    expect(response.messages[response.messages.length - 1].content).toBe(DEFAULT_RESPONSE_CONTENT);
  });

  test('tool call', async () => {
    console.log('Starting tool call test');
    const expectedLocation = "San Francisco";
    const getWeatherMock = jest.fn().mockReturnValue("It's sunny today.");

    const agent = new Agent({
      name: "Test Agent",
      functions: [
        {
          name: "getWeather",
          description: "Get weather for a location",
          function: getWeatherMock
        }
      ]
    });

    const messages = [{ role: "user", content: "What's the weather like in San Francisco?" }];

    mockOpenAIClient.setSequentialResponses([
      createMockResponse(
        { role: "assistant", content: "" },
        [{ name: "getWeather", arguments: JSON.stringify({ location: expectedLocation }) }]
      )
    ]);

    const response = await swarm.run({ agent, messages, debug: true });

    expect(getWeatherMock).toHaveBeenCalledWith({ location: expectedLocation });
    expect(response.messages[response.messages.length - 1].role).toBe("tool");
    expect(response.messages[response.messages.length - 1].content).toBe("It's sunny today.");
  });

  test('execute tools false', async () => {
    const expectedLocation = "San Francisco";
    const getWeatherMock = jest.fn().mockReturnValue("It's sunny today.");

    const agent = new Agent({
      name: "Test Agent",
      functions: [
        {
          name: "getWeather",
          description: "Get weather for a location",
          function: getWeatherMock
        }
      ]
    });

    const messages = [{ role: "user", content: "What's the weather like in San Francisco?" }];

    mockOpenAIClient.setResponse(
      createMockResponse(
        { role: "assistant", content: "" },
        [{ name: "getWeather", arguments: JSON.stringify({ location: expectedLocation }) }]
      )
    );

    const response = await swarm.run({ agent, messages, executeTools: false });

    expect(getWeatherMock).not.toHaveBeenCalled();
    expect(response.messages[response.messages.length - 1].tool_calls).toBeDefined();
    expect(response.messages[response.messages.length - 1].tool_calls[0].function.name).toBe("getWeather");
    expect(JSON.parse(response.messages[response.messages.length - 1].tool_calls[0].function.arguments)).toEqual({ location: expectedLocation });
  });

  test('handoff', async () => {
    const agent2 = new Agent({ name: "Test Agent 2", instructions: "You are Agent 2." });
    const transferToAgent2 = jest.fn().mockImplementation(() => {
      console.log("transferToAgent2 called");
      return new Result({ 
        value: "Transferring to Agent 2", 
        agent: agent2 
      });
    });

    const agent1 = new Agent({
      name: "Test Agent 1",
      instructions: "You are a helpful agent.",
      functions: [
        {
          name: "transferToAgent2",
          description: "Transfer to Agent 2",
          function: transferToAgent2
        }
      ]
    });

    const messages = [{ role: "user", content: "I want to talk to agent 2" }];

    const mockOpenAIClient = new MockOpenAIClient();
    mockOpenAIClient.setSequentialResponses([
      {
        choices: [
          {
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call_0",
                  type: "function",
                  function: {
                    name: "transferToAgent2",
                    arguments: "{}"
                  }
                }
              ]
            }
          }
        ]
      }
    ]);

    const swarm = new Swarm(mockOpenAIClient);
    const response = await swarm.run({ agent: agent1, messages, debug: true });

    console.log("Final response:", JSON.stringify(response, null, 2));

    expect(transferToAgent2).toHaveBeenCalled();
    expect(response.agent.name).toBe("Test Agent 2");
    expect(response.messages[response.messages.length - 1].role).toBe("tool");
    expect(response.messages[response.messages.length - 1].content).toBe("Transferring to Agent 2");
  });
});
