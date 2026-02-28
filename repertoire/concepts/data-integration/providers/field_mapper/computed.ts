// Computed field mapper — sandboxed expression evaluation against record context
// Supports: arithmetic (+, -, *, /, %), string concatenation, comparisons,
// ternary conditions, and field references by name

export interface MapperConfig {
  pathSyntax: string;
  options?: Record<string, unknown>;
}

export const PROVIDER_ID = 'computed';
export const PLUGIN_TYPE = 'field_mapper';

type ExprValue = string | number | boolean | null;

function resolveField(record: Record<string, unknown>, name: string): ExprValue {
  const parts = name.split('.');
  let current: unknown = record;
  for (const p of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[p];
  }
  if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
    return current;
  }
  return current === null || current === undefined ? null : String(current);
}

function tokenizeExpr(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    // String literal
    if (expr[i] === '"' || expr[i] === "'") {
      const quote = expr[i];
      let j = i + 1;
      while (j < expr.length && expr[j] !== quote) {
        if (expr[j] === '\\') j++;
        j++;
      }
      tokens.push(expr.slice(i, j + 1));
      i = j + 1;
    } else if (/[0-9]/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]))) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      tokens.push(expr.slice(i, j));
      i = j;
    } else if (/[a-zA-Z_]/.test(expr[i])) {
      let j = i;
      while (j < expr.length && /[a-zA-Z0-9_.]/.test(expr[j])) j++;
      tokens.push(expr.slice(i, j));
      i = j;
    } else if (expr.slice(i, i + 2).match(/^(==|!=|<=|>=|&&|\|\|)/)) {
      tokens.push(expr.slice(i, i + 2));
      i += 2;
    } else {
      tokens.push(expr[i]);
      i++;
    }
  }
  return tokens;
}

class ExprParser {
  private tokens: string[];
  private pos = 0;
  private record: Record<string, unknown>;

  constructor(tokens: string[], record: Record<string, unknown>) {
    this.tokens = tokens;
    this.record = record;
  }

  private peek(): string | undefined { return this.tokens[this.pos]; }
  private advance(): string { return this.tokens[this.pos++]; }

  parse(): ExprValue {
    const result = this.parseTernary();
    return result;
  }

  private parseTernary(): ExprValue {
    const cond = this.parseOr();
    if (this.peek() === '?') {
      this.advance();
      const thenVal = this.parseTernary();
      if (this.peek() === ':') this.advance();
      const elseVal = this.parseTernary();
      return cond ? thenVal : elseVal;
    }
    return cond;
  }

  private parseOr(): ExprValue {
    let left = this.parseAnd();
    while (this.peek() === '||') {
      this.advance();
      const right = this.parseAnd();
      left = (left || right) as ExprValue;
    }
    return left;
  }

  private parseAnd(): ExprValue {
    let left = this.parseComparison();
    while (this.peek() === '&&') {
      this.advance();
      const right = this.parseComparison();
      left = (left && right) as ExprValue;
    }
    return left;
  }

  private parseComparison(): ExprValue {
    let left = this.parseAddSub();
    const op = this.peek();
    if (op && ['==', '!=', '<', '>', '<=', '>='].includes(op)) {
      this.advance();
      const right = this.parseAddSub();
      switch (op) {
        case '==': return left == right;
        case '!=': return left != right;
        case '<':  return (left as number) < (right as number);
        case '>':  return (left as number) > (right as number);
        case '<=': return (left as number) <= (right as number);
        case '>=': return (left as number) >= (right as number);
      }
    }
    return left;
  }

  private parseAddSub(): ExprValue {
    let left = this.parseMulDiv();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.advance();
      const right = this.parseMulDiv();
      if (op === '+') {
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left ?? '') + String(right ?? '');
        } else {
          left = (left as number) + (right as number);
        }
      } else {
        left = (left as number) - (right as number);
      }
    }
    return left;
  }

  private parseMulDiv(): ExprValue {
    let left = this.parseUnary();
    while (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') {
      const op = this.advance();
      const right = this.parseUnary();
      if (op === '*') left = (left as number) * (right as number);
      else if (op === '/') left = (right as number) !== 0 ? (left as number) / (right as number) : null;
      else left = (right as number) !== 0 ? (left as number) % (right as number) : null;
    }
    return left;
  }

  private parseUnary(): ExprValue {
    if (this.peek() === '-') {
      this.advance();
      return -(this.parsePrimary() as number);
    }
    if (this.peek() === '!') {
      this.advance();
      return !this.parsePrimary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprValue {
    const token = this.peek();
    if (token === undefined) return null;

    if (token === '(') {
      this.advance();
      const val = this.parseTernary();
      if (this.peek() === ')') this.advance();
      return val;
    }

    if ((token.startsWith('"') || token.startsWith("'")) && token.length >= 2) {
      this.advance();
      return token.slice(1, -1).replace(/\\(.)/g, '$1');
    }

    if (/^[0-9]/.test(token) || (token.startsWith('.') && token.length > 1)) {
      this.advance();
      return parseFloat(token);
    }

    if (token === 'true') { this.advance(); return true; }
    if (token === 'false') { this.advance(); return false; }
    if (token === 'null') { this.advance(); return null; }

    // Field reference
    this.advance();
    return resolveField(this.record, token);
  }
}

export class ComputedMapperProvider {
  resolve(
    record: Record<string, unknown>,
    sourcePath: string,
    _config: MapperConfig
  ): unknown {
    const expr = sourcePath.trim();
    if (!expr) return null;
    try {
      const tokens = tokenizeExpr(expr);
      const parser = new ExprParser(tokens, record);
      return parser.parse();
    } catch {
      return null;
    }
  }

  supports(pathSyntax: string): boolean {
    return pathSyntax === 'expression' || pathSyntax === 'computed' || pathSyntax === 'expr';
  }
}

export default ComputedMapperProvider;
