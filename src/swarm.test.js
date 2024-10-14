import { Swarm } from './swarm.js';
import { Agent, Result } from './types.js';
import { MockOpenAIClient, createMockResponse } from './mockOpenAIClient.js';

const DEFAULT_RESPONSE_CONTENT = "sample response content";

describe('Swarm', () => {
  let mockOpenAIClient;

  beforeEach(() => {
    mockOpenAIClient = new MockOpenAIClient();
  });

  test('run with simple message', async () => {
    mockOpenAIClient.setResponse(createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT }));
    
    const agent = new Agent({ name: "Test Agent" });
    const client = new Swarm(mockOpenAIClient);
    const messages = [{ role: "user", content: "Hello, how are you?" }];
    
    const response = await client.run({ agent, messages });

    expect(response.messages[response.messages.length - 1].role).toBe("assistant");
    expect(response.messages[response.messages.length - 1].content).toBe(DEFAULT_RESPONSE_CONTENT);
  });

  test('tool call', async () => {
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
      ),
      createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT })
    ]);

    const client = new Swarm(mockOpenAIClient);
    const response = await client.run({ agent, messages });

    expect(getWeatherMock).toHaveBeenCalledWith({ location: expectedLocation });
    expect(response.messages[response.messages.length - 1].role).toBe("assistant");
    expect(response.messages[response.messages.length - 1].content).toBe(DEFAULT_RESPONSE_CONTENT);
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

    const client = new Swarm(mockOpenAIClient);
    const response = await client.run({ agent, messages, executeTools: false });

    expect(getWeatherMock).not.toHaveBeenCalled();
    expect(response.messages[response.messages.length - 1].tool_calls).toBeDefined();
    expect(response.messages[response.messages.length - 1].tool_calls[0].function.name).toBe("getWeather");
    expect(JSON.parse(response.messages[response.messages.length - 1].tool_calls[0].function.arguments)).toEqual({ location: expectedLocation });
  });

  test('handoff', async () => {
    const agent2 = new Agent({ name: "Test Agent 2" });
    const transferToAgent2 = jest.fn().mockReturnValue(new Result({ agent: agent2 }));

    const agent1 = new Agent({
      name: "Test Agent 1",
      functions: [
        {
          name: "transferToAgent2",
          description: "Transfer to Agent 2",
          function: transferToAgent2
        }
      ]
    });

    const messages = [{ role: "user", content: "I want to talk to agent 2" }];

    mockOpenAIClient.setSequentialResponses([
      createMockResponse(
        { role: "assistant", content: "" },
        [{ name: "transferToAgent2", arguments: "{}" }]
      ),
      createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT })
    ]);

    const client = new Swarm(mockOpenAIClient);
    const response = await client.run({ agent: agent1, messages });

    expect(transferToAgent2).toHaveBeenCalled();
    expect(response.agent).toBe(agent2);
    expect(response.messages[response.messages.length - 1].role).toBe("assistant");
    expect(response.messages[response.messages.length - 1].content).toBe(DEFAULT_RESPONSE_CONTENT);
  });
});