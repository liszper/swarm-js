import { inspect } from 'util';

export function debugPrint(debug, ...args) {
  if (!debug) return;
  const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
  const message = args.map(arg => typeof arg === 'object' ? inspect(arg, { depth: null }) : arg).join(' ');
  console.log(`\x1b[97m[\x1b[90m${timestamp}\x1b[97m]\x1b[90m ${message}\x1b[0m`);
}

export function mergeFields(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') {
      target[key] = (target[key] || '') + value;
    } else if (value !== null && typeof value === 'object') {
      target[key] = target[key] || {};
      mergeFields(target[key], value);
    }
  }
}

export function mergeChunk(finalResponse, delta) {
  delete delta.role;
  mergeFields(finalResponse, delta);

  const toolCalls = delta.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const index = toolCalls[0].index;
    delete toolCalls[0].index;
    finalResponse.tool_calls = finalResponse.tool_calls || {};
    finalResponse.tool_calls[index] = finalResponse.tool_calls[index] || {};
    mergeFields(finalResponse.tool_calls[index], toolCalls[0]);
  }
}

export function functionToJson(func) {
  const typeMap = {
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'object': 'object',
    'undefined': 'null'
  };

  const parameters = {};
  const required = [];

  // Parse the function's toString() output to get parameter information
  const funcString = func.toString();
  const paramMatch = funcString.match(/\(([^)]*)\)/);
  if (paramMatch) {
    const params = paramMatch[1].split(',').map(p => p.trim());
    params.forEach(param => {
      if (param) {
        const [name, defaultValue] = param.split('=').map(p => p.trim());
        parameters[name] = { type: 'string' }; // Default to string type
        if (defaultValue === undefined) {
          required.push(name);
        }
      }
    });
  }

  return {
    type: 'function',
    function: {
      name: func.name,
      description: func.description || '',
      parameters: {
        type: 'object',
        properties: parameters,
        required: required
      }
    }
  };
}