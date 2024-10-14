import { functionToJson } from './util.js';

describe('functionToJson', () => {
  test('basic function', () => {
    function basicFunction(arg1, arg2) {
      return arg1 + arg2;
    }

    const result = functionToJson(basicFunction);
    expect(result).toEqual({
      type: 'function',
      function: {
        name: 'basicFunction',
        description: '',
        parameters: {
          type: 'object',
          properties: {
            arg1: { type: 'string' },
            arg2: { type: 'string' }
          },
          required: ['arg1', 'arg2']
        }
      }
    });
  });

  test('complex function with types and descriptions', () => {
    function complexFunctionWithTypesAndDescriptions(arg1, arg2, arg3 = 3.14, arg4 = false) {
      // This is a complex function with a description.
    }
    complexFunctionWithTypesAndDescriptions.description = 'This is a complex function with a description.';

    const result = functionToJson(complexFunctionWithTypesAndDescriptions);
    expect(result).toEqual({
      type: 'function',
      function: {
        name: 'complexFunctionWithTypesAndDescriptions',
        description: 'This is a complex function with a description.',
        parameters: {
          type: 'object',
          properties: {
            arg1: { type: 'string' },
            arg2: { type: 'string' },
            arg3: { type: 'string' },
            arg4: { type: 'string' }
          },
          required: ['arg1', 'arg2']
        }
      }
    });
  });

  test('function with no parameters', () => {
    function noParamsFunction() {
      // This function has no parameters
    }

    const result = functionToJson(noParamsFunction);
    expect(result).toEqual({
      type: 'function',
      function: {
        name: 'noParamsFunction',
        description: '',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    });
  });

  test('arrow function', () => {
    const arrowFunction = (arg1, arg2 = 'default') => {
      // This is an arrow function
    };
    arrowFunction.description = 'This is an arrow function';

    const result = functionToJson(arrowFunction);
    expect(result).toEqual({
      type: 'function',
      function: {
        name: 'arrowFunction',
        description: 'This is an arrow function',
        parameters: {
          type: 'object',
          properties: {
            arg1: { type: 'string' },
            arg2: { type: 'string' }
          },
          required: ['arg1']
        }
      }
    });
  });
});