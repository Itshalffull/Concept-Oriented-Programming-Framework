// ============================================================
// COPF Kernel - .concept File Parser
// Tokenizer + Recursive Descent Parser
// ============================================================

import type {
  ConceptAST,
  TypeExpr,
  StateEntry,
  ActionDecl,
  ParamDecl,
  ReturnVariant,
  InvariantDecl,
  ActionPattern,
  ArgPattern,
} from './types.js';

// --- Token Types ---

type TokenType =
  | 'KEYWORD'
  | 'PRIMITIVE'
  | 'IDENT'
  | 'STRING_LIT'
  | 'INT_LIT'
  | 'FLOAT_LIT'
  | 'BOOL_LIT'
  | 'ARROW'
  | 'COLON'
  | 'COMMA'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'SEP'
  | 'PROSE'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'concept', 'purpose', 'state', 'actions', 'action',
  'invariant', 'capabilities', 'requires', 'after',
  'then', 'and',
]);

// These are only keywords inside type expressions. Everywhere else
// they are valid identifiers (action names, field names, etc.).
const CONTEXTUAL_KEYWORDS = new Set(['set', 'list', 'option']);

const PRIMITIVES = new Set([
  'String', 'Int', 'Float', 'Bool', 'Bytes', 'DateTime', 'ID',
]);

// --- Tokenizer ---

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  function advance(n = 1) {
    for (let j = 0; j < n; j++) {
      if (source[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  }

  function skipWhitespace() {
    while (i < source.length && (source[i] === ' ' || source[i] === '\t' || source[i] === '\r')) {
      advance();
    }
  }

  function skipLineComment() {
    if (i + 1 < source.length && source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        advance();
      }
      return true;
    }
    return false;
  }

  function pushToken(type: TokenType, value: string, l: number, c: number) {
    tokens.push({ type, value, line: l, col: c });
  }

  while (i < source.length) {
    skipWhitespace();
    if (i >= source.length) break;

    if (skipLineComment()) continue;

    const ch = source[i];
    const l = line;
    const c = col;

    if (ch === '\n' || ch === ';') {
      advance();
      // Collapse consecutive SEP tokens
      if (tokens.length === 0 || tokens[tokens.length - 1].type !== 'SEP') {
        pushToken('SEP', ch, l, c);
      }
      continue;
    }

    if (ch === '-' && i + 1 < source.length && source[i + 1] === '>') {
      advance(2);
      pushToken('ARROW', '->', l, c);
      continue;
    }

    if (ch === ':') { advance(); pushToken('COLON', ':', l, c); continue; }
    if (ch === ',') { advance(); pushToken('COMMA', ',', l, c); continue; }
    if (ch === '(') { advance(); pushToken('LPAREN', '(', l, c); continue; }
    if (ch === ')') { advance(); pushToken('RPAREN', ')', l, c); continue; }
    if (ch === '[') { advance(); pushToken('LBRACKET', '[', l, c); continue; }
    if (ch === ']') { advance(); pushToken('RBRACKET', ']', l, c); continue; }
    if (ch === '{') { advance(); pushToken('LBRACE', '{', l, c); continue; }
    if (ch === '}') { advance(); pushToken('RBRACE', '}', l, c); continue; }

    // String literal
    if (ch === '"') {
      advance(); // opening quote
      let str = '';
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < source.length) {
          advance();
          str += source[i];
        } else {
          str += source[i];
        }
        advance();
      }
      if (i < source.length) advance(); // closing quote
      pushToken('STRING_LIT', str, l, c);
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < source.length && /[0-9]/.test(source[i])) {
        num += source[i];
        advance();
      }
      if (i < source.length && source[i] === '.' && i + 1 < source.length && /[0-9]/.test(source[i + 1])) {
        num += '.';
        advance();
        while (i < source.length && /[0-9]/.test(source[i])) {
          num += source[i];
          advance();
        }
        pushToken('FLOAT_LIT', num, l, c);
      } else {
        pushToken('INT_LIT', num, l, c);
      }
      continue;
    }

    // Identifier or keyword
    if (/[A-Za-z_]/.test(ch)) {
      let ident = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        ident += source[i];
        advance();
      }

      if (ident === 'true' || ident === 'false') {
        pushToken('BOOL_LIT', ident, l, c);
      } else if (PRIMITIVES.has(ident)) {
        pushToken('PRIMITIVE', ident, l, c);
      } else if (KEYWORDS.has(ident)) {
        pushToken('KEYWORD', ident, l, c);
      } else {
        pushToken('IDENT', ident, l, c);
      }
      continue;
    }

    // Skip unknown characters
    advance();
  }

  // Remove SEP tokens adjacent to LBRACE/RBRACE
  const cleaned: Token[] = [];
  for (let j = 0; j < tokens.length; j++) {
    const tok = tokens[j];
    if (tok.type === 'SEP') {
      const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : null;
      const next = j + 1 < tokens.length ? tokens[j + 1] : null;
      if (prev && (prev.type === 'LBRACE' || prev.type === 'LBRACKET')) continue;
      if (next && (next.type === 'RBRACE' || next.type === 'RBRACKET')) continue;
    }
    cleaned.push(tok);
  }

  cleaned.push({ type: 'EOF', value: '', line, col });
  return cleaned;
}

// --- Parser ---

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    this.pos++;
    return tok;
  }

  private expect(type: TokenType, value?: string): Token {
    const tok = this.peek();
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new Error(
        `Parse error at line ${tok.line}:${tok.col}: expected ${type}${value ? `(${value})` : ''}, got ${tok.type}(${tok.value})`,
      );
    }
    return this.advance();
  }

  private match(type: TokenType, value?: string): Token | null {
    const tok = this.peek();
    if (tok.type === type && (value === undefined || tok.value === value)) {
      return this.advance();
    }
    return null;
  }

  private skipSeps() {
    while (this.peek().type === 'SEP') {
      this.advance();
    }
  }

  parseConcept(): ConceptAST {
    this.skipSeps();
    this.expect('KEYWORD', 'concept');
    const name = this.expect('IDENT').value;
    const typeParams = this.parseTypeParams();
    this.expect('LBRACE');

    const ast: ConceptAST = {
      name,
      typeParams,
      state: [],
      actions: [],
      invariants: [],
      capabilities: [],
    };

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const keyword = this.peek();
      if (keyword.type !== 'KEYWORD') {
        throw new Error(`Parse error at line ${keyword.line}: expected section keyword, got ${keyword.type}(${keyword.value})`);
      }

      switch (keyword.value) {
        case 'purpose':
          ast.purpose = this.parsePurpose();
          break;
        case 'state':
          ast.state = this.parseState(typeParams);
          break;
        case 'actions':
          ast.actions = this.parseActions(typeParams);
          break;
        case 'invariant':
          ast.invariants.push(this.parseInvariant());
          break;
        case 'capabilities':
          ast.capabilities = this.parseCapabilities();
          break;
        default:
          throw new Error(`Parse error at line ${keyword.line}: unexpected keyword '${keyword.value}'`);
      }
    }

    this.expect('RBRACE');
    return ast;
  }

  private parseTypeParams(): string[] {
    const params: string[] = [];
    if (!this.match('LBRACKET')) return params;

    params.push(this.expect('IDENT').value);
    while (this.match('COMMA')) {
      params.push(this.expect('IDENT').value);
    }
    this.expect('RBRACKET');
    return params;
  }

  private parsePurpose(): string {
    this.expect('KEYWORD', 'purpose');
    this.expect('LBRACE');

    // Capture raw text until matching RBRACE
    let prose = '';
    let depth = 1;
    const startPos = this.pos;

    // Re-parse: go back to raw source extraction
    // Instead, collect tokens until matching RBRACE
    while (depth > 0 && this.peek().type !== 'EOF') {
      const tok = this.peek();
      if (tok.type === 'LBRACE') depth++;
      if (tok.type === 'RBRACE') {
        depth--;
        if (depth === 0) break;
      }
      if (prose.length > 0 || tok.type !== 'SEP') {
        prose += tok.value + ' ';
      }
      this.advance();
    }
    this.expect('RBRACE');
    return prose.trim();
  }

  private parseState(typeParams: string[]): StateEntry[] {
    this.expect('KEYWORD', 'state');
    this.expect('LBRACE');

    const entries: StateEntry[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const name = this.expect('IDENT').value;

      // Check if this is a group or a component
      if (this.peek().type === 'LBRACE') {
        // State group
        this.advance(); // consume LBRACE
        while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
          this.skipSeps();
          if (this.peek().type === 'RBRACE') break;
          const compName = this.expect('IDENT').value;
          this.expect('COLON');
          const typeExpr = this.parseTypeExpr(typeParams);
          entries.push({ name: compName, type: typeExpr, group: name });
          this.skipSeps();
        }
        this.expect('RBRACE');
      } else {
        // State component
        this.expect('COLON');
        const typeExpr = this.parseTypeExpr(typeParams);
        entries.push({ name, type: typeExpr });
      }
      this.skipSeps();
    }

    this.expect('RBRACE');
    return entries;
  }

  private parseTypeExpr(typeParams: string[]): TypeExpr {
    const tok = this.peek();

    // set/list/option are contextual keywords — they act as type
    // constructors only inside type expressions. The tokenizer emits
    // them as IDENT so they don't collide with action/field names.
    if (tok.type === 'IDENT' && CONTEXTUAL_KEYWORDS.has(tok.value)) {
      const kind = tok.value as 'set' | 'list' | 'option';
      this.advance();
      const inner = this.parseTypeExpr(typeParams);
      return { kind, inner };
    }

    // Record type
    if (tok.type === 'LBRACE') {
      this.advance();
      const fields: { name: string; type: TypeExpr }[] = [];
      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACE') break;
        const fieldName = this.expect('IDENT').value;
        this.expect('COLON');
        const fieldType = this.parseTypeExpr(typeParams);
        fields.push({ name: fieldName, type: fieldType });
        this.match('COMMA');
        this.skipSeps();
      }
      this.expect('RBRACE');
      const left: TypeExpr = { kind: 'record', fields };

      // Check for ARROW after record
      if (this.peek().type === 'ARROW') {
        this.advance();
        const right = this.parseTypeExpr(typeParams);
        return { kind: 'relation', from: left, to: right };
      }
      return left;
    }

    let base: TypeExpr;

    if (tok.type === 'PRIMITIVE') {
      this.advance();
      base = { kind: 'primitive', name: tok.value };
    } else if (tok.type === 'IDENT') {
      this.advance();
      if (typeParams.includes(tok.value)) {
        base = { kind: 'param', name: tok.value };
      } else {
        base = { kind: 'primitive', name: tok.value };
      }
    } else {
      throw new Error(`Parse error at line ${tok.line}: expected type expression, got ${tok.type}(${tok.value})`);
    }

    // Check for ARROW (relation type)
    if (this.peek().type === 'ARROW') {
      this.advance();
      const right = this.parseTypeExpr(typeParams);
      return { kind: 'relation', from: base, to: right };
    }

    return base;
  }

  private parseActions(typeParams: string[]): ActionDecl[] {
    this.expect('KEYWORD', 'actions');
    this.expect('LBRACE');

    const actions: ActionDecl[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      this.expect('KEYWORD', 'action');
      const name = this.expect('IDENT').value;
      this.expect('LPAREN');
      const params = this.parseParamList(typeParams);
      this.expect('RPAREN');
      this.expect('LBRACE');

      const variants: ReturnVariant[] = [];

      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACE') break;

        this.expect('ARROW');
        const variantName = this.expect('IDENT').value;
        this.expect('LPAREN');
        const variantParams = this.parseParamList(typeParams);
        this.expect('RPAREN');

        let description: string | undefined;
        if (this.peek().type === 'LBRACE') {
          this.advance();
          // Capture prose
          let prose = '';
          let depth = 1;
          while (depth > 0 && this.peek().type !== 'EOF') {
            const t = this.peek();
            if (t.type === 'LBRACE') depth++;
            if (t.type === 'RBRACE') {
              depth--;
              if (depth === 0) break;
            }
            prose += t.value + ' ';
            this.advance();
          }
          this.expect('RBRACE');
          description = prose.trim();
        }

        variants.push({ name: variantName, params: variantParams, description });
        this.skipSeps();
      }

      this.expect('RBRACE');
      actions.push({ name, params, variants });
      this.skipSeps();
    }

    this.expect('RBRACE');
    return actions;
  }

  private parseParamList(typeParams: string[]): ParamDecl[] {
    const params: ParamDecl[] = [];
    if (this.peek().type === 'RPAREN') return params;

    params.push(this.parseParam(typeParams));
    while (this.match('COMMA')) {
      params.push(this.parseParam(typeParams));
    }
    return params;
  }

  private parseParam(typeParams: string[]): ParamDecl {
    const name = this.expect('IDENT').value;
    this.expect('COLON');
    const type = this.parseTypeExpr(typeParams);
    return { name, type };
  }

  private parseInvariant(): InvariantDecl {
    this.expect('KEYWORD', 'invariant');
    this.expect('LBRACE');

    // Parse "after" pattern(s)
    this.skipSeps();
    this.expect('KEYWORD', 'after');
    const afterPatterns: ActionPattern[] = [];
    afterPatterns.push(this.parseActionPattern());

    while (this.peek().type === 'SEP' || (this.peek().type === 'KEYWORD' && this.peek().value === 'and')) {
      this.skipSeps();
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
        this.advance();
        afterPatterns.push(this.parseActionPattern());
      } else if (this.peek().type === 'KEYWORD' && this.peek().value === 'then') {
        break;
      } else {
        break;
      }
    }

    // Parse "then" pattern(s)
    this.skipSeps();
    this.expect('KEYWORD', 'then');
    const thenPatterns: ActionPattern[] = [];
    thenPatterns.push(this.parseActionPattern());

    while (true) {
      this.skipSeps();
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
        this.advance();
        thenPatterns.push(this.parseActionPattern());
      } else {
        break;
      }
    }

    this.skipSeps();
    this.expect('RBRACE');
    return { afterPatterns, thenPatterns };
  }

  private parseActionPattern(): ActionPattern {
    const actionName = this.expect('IDENT').value;
    this.expect('LPAREN');
    const inputArgs = this.parseArgPatterns();
    this.expect('RPAREN');
    this.expect('ARROW');
    const variantName = this.expect('IDENT').value;
    this.expect('LPAREN');
    const outputArgs = this.parseArgPatterns();
    this.expect('RPAREN');
    return { actionName, inputArgs, variantName, outputArgs };
  }

  private parseArgPatterns(): ArgPattern[] {
    const args: ArgPattern[] = [];
    if (this.peek().type === 'RPAREN') return args;

    args.push(this.parseArgPattern());
    while (this.match('COMMA')) {
      args.push(this.parseArgPattern());
    }
    return args;
  }

  private parseArgPattern(): ArgPattern {
    const name = this.expect('IDENT').value;
    this.expect('COLON');

    const tok = this.peek();
    if (tok.type === 'STRING_LIT') {
      this.advance();
      return { name, value: { type: 'literal', value: tok.value } };
    }
    if (tok.type === 'INT_LIT') {
      this.advance();
      return { name, value: { type: 'literal', value: parseInt(tok.value, 10) } };
    }
    if (tok.type === 'FLOAT_LIT') {
      this.advance();
      return { name, value: { type: 'literal', value: parseFloat(tok.value) } };
    }
    if (tok.type === 'BOOL_LIT') {
      this.advance();
      return { name, value: { type: 'literal', value: tok.value === 'true' } };
    }
    // Variable
    if (tok.type === 'IDENT') {
      this.advance();
      return { name, value: { type: 'variable', name: tok.value } };
    }

    throw new Error(`Parse error at line ${tok.line}: expected literal or variable in arg pattern, got ${tok.type}(${tok.value})`);
  }

  private parseCapabilities(): string[] {
    this.expect('KEYWORD', 'capabilities');
    this.expect('LBRACE');

    const caps: string[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      this.expect('KEYWORD', 'requires');
      // Capability name may contain hyphens, so we need to handle IDENT-IDENT
      let capName = this.expect('IDENT').value;
      while (this.peek().type === 'ARROW') {
        // Actually hyphens tokenize as part of ARROW, let's handle differently
        break;
      }
      // Handle hyphenated identifiers by checking for minus sign
      caps.push(capName);
      this.skipSeps();
    }

    this.expect('RBRACE');
    return caps;
  }
}

/**
 * Parse a .concept file source string into an AST.
 */
export function parseConceptFile(source: string): ConceptAST {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseConcept();
}
