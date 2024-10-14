class Agent {
  constructor({
    name,
    model = 'gpt-4',
    instructions,
    functions = [],
    toolChoice = null,
    parallelToolCalls = true,
  }) {
    this.name = name;
    this.model = model;
    this.instructions = instructions;
    this.functions = functions;
    this.toolChoice = toolChoice;
    this.parallelToolCalls = parallelToolCalls;
  }
}

export default Agent;
