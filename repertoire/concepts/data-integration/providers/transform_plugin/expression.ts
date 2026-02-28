// Transform Plugin Provider: expression
// Evaluate sandboxed math/string expressions with variable references.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'expression';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

type ExprValue = number | string | boolean | null;

export class ExpressionTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    const expr = (config.options?.expression as string) ?? '';
    if (!expr.trim()) {
      return value;
    }

    const variables = (config.options?.variables as Record<string, unknown>) ?? {};
    // The input value is available as "value" or "$"
    const context: Record<string, unknown> = { value, $: value, ...variables };

    return this.evaluate(expr.trim(), context);
  }

  private evaluate(expr: string, ctx: Record<string, unknown>): ExprValue {
    const tokens = this.tokenize(expr);
    const result = this.parseExpression(tokens, 0, ctx);
    return result.value;
  }

  private tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let i = 0;

    while (i < expr.length) {
      // Skip whitespace
      if (/\s/.test(expr[i])) { i++; continue; }

      // String literals
      if (expr[i] === '"' || expr[i] === "'") {
        const quote = expr[i];
        let str = '';
        i++;
        while (i < expr.length && expr[i] !== quote) {
          if (expr[i] === '\\' && i + 1 < expr.length) {
            i++;
            str += expr[i];
          } else {
            str += expr[i];
          }
          i++;
        }
        i++; // skip closing quote
        tokens.push(`"${str}"`);
        continue;
      }

      // Numbers
      if (/[\d.]/.test(expr[i])) {
        let num = '';
        while (i < expr.length && /[\d.eE]/.test(expr[i])) {
          num += expr[i]; i++;
        }
        tokens.push(num);
        continue;
      }

      // Two-character operators
      if (i + 1 < expr.length) {
        const two = expr[i] + expr[i + 1];
        if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
          tokens.push(two);
          i += 2;
          continue;
        }
      }

      // Single-character operators
      if ('+-*/%><!?:(),.'.includes(expr[i])) {
        tokens.push(expr[i]);
        i++;
        continue;
      }

      // Identifiers (variable names)
      if (/[a-zA-Z_$]/.test(expr[i])) {
        let ident = '';
        while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
          ident += expr[i]; i++;
        }
        tokens.push(ident);
        continue;
      }

      i++;
    }
    return tokens;
  }

  private parseExpression(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    return this.parseTernary(tokens, pos, ctx);
  }

  private parseTernary(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    const cond = this.parseOr(tokens, pos, ctx);
    if (cond.pos < tokens.length && tokens[cond.pos] === '?') {
      const trueBranch = this.parseExpression(tokens, cond.pos + 1, ctx);
      if (trueBranch.pos < tokens.length && tokens[trueBranch.pos] === ':') {
        const falseBranch = this.parseExpression(tokens, trueBranch.pos + 1, ctx);
        return { value: cond.value ? trueBranch.value : falseBranch.value, pos: falseBranch.pos };
      }
    }
    return cond;
  }

  private parseOr(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    let left = this.parseAnd(tokens, pos, ctx);
    while (left.pos < tokens.length && tokens[left.pos] === '||') {
      const right = this.parseAnd(tokens, left.pos + 1, ctx);
      left = { value: left.value || right.value ? true : false, pos: right.pos };
    }
    return left;
  }

  private parseAnd(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    let left = this.parseComparison(tokens, pos, ctx);
    while (left.pos < tokens.length && tokens[left.pos] === '&&') {
      const right = this.parseComparison(tokens, left.pos + 1, ctx);
      left = { value: left.value && right.value ? true : false, pos: right.pos };
    }
    return left;
  }

  private parseComparison(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    let left = this.parseAddSub(tokens, pos, ctx);
    const ops = ['==', '!=', '>', '<', '>=', '<='];
    while (left.pos < tokens.length && ops.includes(tokens[left.pos])) {
      const op = tokens[left.pos];
      const right = this.parseAddSub(tokens, left.pos + 1, ctx);
      left = { value: this.compareOp(left.value, op, right.value), pos: right.pos };
    }
    return left;
  }

  private compareOp(a: ExprValue, op: string, b: ExprValue): boolean {
    switch (op) {
      case '==': return a == b;
      case '!=': return a != b;
      case '>': return Number(a) > Number(b);
      case '<': return Number(a) < Number(b);
      case '>=': return Number(a) >= Number(b);
      case '<=': return Number(a) <= Number(b);
      default: return false;
    }
  }

  private parseAddSub(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    let left = this.parseMulDiv(tokens, pos, ctx);
    while (left.pos < tokens.length && (tokens[left.pos] === '+' || tokens[left.pos] === '-')) {
      const op = tokens[left.pos];
      const right = this.parseMulDiv(tokens, left.pos + 1, ctx);
      if (op === '+') {
        // String concatenation if either side is a string
        if (typeof left.value === 'string' || typeof right.value === 'string') {
          left = { value: String(left.value ?? '') + String(right.value ?? ''), pos: right.pos };
        } else {
          left = { value: Number(left.value) + Number(right.value), pos: right.pos };
        }
      } else {
        left = { value: Number(left.value) - Number(right.value), pos: right.pos };
      }
    }
    return left;
  }

  private parseMulDiv(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    let left = this.parseUnary(tokens, pos, ctx);
    while (left.pos < tokens.length && ['*', '/', '%'].includes(tokens[left.pos])) {
      const op = tokens[left.pos];
      const right = this.parseUnary(tokens, left.pos + 1, ctx);
      const a = Number(left.value);
      const b = Number(right.value);
      if (op === '*') left = { value: a * b, pos: right.pos };
      else if (op === '/') left = { value: b === 0 ? null : a / b, pos: right.pos };
      else left = { value: b === 0 ? null : a % b, pos: right.pos };
    }
    return left;
  }

  private parseUnary(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    if (pos < tokens.length && tokens[pos] === '!') {
      const operand = this.parseUnary(tokens, pos + 1, ctx);
      return { value: !operand.value, pos: operand.pos };
    }
    if (pos < tokens.length && tokens[pos] === '-') {
      const operand = this.parsePrimary(tokens, pos + 1, ctx);
      return { value: -Number(operand.value), pos: operand.pos };
    }
    return this.parsePrimary(tokens, pos, ctx);
  }

  private parsePrimary(
    tokens: string[], pos: number, ctx: Record<string, unknown>
  ): { value: ExprValue; pos: number } {
    if (pos >= tokens.length) {
      return { value: null, pos };
    }

    const token = tokens[pos];

    // Parenthesized expression
    if (token === '(') {
      const inner = this.parseExpression(tokens, pos + 1, ctx);
      const closePos = inner.pos < tokens.length && tokens[inner.pos] === ')' ? inner.pos + 1 : inner.pos;
      return { value: inner.value, pos: closePos };
    }

    // String literal
    if (token.startsWith('"')) {
      return { value: token.slice(1, -1), pos: pos + 1 };
    }

    // Number
    if (/^[\d.]/.test(token)) {
      return { value: parseFloat(token), pos: pos + 1 };
    }

    // Boolean/null keywords
    if (token === 'true') return { value: true, pos: pos + 1 };
    if (token === 'false') return { value: false, pos: pos + 1 };
    if (token === 'null') return { value: null, pos: pos + 1 };

    // Variable reference
    if (/^[a-zA-Z_$]/.test(token)) {
      const val = ctx[token];
      const resolved = val === undefined ? null : val;
      return { value: resolved as ExprValue, pos: pos + 1 };
    }

    return { value: null, pos: pos + 1 };
  }

  inputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }
}

export default ExpressionTransformProvider;
