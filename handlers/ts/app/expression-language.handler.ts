// ExpressionLanguage Concept Implementation
// Parse and evaluate expressions in pluggable language grammars with typed
// functions, operators, and autocompletion.
import type { ConceptHandler } from '@clef/runtime';

/**
 * Simple recursive-descent parser and evaluator for arithmetic expressions.
 * Supports: +, -, *, /, parentheses, numeric literals, and registered functions.
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    if ('+-*/(),%'.includes(text[i])) {
      tokens.push(text[i]);
      i++;
      continue;
    }
    if (/[0-9.]/.test(text[i])) {
      let num = '';
      while (i < text.length && /[0-9.]/.test(text[i])) {
        num += text[i];
        i++;
      }
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z_]/.test(text[i])) {
      let id = '';
      while (i < text.length && /[a-zA-Z_0-9]/.test(text[i])) {
        id += text[i];
        i++;
      }
      tokens.push(id);
      continue;
    }
    // Skip unknown characters
    i++;
  }
  return tokens;
}

function parseAndEvaluate(
  tokens: string[],
  functions: Record<string, string>,
  operators: Record<string, string>,
): { result: number; ast: string } {
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(): string {
    return tokens[pos++];
  }

  function parseExpression(): { value: number; ast: string } {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      const opName = op === '+' ? 'add' : 'sub';
      left = {
        value: op === '+' ? left.value + right.value : left.value - right.value,
        ast: `${opName}(${left.ast}, ${right.ast})`,
      };
    }
    return left;
  }

  function parseTerm(): { value: number; ast: string } {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parseFactor();
      const opName = op === '*' ? 'mul' : op === '/' ? 'div' : 'mod';
      let value: number;
      if (op === '*') value = left.value * right.value;
      else if (op === '/') value = right.value !== 0 ? left.value / right.value : NaN;
      else value = left.value % right.value;
      left = {
        value,
        ast: `${opName}(${left.ast}, ${right.ast})`,
      };
    }
    return left;
  }

  function parseFactor(): { value: number; ast: string } {
    const token = peek();
    if (token === '(') {
      consume(); // '('
      const inner = parseExpression();
      consume(); // ')'
      return inner;
    }
    if (token && /^[a-zA-Z_]/.test(token)) {
      const name = consume();
      if (peek() === '(') {
        // Function call
        consume(); // '('
        const args: { value: number; ast: string }[] = [];
        if (peek() !== ')') {
          args.push(parseExpression());
          while (peek() === ',') {
            consume(); // ','
            args.push(parseExpression());
          }
        }
        consume(); // ')'
        const argValues = args.map(a => a.value);
        const argAsts = args.map(a => a.ast).join(', ');
        // Evaluate built-in or registered functions
        let value = 0;
        if (name === 'abs') value = Math.abs(argValues[0] ?? 0);
        else if (name === 'max') value = Math.max(...argValues);
        else if (name === 'min') value = Math.min(...argValues);
        else if (name === 'sqrt') value = Math.sqrt(argValues[0] ?? 0);
        else if (name === 'pow') value = Math.pow(argValues[0] ?? 0, argValues[1] ?? 0);
        else if (name === 'round') value = Math.round(argValues[0] ?? 0);
        else if (name === 'floor') value = Math.floor(argValues[0] ?? 0);
        else if (name === 'ceil') value = Math.ceil(argValues[0] ?? 0);
        else if (functions[name]) value = argValues[0] ?? 0; // Custom function placeholder
        return { value, ast: `${name}(${argAsts})` };
      }
      // Identifier without parens (variable or constant)
      return { value: 0, ast: name };
    }
    // Numeric literal
    const num = consume();
    const value = parseFloat(num);
    return { value, ast: num };
  }

  const result = parseExpression();
  return { result: result.value, ast: result.ast };
}

export const expressionLanguageHandler: ConceptHandler = {
  async registerLanguage(input, storage) {
    const name = input.name as string;
    const grammar = input.grammar as string;

    const existing = await storage.get('grammar', name);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('grammar', name, {
      name,
      grammar,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async registerFunction(input, storage) {
    const name = input.name as string;
    const implementation = input.implementation as string;

    const existing = await storage.get('function', name);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('function', name, {
      name,
      implementation,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async registerOperator(input, storage) {
    const name = input.name as string;
    const implementation = input.implementation as string;

    const existing = await storage.get('operator', name);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('operator', name, {
      name,
      implementation,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async parse(input, storage) {
    const expression = input.expression as string;
    const text = input.text as string;
    const language = input.language as string;

    // Verify language is registered
    const lang = await storage.get('grammar', language);
    if (!lang) {
      return { variant: 'error' };
    }

    // Gather registered functions and operators for evaluation context
    const allFunctions = await storage.find('function');
    const allOperators = await storage.find('operator');
    const functions: Record<string, string> = {};
    const operators: Record<string, string> = {};
    for (const fn of allFunctions) {
      functions[fn.name as string] = fn.implementation as string;
    }
    for (const op of allOperators) {
      operators[op.name as string] = op.implementation as string;
    }

    try {
      const tokens = tokenize(text);
      if (tokens.length === 0) {
        return { variant: 'error' };
      }
      const { result, ast } = parseAndEvaluate(tokens, functions, operators);

      const now = new Date().toISOString();
      await storage.put('expression', expression, {
        expression,
        text,
        language,
        ast,
        result: String(result),
        parsedAt: now,
      });

      return { variant: 'ok', ast };
    } catch {
      return { variant: 'error' };
    }
  },

  async evaluate(input, storage) {
    const expression = input.expression as string;

    const existing = await storage.get('expression', expression);
    if (!existing) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', result: existing.result as string };
  },

  async typeCheck(input, storage) {
    const expression = input.expression as string;

    const existing = await storage.get('expression', expression);
    if (!existing) {
      return { variant: 'notfound' };
    }

    // Perform basic type checking on the parsed AST
    const ast = existing.ast as string;
    const errors: string[] = [];
    const result = existing.result as string;

    if (result === 'NaN') {
      errors.push('Expression evaluates to NaN (possible division by zero)');
    }
    if (result === 'Infinity' || result === '-Infinity') {
      errors.push('Expression evaluates to Infinity');
    }

    const valid = errors.length === 0;

    return { variant: 'ok', valid, errors: JSON.stringify(errors) };
  },

  async getCompletions(input, storage) {
    const expression = input.expression as string;
    const cursor = input.cursor as number;

    const existing = await storage.get('expression', expression);
    if (!existing) {
      return { variant: 'notfound' };
    }

    // Gather available functions and operators as completion candidates
    const allFunctions = await storage.find('function');
    const allOperators = await storage.find('operator');

    const completions: string[] = [];
    for (const fn of allFunctions) {
      completions.push(`${fn.name as string}()`);
    }
    for (const op of allOperators) {
      completions.push(op.name as string);
    }

    // Add built-in math functions
    const builtins = ['abs', 'max', 'min', 'sqrt', 'pow', 'round', 'floor', 'ceil'];
    for (const b of builtins) {
      completions.push(`${b}()`);
    }

    return { variant: 'ok', completions: JSON.stringify(completions) };
  },
};
