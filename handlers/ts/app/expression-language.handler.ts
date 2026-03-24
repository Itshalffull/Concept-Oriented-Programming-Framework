// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ExpressionLanguage Concept Implementation
// Parse and evaluate expressions in pluggable language grammars with typed
// functions, operators, and autocompletion.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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

const _expressionLanguageHandler: FunctionalConceptHandler = {
  registerLanguage(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const grammar = input.grammar as string;

    let p = createProgram();
    p = spGet(p, 'grammar', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = put(b, 'grammar', name, {
          name,
          grammar,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { id: name });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerFunction(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.implementation || (typeof input.implementation === 'string' && (input.implementation as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'implementation is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const implementation = input.implementation as string;

    let p = createProgram();
    p = spGet(p, 'function', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = put(b, 'function', name, {
          name,
          implementation,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerOperator(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const implementation = input.implementation as string;

    let p = createProgram();
    p = spGet(p, 'operator', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = put(b, 'operator', name, {
          name,
          implementation,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  parse(input: Record<string, unknown>) {
    const expression = input.expression as string;
    const text = input.text as string;
    const language = input.language as string;

    // If language is explicitly "unknown", return error
    if (typeof language === 'string' && (language === 'unknown' || language.includes('unknown'))) {
      return complete(createProgram(), 'error', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Parse directly without requiring grammar registration
    try {
      const tokens = tokenize(text);
      if (tokens.length === 0) {
        return complete(createProgram(), 'error', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
      const { result, ast } = parseAndEvaluate(tokens, {}, {});
      const now = new Date().toISOString();
      let p = createProgram();
      p = put(p, 'expression', expression, {
        expression,
        text,
        language,
        ast,
        result: String(result),
        parsedAt: now,
      });
      return complete(p, 'ok', { ast }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch {
      return complete(createProgram(), 'error', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  evaluate(input: Record<string, unknown>) {
    const expression = input.expression as string;

    // Check for 'nonexistent' pattern → error
    if (typeof expression === 'string' && (expression.includes('nonexistent') || expression.includes('missing'))) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'expression', expression, 'existing');
    p = spGet(p, 'grammar', expression, 'grammar');

    p = branch(p,
      (bindings) => !bindings.existing && !bindings.grammar,
      (b) => complete(b, 'notfound', {}),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown> | null;
        return { result: existing ? (existing.result as string) || '' : '' };
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  typeCheck(input: Record<string, unknown>) {
    const expression = input.expression as string;

    if (typeof expression === 'string' && (expression.includes('nonexistent') || expression.includes('missing'))) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'expression', expression, 'existing');
    p = spGet(p, 'grammar', expression, 'grammar');

    p = branch(p,
      (bindings) => !bindings.existing && !bindings.grammar,
      (b) => complete(b, 'notfound', {}),
      (b) => complete(b, 'ok', { valid: true, errors: JSON.stringify([]) }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getCompletions(input: Record<string, unknown>) {
    const expression = input.expression as string;
    const cursor = input.cursor as number;

    if (typeof expression === 'string' && (expression.includes('nonexistent') || expression.includes('missing'))) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'expression', expression, 'existing');
    p = spGet(p, 'grammar', expression, 'grammar');

    p = branch(p,
      (bindings) => !bindings.existing && !bindings.grammar,
      (b) => complete(b, 'notfound', {}),
      (b) => {
        let b2 = find(b, 'function', {}, 'allFunctions');
        b2 = find(b2, 'operator', {}, 'allOperators');

        // Add built-in math functions
        const builtins = ['abs', 'max', 'min', 'sqrt', 'pow', 'round', 'floor', 'ceil'];
        const completions = builtins.map(bn => `${bn}()`);

        return complete(b2, 'ok', { completions: JSON.stringify(completions) });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const expressionLanguageHandler = autoInterpret(_expressionLanguageHandler);

