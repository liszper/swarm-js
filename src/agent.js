export default class Agent {
  constructor({ name, instructions, functions, model = 'gpt-3.5-turbo', toolChoice = 'auto', parallelToolCalls = true }) {
    this.name = name;
    this.instructions = instructions;
    this.functions = functions;
    this.model = model;
    this.toolChoice = toolChoice;
    this.parallelToolCalls = parallelToolCalls;
  }

  getFunction(name) {
    const func = this.functions.find(f => f.name === name);
    return func ? func.function : null;
  }
}
