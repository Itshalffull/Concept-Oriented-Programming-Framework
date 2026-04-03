/**
 * TextDslProvider — converts between a human-readable filter DSL string and
 * FilterNode IR.
 *
 * DSL syntax:
 *   Comparison:  field = value | field != value | field > 5 | field >= 5 | field < 5 | field <= 5
 *   In:          field in (value1, value2, value3)
 *   Functions:   field contains "text" | field startsWith "text" | field endsWith "text"
 *   Exists:      field exists
 *   Boolean:     expr AND expr | expr OR expr | NOT expr
 *   Grouping:    (expr)
 *   Literals:    true | false (bare DSL keywords for true/false nodes)
 *   Strings:     double-quoted for guaranteed string treatment; unquoted treated as
 *                string unless they look numeric (integer or float).
 *
 * This provider can represent the full FilterNode tree, so canPrint() always
 * returns true for any valid FilterNode (except `param` nodes, which have no
 * DSL representation).
 *
 * See architecture doc Section 10.1 (ConceptManifest IR) for filter patterns.
 */

export type FilterNode =
  | { type: 'true' }
  | { type: 'false' }
  | { type: 'eq'; field: string; value: unknown }
  | { type: 'neq'; field: string; value: unknown }
  | { type: 'lt'; field: string; value: unknown }
  | { type: 'lte'; field: string; value: unknown }
  | { type: 'gt'; field: string; value: unknown }
  | { type: 'gte'; field: string; value: unknown }
  | { type: 'in'; field: string; values: unknown[] }
  | { type: 'not_in'; field: string; values: unknown[] }
  | { type: 'exists'; field: string }
  | { type: 'function'; name: 'contains' | 'startsWith' | 'endsWith' | 'matches'; field: string; value: string }
  | { type: 'and'; conditions: FilterNode[] }
  | { type: 'or'; conditions: FilterNode[] }
  | { type: 'not'; condition: FilterNode }
  | { type: 'param'; name: string };

// ─── Lexer ────────────────────────────────────────────────────────────────────

type TokenKind =
  | 'IDENT'
  | 'STRING'    // double-quoted
  | 'NUMBER'
  | 'EQ'        // =
  | 'NEQ'       // !=
  | 'GT'        // >
  | 'GTE'       // >=
  | 'LT'        // <
  | 'LTE'       // <=
  | 'LPAREN'    // (
  | 'RPAREN'    // )
  | 'COMMA'     // ,
  | 'AND'       // AND (keyword)
  | 'OR'        // OR  (keyword)
  | 'NOT'       // NOT (keyword)
  | 'IN'        // in  (keyword)
  | 'EXISTS'    // exists (keyword)
  | 'CONTAINS'  // contains (keyword)
  | 'STARTSWITH'// startsWith (keyword)
  | 'ENDSWITH'  // endsWith (keyword)
  | 'TRUE'      // true (keyword literal)
  | 'FALSE'     // false (keyword literal)
  | 'EOF';

interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

// Keywords that are only valid as operators after a field name (not as bare field names)
const OPERATOR_KEYWORDS: Record<string, TokenKind> = {
  in: 'IN',
  exists: 'EXISTS',
  contains: 'CONTAINS',
  startsWith: 'STARTSWITH',
  endsWith: 'ENDSWITH',
};

// Keywords that are always keywords regardless of position
const BOOLEAN_KEYWORDS: Record<string, TokenKind> = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  true: 'TRUE',
  false: 'FALSE',
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    const pos = i;

    // Double-quoted string
    if (input[i] === '"') {
      i++;
      let str = '';
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          const esc = input[i + 1];
          if (esc === '"') { str += '"'; i += 2; }
          else if (esc === '\\') { str += '\\'; i += 2; }
          else if (esc === 'n') { str += '\n'; i += 2; }
          else if (esc === 't') { str += '\t'; i += 2; }
          else { str += input[i]; i++; }
        } else {
          str += input[i];
          i++;
        }
      }
      if (i >= input.length) {
        throw new SyntaxError(`Unterminated string starting at position ${pos}`);
      }
      i++; // closing quote
      tokens.push({ kind: 'STRING', value: str, pos });
      continue;
    }

    // Two-character operators
    if (input[i] === '!' && input[i + 1] === '=') {
      tokens.push({ kind: 'NEQ', value: '!=', pos });
      i += 2;
      continue;
    }
    if (input[i] === '>' && input[i + 1] === '=') {
      tokens.push({ kind: 'GTE', value: '>=', pos });
      i += 2;
      continue;
    }
    if (input[i] === '<' && input[i + 1] === '=') {
      tokens.push({ kind: 'LTE', value: '<=', pos });
      i += 2;
      continue;
    }

    // Single-character operators and punctuation
    if (input[i] === '=') { tokens.push({ kind: 'EQ', value: '=', pos }); i++; continue; }
    if (input[i] === '>') { tokens.push({ kind: 'GT', value: '>', pos }); i++; continue; }
    if (input[i] === '<') { tokens.push({ kind: 'LT', value: '<', pos }); i++; continue; }
    if (input[i] === '(') { tokens.push({ kind: 'LPAREN', value: '(', pos }); i++; continue; }
    if (input[i] === ')') { tokens.push({ kind: 'RPAREN', value: ')', pos }); i++; continue; }
    if (input[i] === ',') { tokens.push({ kind: 'COMMA', value: ',', pos }); i++; continue; }

    // Number: optional leading minus, digits, optional decimal
    if (/[0-9]/.test(input[i]) || (input[i] === '-' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let num = '';
      if (input[i] === '-') { num += '-'; i++; }
      while (i < input.length && /[0-9]/.test(input[i])) { num += input[i]; i++; }
      if (i < input.length && input[i] === '.' && /[0-9]/.test(input[i + 1] ?? '')) {
        num += '.';
        i++;
        while (i < input.length && /[0-9]/.test(input[i])) { num += input[i]; i++; }
      }
      tokens.push({ kind: 'NUMBER', value: num, pos });
      continue;
    }

    // Identifier or keyword (identifiers may contain letters, digits, underscores)
    if (/[a-zA-Z_]/.test(input[i])) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      // Check boolean keywords first (always treated as keywords)
      const boolKw = BOOLEAN_KEYWORDS[ident];
      if (boolKw !== undefined) {
        tokens.push({ kind: boolKw, value: ident, pos });
      } else {
        // Check operator keywords
        const opKw = OPERATOR_KEYWORDS[ident];
        if (opKw !== undefined) {
          tokens.push({ kind: opKw, value: ident, pos });
        } else {
          tokens.push({ kind: 'IDENT', value: ident, pos });
        }
      }
      continue;
    }

    throw new SyntaxError(`Unexpected character '${input[i]}' at position ${pos}`);
  }

  tokens.push({ kind: 'EOF', value: '', pos: i });
  return tokens;
}

// ─── Parser (recursive descent) ──────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (tok.kind !== 'EOF') this.pos++;
    return tok;
  }

  private expect(kind: TokenKind): Token {
    const tok = this.peek();
    if (tok.kind !== kind) {
      throw new SyntaxError(
        `Expected ${kind} at position ${tok.pos}, got ${tok.kind} ("${tok.value}")`
      );
    }
    return this.advance();
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  // Coerce an unquoted identifier value to number if it looks numeric
  private coerceValue(raw: string, isString: boolean): unknown {
    if (isString) return raw;
    const n = Number(raw);
    if (!Number.isNaN(n) && raw.trim() !== '') return n;
    return raw;
  }

  // Parse a single DSL value (quoted string or unquoted identifier/number)
  private parseValue(): { value: unknown } {
    const tok = this.peek();
    if (tok.kind === 'STRING') {
      this.advance();
      return { value: tok.value };
    }
    if (tok.kind === 'NUMBER') {
      this.advance();
      return { value: this.coerceValue(tok.value, false) };
    }
    if (tok.kind === 'IDENT') {
      this.advance();
      return { value: this.coerceValue(tok.value, false) };
    }
    // Allow operator keywords to be used as values (e.g., `status = in` is valid)
    if (tok.kind === 'IN' || tok.kind === 'EXISTS' || tok.kind === 'CONTAINS' ||
        tok.kind === 'STARTSWITH' || tok.kind === 'ENDSWITH') {
      this.advance();
      return { value: tok.value };
    }
    throw new SyntaxError(`Expected a value at position ${tok.pos}, got ${tok.kind} ("${tok.value}")`);
  }

  // expr = or-expr
  parseExpr(): FilterNode {
    return this.parseOr();
  }

  // or-expr = and-expr (OR and-expr)*
  private parseOr(): FilterNode {
    const left = this.parseAnd();
    if (!this.check('OR')) return left;

    const conditions: FilterNode[] = [left];
    while (this.check('OR')) {
      this.advance();
      conditions.push(this.parseAnd());
    }
    return { type: 'or', conditions };
  }

  // and-expr = not-expr (AND not-expr)*
  private parseAnd(): FilterNode {
    const left = this.parseNot();
    if (!this.check('AND')) return left;

    const conditions: FilterNode[] = [left];
    while (this.check('AND')) {
      this.advance();
      conditions.push(this.parseNot());
    }
    return { type: 'and', conditions };
  }

  // not-expr = NOT not-expr | primary
  private parseNot(): FilterNode {
    if (this.check('NOT')) {
      this.advance();
      const condition = this.parseNot();
      return { type: 'not', condition };
    }
    return this.parsePrimary();
  }

  // primary = 'true' | 'false' | '(' expr ')' | field-expr
  private parsePrimary(): FilterNode {
    // Bare `true` / `false` literals
    if (this.check('TRUE')) {
      this.advance();
      return { type: 'true' };
    }
    if (this.check('FALSE')) {
      this.advance();
      return { type: 'false' };
    }

    if (this.check('LPAREN')) {
      this.advance();
      const expr = this.parseExpr();
      this.expect('RPAREN');
      return expr;
    }

    // Must be a field-based expression
    const fieldTok = this.peek();
    if (fieldTok.kind !== 'IDENT') {
      throw new SyntaxError(`Expected field name at position ${fieldTok.pos}, got ${fieldTok.kind} ("${fieldTok.value}")`);
    }
    const field = fieldTok.value;
    this.advance();

    const next = this.peek();

    // field = value
    if (next.kind === 'EQ') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'eq', field, value };
    }

    // field != value
    if (next.kind === 'NEQ') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'neq', field, value };
    }

    // field > value
    if (next.kind === 'GT') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'gt', field, value };
    }

    // field >= value
    if (next.kind === 'GTE') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'gte', field, value };
    }

    // field < value
    if (next.kind === 'LT') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'lt', field, value };
    }

    // field <= value
    if (next.kind === 'LTE') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'lte', field, value };
    }

    // field in (v1, v2, ...)
    if (next.kind === 'IN') {
      this.advance();
      this.expect('LPAREN');
      const values: unknown[] = [];
      if (!this.check('RPAREN')) {
        values.push(this.parseValue().value);
        while (this.check('COMMA')) {
          this.advance();
          values.push(this.parseValue().value);
        }
      }
      this.expect('RPAREN');
      return { type: 'in', field, values };
    }

    // field contains "text"
    if (next.kind === 'CONTAINS') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'function', name: 'contains', field, value: String(value) };
    }

    // field startsWith "text"
    if (next.kind === 'STARTSWITH') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'function', name: 'startsWith', field, value: String(value) };
    }

    // field endsWith "text"
    if (next.kind === 'ENDSWITH') {
      this.advance();
      const { value } = this.parseValue();
      return { type: 'function', name: 'endsWith', field, value: String(value) };
    }

    // field exists
    if (next.kind === 'EXISTS') {
      this.advance();
      return { type: 'exists', field };
    }

    // Bare field name with no operator: treat as `field exists`
    // (supports `NOT archived` as sugar for `NOT archived exists`)
    if (next.kind === 'EOF' || next.kind === 'AND' || next.kind === 'OR' || next.kind === 'RPAREN') {
      return { type: 'exists', field };
    }

    throw new SyntaxError(
      `Expected operator after field "${field}" at position ${next.pos}, got ${next.kind} ("${next.value}")`
    );
  }
}

// ─── Printer ──────────────────────────────────────────────────────────────────

// Reserved words that cannot be used as unquoted values (would parse incorrectly)
const RESERVED_WORDS = new Set([
  'AND', 'OR', 'NOT', 'in', 'exists', 'contains', 'startsWith', 'endsWith', 'true', 'false',
]);

/**
 * Quote a value for DSL output. Numbers are emitted unquoted; strings are
 * double-quoted if they contain characters that would confuse the lexer or
 * if they match reserved words.
 */
function printValue(value: unknown): string {
  if (typeof value === 'number') return String(value);
  const str = String(value ?? '');

  // Must quote if: empty, contains non-identifier characters, is a reserved word,
  // or looks numeric (would be reparsed as a number)
  const isSimpleIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
  const isNumericLike = !Number.isNaN(Number(str)) && str.trim() !== '';
  const needsQuoting = !isSimpleIdent || RESERVED_WORDS.has(str) || isNumericLike;

  if (needsQuoting) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * Print a function argument — always quoted for safety since function values
 * often contain dots, slashes, and other characters outside the identifier set.
 */
function printFunctionArg(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a text-DSL filter expression into a FilterNode tree.
 *
 * Throws SyntaxError if the input cannot be parsed.
 */
export function parse(repr: string): FilterNode {
  const trimmed = repr.trim();
  if (trimmed === '') return { type: 'true' };

  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  const node = parser.parseExpr();

  const remaining = parser.peek();
  if (remaining.kind !== 'EOF') {
    throw new SyntaxError(`Unexpected token "${remaining.value}" at position ${remaining.pos}`);
  }

  return node;
}

/**
 * Print a FilterNode tree back into a normalized text-DSL string.
 *
 * Returns null only for the `param` node type, which has no DSL representation.
 */
export function print(node: FilterNode): string | null {
  switch (node.type) {
    case 'true': return 'true';
    case 'false': return 'false';

    case 'eq':
      return `${node.field} = ${printValue(node.value)}`;

    case 'neq':
      return `${node.field} != ${printValue(node.value)}`;

    case 'gt':
      return `${node.field} > ${printValue(node.value)}`;

    case 'gte':
      return `${node.field} >= ${printValue(node.value)}`;

    case 'lt':
      return `${node.field} < ${printValue(node.value)}`;

    case 'lte':
      return `${node.field} <= ${printValue(node.value)}`;

    case 'in': {
      const vals = node.values.map(printValue).join(', ');
      return `${node.field} in (${vals})`;
    }

    case 'not_in': {
      const vals = node.values.map(printValue).join(', ');
      return `NOT ${node.field} in (${vals})`;
    }

    case 'exists':
      return `${node.field} exists`;

    case 'function': {
      return `${node.field} ${node.name} ${printFunctionArg(node.value)}`;
    }

    case 'and': {
      const parts = node.conditions.map(c => {
        const s = print(c);
        if (s === null) return null;
        // Wrap OR children in parentheses for correct precedence
        if (c.type === 'or') return `(${s})`;
        return s;
      });
      if (parts.some(p => p === null)) return null;
      return (parts as string[]).join(' AND ');
    }

    case 'or': {
      const parts = node.conditions.map(c => {
        const s = print(c);
        if (s === null) return null;
        // Wrap AND children in parentheses to make structure explicit when mixed
        if (c.type === 'and') return `(${s})`;
        return s;
      });
      if (parts.some(p => p === null)) return null;
      return (parts as string[]).join(' OR ');
    }

    case 'not': {
      const inner = print(node.condition);
      if (inner === null) return null;
      // Wrap compound inner expressions in parens
      if (node.condition.type === 'and' || node.condition.type === 'or') {
        return `NOT (${inner})`;
      }
      return `NOT ${inner}`;
    }

    // param has no DSL representation
    case 'param':
      return null;

    default:
      return null;
  }
}

/**
 * Returns true if print() can represent this FilterNode as a text-DSL string.
 *
 * The text DSL can represent every FilterNode variant except `param` (which is
 * a runtime variable placeholder with no textual syntax).
 */
export function canPrint(node: FilterNode): boolean {
  return print(node) !== null;
}

export const kind = 'text-dsl' as const;
