// ============================================================
// Clef Kernel - .concept File Parser
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
  InvariantASTStep,
  InvariantAssertion,
  InvariantWhenClause,
  AssertionExpr,
  ActionPattern,
  ArgPattern,
  ArgPatternValue,
  QuantifierBinding,
  QuantifierDomain,
  ActionContract,
  FixtureDecl,
} from '../../../runtime/types.js';

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
  | 'DOT'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'ELLIPSIS'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'AT'
  | 'PIPE'
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
  'then', 'and', 'when', 'in', 'none',
  'example', 'forall', 'always', 'never', 'eventually',
  'given', 'exists', 'ensures', 'not', 'old', 'where',
  'fixture',
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
    // Support both // and # line comments
    if ((i + 1 < source.length && source[i] === '/' && source[i + 1] === '/') || source[i] === '#') {
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

    // Ellipsis (...)
    if (ch === '.' && i + 2 < source.length && source[i + 1] === '.' && source[i + 2] === '.') {
      advance(3);
      pushToken('ELLIPSIS', '...', l, c);
      continue;
    }

    // Dot (must come after ellipsis check)
    if (ch === '.' && !(i + 1 < source.length && source[i + 1] === '.')) {
      advance();
      pushToken('DOT', '.', l, c);
      continue;
    }

    // != (must come before = check)
    if (ch === '!' && i + 1 < source.length && source[i + 1] === '=') {
      advance(2);
      pushToken('NOT_EQUALS', '!=', l, c);
      continue;
    }

    // >=
    if (ch === '>' && i + 1 < source.length && source[i + 1] === '=') {
      advance(2);
      pushToken('GTE', '>=', l, c);
      continue;
    }

    // <=
    if (ch === '<' && i + 1 < source.length && source[i + 1] === '=') {
      advance(2);
      pushToken('LTE', '<=', l, c);
      continue;
    }

    // > (must come after >= check)
    if (ch === '>') { advance(); pushToken('GT', '>', l, c); continue; }

    // < (must come after <= check)
    if (ch === '<') { advance(); pushToken('LT', '<', l, c); continue; }

    // = (must come after != check; single = is used in invariant assertions)
    if (ch === '=') { advance(); pushToken('EQUALS', '=', l, c); continue; }

    // Negative number literal (e.g. -1, -3.14)
    if (ch === '-' && i + 1 < source.length && /[0-9]/.test(source[i + 1])) {
      advance(); // consume '-'
      let num = '-';
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

    if (ch === ':') { advance(); pushToken('COLON', ':', l, c); continue; }
    if (ch === ',') { advance(); pushToken('COMMA', ',', l, c); continue; }
    if (ch === '(') { advance(); pushToken('LPAREN', '(', l, c); continue; }
    if (ch === ')') { advance(); pushToken('RPAREN', ')', l, c); continue; }
    if (ch === '[') { advance(); pushToken('LBRACKET', '[', l, c); continue; }
    if (ch === ']') { advance(); pushToken('RBRACKET', ']', l, c); continue; }
    if (ch === '{') { advance(); pushToken('LBRACE', '{', l, c); continue; }
    if (ch === '}') { advance(); pushToken('RBRACE', '}', l, c); continue; }

    // @ annotation marker
    if (ch === '@') { advance(); pushToken('AT', '@', l, c); continue; }

    // Pipe (used in enum types: {A | B | C})
    if (ch === '|') { advance(); pushToken('PIPE', '|', l, c); continue; }

    // String literal
    if (ch === '"') {
      advance(); // opening quote
      let str = '';
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < source.length) {
          advance();
          const esc = source[i];
          str += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
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

  /**
   * Expect an identifier, but also accept keywords so that spec
   * authors can use words like "concept", "state", "action", etc.
   * as parameter names and field names.
   */
  private expectIdent(): Token {
    const tok = this.peek();
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      return this.advance();
    }
    throw new Error(
      `Parse error at line ${tok.line}:${tok.col}: expected identifier, got ${tok.type}(${tok.value})`,
    );
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

    // Handle top-level annotations before 'concept' keyword (e.g. @version(1), @gate)
    let version: number | undefined;
    const topAnnotations: { gate?: boolean; category?: string; visibility?: string } = {};
    while (this.peek().type === 'AT') {
      this.expect('AT');
      const tok = this.peek();
      if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'version') {
        this.advance();
        this.expect('LPAREN');
        const versionTok = this.expect('INT_LIT');
        version = parseInt(versionTok.value, 10);
        this.expect('RPAREN');
      } else if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'gate') {
        this.advance();
        topAnnotations.gate = true;
      } else if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'category') {
        this.advance();
        this.expect('LPAREN');
        const catTok = this.expect('STRING_LIT');
        topAnnotations.category = catTok.value;
        this.expect('RPAREN');
      } else if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'visibility') {
        this.advance();
        this.expect('LPAREN');
        const visTok = this.expect('STRING_LIT');
        topAnnotations.visibility = visTok.value;
        this.expect('RPAREN');
      } else {
        throw new Error(
          `Parse error at line ${tok.line}:${tok.col}: unknown top-level annotation @${tok.value}`,
        );
      }
      this.skipSeps();
    }

    this.expect('KEYWORD', 'concept');
    const name = this.expectIdent().value;
    const typeParams = this.parseTypeParams();
    this.expect('LBRACE');

    const ast: ConceptAST = {
      name,
      typeParams,
      state: [],
      actions: [],
      invariants: [],
      capabilities: [],
      version,
    };

    // Apply top-level annotations
    if (topAnnotations.gate) {
      ast.annotations = { ...ast.annotations, gate: true };
    }
    if (topAnnotations.category) {
      ast.annotations = { ...ast.annotations, category: topAnnotations.category };
    }
    if (topAnnotations.visibility) {
      ast.annotations = { ...ast.annotations, visibility: topAnnotations.visibility };
    }

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      // Handle @annotations (e.g. @version(3))
      if (this.peek().type === 'AT') {
        this.parseAnnotation(ast);
        continue;
      }

      const keyword = this.peek();
      if (keyword.type !== 'KEYWORD' && keyword.type !== 'IDENT') {
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
          ast.invariants.push(...this.parseInvariant());
          break;
        case 'example':
        case 'forall':
        case 'always':
        case 'never':
        case 'eventually':
          ast.invariants.push(this.parseNamedInvariant(keyword.value as 'example' | 'forall' | 'always' | 'never' | 'eventually'));
          break;
        case 'action':
          // Top-level action contract: `action X { requires: ... ensures: ... }`
          ast.invariants.push(this.parseActionContract());
          break;
        case 'capabilities':
          ast.capabilities = this.parseCapabilities();
          break;
        default:
          // Skip unrecognized sections (e.g. 'types') by consuming the
          // keyword and its brace-delimited body.
          this.advance();
          if (this.peek().type === 'LBRACE') {
            this.advance();
            let depth = 1;
            while (depth > 0 && this.peek().type !== 'EOF') {
              const t = this.advance();
              if (t.type === 'LBRACE') depth++;
              else if (t.type === 'RBRACE') depth--;
            }
          }
          break;
      }
    }

    this.expect('RBRACE');
    return ast;
  }

  /**
   * Parse an @annotation. Supports:
   * - @version(N) — sets the schema version integer
   * - @gate — marks async gate convention
   * - @category("name") — concept category for grouping
   * - @visibility("level") — concept visibility (public/internal/framework)
   */
  private parseAnnotation(ast: ConceptAST): void {
    this.expect('AT');
    const tok = this.peek();
    if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'version') {
      this.advance();
      this.expect('LPAREN');
      const versionTok = this.expect('INT_LIT');
      ast.version = parseInt(versionTok.value, 10);
      this.expect('RPAREN');
    } else if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'gate') {
      this.advance();
      ast.annotations = { ...ast.annotations, gate: true };
    } else if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'category') {
      this.advance();
      this.expect('LPAREN');
      const catTok = this.expect('STRING_LIT');
      ast.annotations = { ...ast.annotations, category: catTok.value };
      this.expect('RPAREN');
    } else if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && tok.value === 'visibility') {
      this.advance();
      this.expect('LPAREN');
      const visTok = this.expect('STRING_LIT');
      ast.annotations = { ...ast.annotations, visibility: visTok.value };
      this.expect('RPAREN');
    } else {
      throw new Error(
        `Parse error at line ${tok.line}:${tok.col}: unknown annotation @${tok.value}`,
      );
    }
    this.skipSeps();
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
    // Normalize: collapse whitespace and strip trailing period
    let result = prose.trim().replace(/\s+/g, ' ');
    if (result.endsWith('.')) {
      result = result.slice(0, -1).trimEnd();
    }
    return result;
  }

  private parseState(typeParams: string[]): StateEntry[] {
    this.expect('KEYWORD', 'state');
    this.expect('LBRACE');

    const entries: StateEntry[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const name = this.expectIdent().value;

      // Check if this is a group or a component
      if (this.peek().type === 'LBRACE') {
        // State group
        this.advance(); // consume LBRACE
        while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
          this.skipSeps();
          if (this.peek().type === 'RBRACE') break;
          const compName = this.expectIdent().value;
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

    // String literal union type: "a" | "b" | "c" (may span multiple lines)
    if (tok.type === 'STRING_LIT' && this.tokens[this.pos + 1]?.type === 'PIPE') {
      const values: string[] = [];
      values.push(this.advance().value);
      while (true) {
        this.skipSeps(); // allow newlines between | continuations
        if (this.peek().type === 'PIPE') {
          this.advance(); // consume PIPE
          this.skipSeps();
          values.push(this.advance().value);
        } else {
          break;
        }
      }
      return { kind: 'enum', values };
    }

    // set/list/option are contextual keywords — they act as type
    // constructors only inside type expressions. The tokenizer emits
    // them as IDENT so they don't collide with action/field names.
    if (tok.type === 'IDENT' && CONTEXTUAL_KEYWORDS.has(tok.value)) {
      const kind = tok.value as 'set' | 'list' | 'option';
      this.advance();
      const inner = this.parseTypeExpr(typeParams);
      return { kind, inner };
    }

    // Record or enum type
    if (tok.type === 'LBRACE') {
      this.advance();
      this.skipSeps();

      // Lookahead: if first ident is followed by PIPE, it's an enum type {A | B | C}
      if (
        (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD' || this.peek().type === 'PRIMITIVE') &&
        this.tokens[this.pos + 1]?.type === 'PIPE'
      ) {
        const values: string[] = [];
        values.push(this.advance().value);
        while (this.peek().type === 'PIPE') {
          this.advance(); // consume PIPE
          this.skipSeps();
          values.push(this.advance().value);
        }
        this.skipSeps();
        this.expect('RBRACE');
        const left: TypeExpr = { kind: 'enum', values };
        if (this.peek().type === 'ARROW') {
          this.advance();
          const right = this.parseTypeExpr(typeParams);
          return { kind: 'relation', from: left, to: right };
        }
        return left;
      }

      const fields: { name: string; type: TypeExpr }[] = [];
      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACE') break;
        const fieldName = this.expectIdent().value;
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
      const name = this.expectIdent().value;
      this.expect('LPAREN');
      const params = this.parseParamList(typeParams);
      this.expect('RPAREN');
      this.expect('LBRACE');

      // Check for optional description { ... } block before variants
      let actionDescription: string | undefined;
      this.skipSeps();
      if (this.peek().type === 'IDENT' && this.peek().value === 'description') {
        this.advance(); // consume 'description'
        this.expect('LBRACE');
        let prose = '';
        let depth = 1;
        while (depth > 0 && this.peek().type !== 'EOF') {
          const t = this.peek();
          if (t.type === 'LBRACE') depth++;
          if (t.type === 'RBRACE') {
            depth--;
            if (depth === 0) break;
          }
          if (prose.length > 0 || t.type !== 'SEP') {
            prose += t.value + ' ';
          }
          this.advance();
        }
        this.expect('RBRACE');
        actionDescription = prose.trim();
      }

      const variants: ReturnVariant[] = [];
      const fixtures: FixtureDecl[] = [];

      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACE') break;

        // Parse fixture declarations: fixture <name> { key: value, ... } [-> variant]
        if (this.peek().type === 'KEYWORD' && this.peek().value === 'fixture') {
          this.advance(); // consume 'fixture'
          const fixtureName = this.expectIdent().value;
          this.expect('LBRACE');
          const input = this.parseFixtureObject();
          this.expect('RBRACE');

          // Parse optional after clause: after fixture_a, fixture_b
          let after: string[] | undefined;
          if ((this.peek().type === 'KEYWORD' || this.peek().type === 'IDENT') && this.peek().value === 'after') {
            this.advance(); // consume 'after'
            after = [this.expectIdent().value];
            while (this.peek().type === 'COMMA') {
              this.advance(); // consume ','
              after.push(this.expectIdent().value);
            }
          }

          let expectedVariant = 'ok';
          if (this.peek().type === 'ARROW') {
            this.advance();
            expectedVariant = this.expectIdent().value;
          }

          fixtures.push({ name: fixtureName, input, expectedVariant, ...(after ? { after } : {}) });
          this.skipSeps();
          continue;
        }

        this.expect('ARROW');
        const variantName = this.expectIdent().value;
        let variantParams: ParamDecl[] = [];
        if (this.peek().type === 'LPAREN') {
          this.advance();
          variantParams = this.parseParamList(typeParams);
          this.expect('RPAREN');
        }

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
      const actionDecl: ActionDecl = { name, params, variants, fixtures };
      if (actionDescription) {
        actionDecl.description = actionDescription;
      }
      actions.push(actionDecl);
      this.skipSeps();
    }

    this.expect('RBRACE');
    return actions;
  }

  /**
   * Parse a fixture object literal: key: value, key: value
   * Values: strings, numbers, booleans, arrays, nested objects.
   * Stops at RBRACE (caller consumes it).
   */
  private parseFixtureObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    this.skipSeps();
    if (this.peek().type === 'RBRACE') return obj;

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;
      // Accept both unquoted identifiers and quoted strings as keys
      const keyTok = this.peek();
      let key: string;
      if (keyTok.type === 'STRING_LIT') {
        key = this.advance().value;
      } else {
        key = this.expectIdent().value;
      }
      this.expect('COLON');
      obj[key] = this.parseFixtureValue();
      // optional comma
      if (this.peek().type === 'COMMA') this.advance();
      this.skipSeps();
    }
    return obj;
  }

  private parseFixtureValue(): unknown {
    const tok = this.peek();
    // String literal
    if (tok.type === 'STRING_LIT') {
      this.advance();
      return tok.value;
    }
    // Number
    if (tok.type === 'NUMBER') {
      this.advance();
      return Number(tok.value);
    }
    // Boolean / null
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      if (tok.value === 'true') { this.advance(); return true; }
      if (tok.value === 'false') { this.advance(); return false; }
      if (tok.value === 'null' || tok.value === 'none') { this.advance(); return null; }
    }
    // Array: [val, val, ...]
    if (tok.type === 'LBRACKET') {
      this.advance();
      const arr: unknown[] = [];
      this.skipSeps();
      while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
        arr.push(this.parseFixtureValue());
        if (this.peek().type === 'COMMA') this.advance();
        this.skipSeps();
      }
      this.expect('RBRACKET');
      return arr;
    }
    // Nested object: { key: val, ... }
    if (tok.type === 'LBRACE') {
      this.advance();
      const nested = this.parseFixtureObject();
      this.expect('RBRACE');
      return nested;
    }
    // Fallback: treat as string
    this.advance();
    return tok.value;
  }

  private parseParamList(typeParams: string[]): ParamDecl[] {
    const params: ParamDecl[] = [];
    this.skipSeps();
    if (this.peek().type === 'RPAREN') return params;

    params.push(this.parseParam(typeParams));
    while (this.match('COMMA')) {
      this.skipSeps(); // Skip newlines after comma in multi-line param lists
      params.push(this.parseParam(typeParams));
    }
    this.skipSeps();
    return params;
  }

  private parseParam(typeParams: string[]): ParamDecl {
    const name = this.expectIdent().value;
    this.expect('COLON');
    const type = this.parseTypeExpr(typeParams);
    return { name, type };
  }

  private parseInvariant(): InvariantDecl[] {
    this.expect('KEYWORD', 'invariant');
    this.expect('LBRACE');

    // Check if this is an invariant block containing named sub-invariants
    // (e.g. invariant { example "name": { ... } always { ... } never { ... } action X { ... } })
    this.skipSeps();
    const tok = this.peek();
    const isNamedSubInvariant = tok.type === 'KEYWORD' && (
      tok.value === 'example' || tok.value === 'forall' ||
      tok.value === 'always' || tok.value === 'never' ||
      tok.value === 'eventually' || tok.value === 'action'
    );

    if (isNamedSubInvariant) {
      // Parse all named sub-invariants inside this invariant block
      const results: InvariantDecl[] = [];
      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACE') break;

        const kw = this.peek();
        if (kw.type === 'KEYWORD' && kw.value === 'action') {
          results.push(this.parseActionContract());
        } else if (kw.type === 'KEYWORD' && (
          kw.value === 'example' || kw.value === 'forall' ||
          kw.value === 'always' || kw.value === 'never' ||
          kw.value === 'eventually'
        )) {
          results.push(this.parseNamedInvariantBody(kw.value as 'example' | 'forall' | 'always' | 'never' | 'eventually'));
        } else {
          // Skip unrecognized tokens inside invariant block
          this.advance();
        }
        this.skipSeps();
      }
      this.expect('RBRACE');
      return results;
    }

    // Standard bare invariant — defaults to kind='example' with no name
    return [this.parseBareInvariantBody()];
  }

  /**
   * Parse a bare invariant body (after/then/and) — the existing syntax.
   * Called when 'invariant {' is followed directly by 'when' or 'after'.
   * Falls back to prose when structured parsing fails.
   */
  private parseBareInvariantBody(): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseBareInvariantBodyStructured();
    } catch {
      // Structured parse failed — fall back to consuming as prose
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'example', afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseBareInvariantBodyStructured(): InvariantDecl {
    // Parse optional name: "string" followed by colon
    this.skipSeps();
    let name: string | undefined;
    if (this.peek().type === 'STRING_LIT') {
      const next = this.tokens[this.pos + 1];
      if (next && next.type === 'COLON') {
        name = this.advance().value;
        this.advance(); // consume colon
      }
    }

    // Parse optional "when" guard clause (before after)
    this.skipSeps();
    let whenClause: InvariantWhenClause | undefined;
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'when') {
      this.advance();
      whenClause = this.parseWhenClause();
      this.skipSeps();
    }

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

    // Parse "then" chain — mixed action patterns and property assertions
    const thenSteps: InvariantASTStep[] = [];
    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'then') {
      this.advance();
      thenSteps.push(this.parseInvariantASTStep());

      while (true) {
        this.skipSeps();
        if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
          this.advance();
          this.skipSeps();
          thenSteps.push(this.parseInvariantASTStep());
        } else if (this.peek().type === 'KEYWORD' && this.peek().value === 'then') {
          this.advance();
          this.skipSeps();
          thenSteps.push(this.parseInvariantASTStep());
        } else {
          break;
        }
      }
    }

    // Parse optional "when" guard clause (can also appear after then)
    if (!whenClause) {
      this.skipSeps();
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'when') {
        this.advance();
        whenClause = this.parseWhenClause();
      }
    }

    this.skipSeps();
    this.expect('RBRACE');
    return { kind: 'example', name, afterPatterns, thenPatterns: thenSteps, whenClause };
  }

  /**
   * Parse a top-level named invariant: `example "name" { ... }` etc.
   * Called when keyword appears at concept body level (not inside invariant {}).
   */
  private parseNamedInvariant(keyword: 'example' | 'forall' | 'always' | 'never' | 'eventually'): InvariantDecl {
    // keyword was already consumed by the switch-case in parseConcept
    return this.parseNamedInvariantBody(keyword);
  }

  /**
   * Parse a named invariant body after the keyword has been identified.
   */
  private parseNamedInvariantBody(keyword: 'example' | 'forall' | 'always' | 'never' | 'eventually'): InvariantDecl {
    this.advance(); // consume the keyword (example/forall/always/never/eventually)

    // Parse optional name: "string"
    let name: string | undefined;
    this.skipSeps();
    if (this.peek().type === 'STRING_LIT') {
      name = this.advance().value;
    }

    // Consume optional colon after name
    this.skipSeps();
    if (this.peek().type === 'COLON') {
      this.advance();
    }

    this.skipSeps();
    this.expect('LBRACE');

    if (keyword === 'example') {
      // example "name": { after ... then ... } — same as bare invariant
      const result = this.parseBareInvariantBody();
      return { ...result, kind: 'example', name };
    }

    if (keyword === 'forall') {
      return this.parseForallBody(name);
    }

    if (keyword === 'always') {
      return this.parseAlwaysBody(name);
    }

    if (keyword === 'never') {
      return this.parseNeverBody(name);
    }

    if (keyword === 'eventually') {
      return this.parseEventuallyBody(name);
    }

    // Shouldn't reach here, but consume to closing brace as fallback
    this.skipToClosingBrace();
    return { kind: keyword, name, afterPatterns: [], thenPatterns: [] };
  }

  /**
   * Parse forall body: `given x in {set} after ... then ...`
   * Falls back to prose when structured parsing fails.
   */
  private parseForallBody(name?: string): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseForallBodyStructured(name);
    } catch {
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'forall', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseForallBodyStructured(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];

    // Parse given bindings
    this.skipSeps();
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'given') {
      this.advance(); // consume 'given'
      quantifiers.push(this.parseQuantifierBinding());
      this.skipSeps();
    }

    // Parse after/then like a bare invariant, but don't consume closing brace
    const afterPatterns: ActionPattern[] = [];
    const thenSteps: InvariantASTStep[] = [];
    let whenClause: InvariantWhenClause | undefined;

    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'after') {
      this.advance();
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
    }

    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'then') {
      this.advance();
      thenSteps.push(this.parseInvariantASTStep());
      while (true) {
        this.skipSeps();
        if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
          this.advance(); this.skipSeps();
          thenSteps.push(this.parseInvariantASTStep());
        } else { break; }
      }
    }

    this.skipSeps();
    this.expect('RBRACE');
    return { kind: 'forall', name, afterPatterns, thenPatterns: thenSteps, quantifiers, whenClause };
  }

  /**
   * Parse always body: `forall p in state_field: predicate`
   * Falls back to prose when structured parsing fails.
   */
  private parseAlwaysBody(name?: string): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseAlwaysBodyStructured(name);
    } catch {
      // Structured parse failed — fall back to consuming as prose
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'always', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseAlwaysBodyStructured(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    this.skipSeps();
    // Parse: forall p in field: predicate
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'forall') {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    // Parse colon-separated predicate
    this.skipSeps();
    if (this.peek().type === 'COLON') {
      this.advance();
    }

    this.skipSeps();
    // Parse predicate as assertion(s)
    while (this.peek().type !== 'RBRACE') {
      thenSteps.push(this.parseInvariantASTStep());
      this.skipSeps();
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
        this.advance();
        this.skipSeps();
      }
    }

    this.expect('RBRACE');
    return { kind: 'always', name, afterPatterns: [], thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse never body: `exists p in state_field: bad_predicate`
   * Falls back to prose when structured parsing fails.
   */
  private parseNeverBody(name?: string): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseNeverBodyStructured(name);
    } catch {
      // Structured parse failed — fall back to consuming as prose
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'never', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseNeverBodyStructured(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && (this.peek().value === 'exists' || this.peek().value === 'forall')) {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    this.skipSeps();
    if (this.peek().type === 'COLON') {
      this.advance();
    }

    this.skipSeps();
    while (this.peek().type !== 'RBRACE') {
      thenSteps.push(this.parseInvariantASTStep());
      this.skipSeps();
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
        this.advance();
        this.skipSeps();
      }
    }

    this.expect('RBRACE');
    return { kind: 'never', name, afterPatterns: [], thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse eventually body: `forall r where cond: outcome`
   * Falls back to prose when structured parsing fails.
   */
  private parseEventuallyBody(name?: string): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseEventuallyBodyStructured(name);
    } catch {
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'eventually', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseEventuallyBodyStructured(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'forall') {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    this.skipSeps();
    if (this.peek().type === 'COLON') {
      this.advance();
    }

    this.skipSeps();
    while (this.peek().type !== 'RBRACE') {
      thenSteps.push(this.parseInvariantASTStep());
      this.skipSeps();
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
        this.advance();
        this.skipSeps();
      }
    }

    this.expect('RBRACE');
    return { kind: 'eventually', name, afterPatterns: [], thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse action requires/ensures contract block:
   * `action X { requires: P  ensures ok: Q }`
   * Also handles prose-style: `action X requires { prose } ensures { prose }`
   * Falls back to prose when structured parsing fails.
   */
  private parseActionContract(): InvariantDecl {
    this.advance(); // consume 'action'
    const targetAction = this.expectIdent().value;

    // Check for prose-style: `action X requires { ... } ensures { ... }`
    // (no LBRACE immediately after action name — instead 'requires' or 'ensures' keyword)
    if (this.peek().type === 'KEYWORD' && (this.peek().value === 'requires' || this.peek().value === 'ensures')) {
      // Prose-style contract — consume all brace blocks until we're done
      while (this.peek().type === 'KEYWORD' && (this.peek().value === 'requires' || this.peek().value === 'ensures')) {
        this.advance(); // consume requires/ensures
        if (this.peek().type === 'LBRACE') {
          this.advance(); // consume LBRACE
          this.skipToClosingBrace();
        }
        this.skipSeps();
      }
      return {
        kind: 'requires_ensures',
        targetAction,
        afterPatterns: [],
        thenPatterns: [],
        contracts: [],
      };
    }

    // Stray action declaration: `action X(params) { variants }`
    // This is a misplaced action decl at concept body level — consume it.
    if (this.peek().type === 'LPAREN') {
      // Skip params
      this.advance(); // consume LPAREN
      let parenDepth = 1;
      while (parenDepth > 0 && this.peek().type !== 'EOF') {
        const t = this.advance();
        if (t.type === 'LPAREN') parenDepth++;
        else if (t.type === 'RPAREN') parenDepth--;
      }
      // Skip the brace-delimited body if present
      if (this.peek().type === 'LBRACE') {
        this.advance();
        this.skipToClosingBrace();
      }
      return {
        kind: 'requires_ensures',
        targetAction,
        afterPatterns: [],
        thenPatterns: [],
        contracts: [],
      };
    }

    this.expect('LBRACE');

    const savedPos = this.pos;
    try {
      return this.parseActionContractStructured(targetAction);
    } catch {
      // Structured parse failed — fall back to consuming as prose
      this.pos = savedPos;
      this.skipToClosingBrace();
      return {
        kind: 'requires_ensures',
        targetAction,
        afterPatterns: [],
        thenPatterns: [],
        contracts: [],
      };
    }
  }

  private parseActionContractStructured(targetAction: string): InvariantDecl {
    const contracts: ActionContract[] = [];
    this.skipSeps();

    while (this.peek().type !== 'RBRACE') {
      const kw = this.peek();
      if (kw.type === 'KEYWORD' && kw.value === 'requires') {
        this.advance();
        if (this.peek().type === 'COLON') this.advance();
        this.skipSeps();
        const predicate = this.parseAssertion();
        contracts.push({ kind: 'requires', predicate });
      } else if (kw.type === 'KEYWORD' && kw.value === 'ensures') {
        this.advance();
        // Parse optional variant name
        let variant: string | undefined;
        this.skipSeps();
        if (this.peek().type === 'IDENT' || (this.peek().type === 'KEYWORD' && this.peek().value !== 'requires' && this.peek().value !== 'ensures')) {
          const next = this.tokens[this.pos + 1];
          if (next && next.type === 'COLON') {
            variant = this.advance().value;
            this.advance(); // consume colon
          }
        }
        if (!variant && this.peek().type === 'COLON') {
          this.advance();
        }
        this.skipSeps();
        const predicate = this.parseAssertion();
        contracts.push({ kind: 'ensures', variant, predicate });
      } else {
        // Skip unrecognized tokens
        this.advance();
      }
      this.skipSeps();
    }

    this.expect('RBRACE');
    return {
      kind: 'requires_ensures',
      targetAction,
      afterPatterns: [],
      thenPatterns: [],
      contracts,
    };
  }

  /**
   * Parse a quantifier binding: `x in {set}` or `p in state_field`
   * or `r in runs where condition`
   */
  private parseQuantifierBinding(): QuantifierBinding {
    const variable = this.expectIdent().value;

    this.skipSeps();
    this.expect('KEYWORD', 'in');
    this.skipSeps();

    const domain = this.parseQuantifierDomain();

    // Optional where clause
    let whereCondition: InvariantAssertion | undefined;
    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'where') {
      this.advance();
      this.skipSeps();
      whereCondition = this.parseAssertion();
    }

    return { variable, domain, whereCondition };
  }

  /**
   * Parse a quantifier domain: `{set}`, `state_field`, or `Type`.
   */
  private parseQuantifierDomain(): QuantifierDomain {
    const tok = this.peek();

    // Set literal: {"a", "b", "c"} or {a, b, c}
    if (tok.type === 'LBRACE') {
      this.advance();
      const values: string[] = [];
      this.skipSeps();
      while (this.peek().type !== 'RBRACE') {
        if (this.peek().type === 'STRING_LIT') {
          values.push(this.advance().value);
        } else if (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') {
          values.push(this.advance().value);
        } else {
          this.advance(); // skip unexpected
        }
        this.skipSeps();
        if (this.peek().type === 'COMMA') this.advance();
        this.skipSeps();
      }
      this.expect('RBRACE');
      return { type: 'set_literal', values };
    }

    // State field reference or type reference
    const name = this.expectIdent().value;
    if (name[0] === name[0].toUpperCase() && name.length > 1) {
      return { type: 'type_ref', name };
    }
    return { type: 'state_field', name };
  }

  /**
   * Skip tokens until matching closing brace (for error recovery).
   */
  private skipToClosingBrace(): void {
    let depth = 1;
    while (depth > 0 && this.pos < this.tokens.length) {
      const tok = this.advance();
      if (tok.type === 'LBRACE') depth++;
      if (tok.type === 'RBRACE') depth--;
    }
  }

  /**
   * Parse one step in a then-chain: either an action pattern (starts with
   * ident followed by LPAREN) or a property assertion (starts with ident
   * followed by DOT or comparison operator).
   */
  private parseInvariantASTStep(): InvariantASTStep {
    // Lookahead to determine if this is an action pattern or assertion.
    // Action patterns: name(...) -> variant(...)
    // Assertions: var.field op value, var op value, var in expr
    const tok = this.peek();
    const next = this.tokens[this.pos + 1];

    // Dot-access: check if it's action.variant(args) pattern or assertion
    if (
      (tok.type === 'IDENT' || tok.type === 'KEYWORD') &&
      next?.type === 'DOT'
    ) {
      // Look further: ident.ident( means action.variant(args) pattern
      const afterDot = this.tokens[this.pos + 2];
      const afterAfterDot = this.tokens[this.pos + 3];
      if (
        afterDot && (afterDot.type === 'IDENT' || afterDot.type === 'KEYWORD') &&
        afterAfterDot && afterAfterDot.type === 'LPAREN'
      ) {
        // Parse as action.variant(args) — an action result pattern
        const actionName = this.advance().value; // action name
        this.advance(); // consume DOT
        const variantName = this.advance().value; // variant name
        this.advance(); // consume LPAREN
        const outputArgs = this.parseArgPatterns();
        this.expect('RPAREN');
        return { kind: 'action', actionName, inputArgs: [], variantName, outputArgs };
      }
      return { kind: 'assertion', ...this.parseAssertion() };
    }

    // Comparison assertion: var op value (where op is =, !=, >, <, >=, <=, in, not in)
    if (
      (tok.type === 'IDENT' || tok.type === 'KEYWORD') &&
      next && (
        next.type === 'EQUALS' || next.type === 'NOT_EQUALS' ||
        next.type === 'GT' || next.type === 'GTE' ||
        next.type === 'LT' || next.type === 'LTE' ||
        (next.type === 'KEYWORD' && next.value === 'in') ||
        (next.type === 'KEYWORD' && next.value === 'not')
      )
    ) {
      return { kind: 'assertion', ...this.parseAssertion() };
    }

    // Action pattern
    return { kind: 'action', ...this.parseActionPattern() };
  }

  /**
   * Parse a property assertion: `left op right`
   * left/right can be: var.field, literal, variable, list, none
   */
  private parseAssertion(): InvariantAssertion {
    const left = this.parseAssertionExpr();
    const op = this.parseComparisonOp();
    const right = this.parseAssertionExpr();
    return { left, operator: op, right };
  }

  private parseAssertionExpr(): AssertionExpr {
    const tok = this.peek();

    // none literal
    if (tok.type === 'KEYWORD' && tok.value === 'none') {
      this.advance();
      return { type: 'literal', value: null };
    }

    // String literal
    if (tok.type === 'STRING_LIT') {
      this.advance();
      return { type: 'literal', value: tok.value };
    }

    // Number literal
    if (tok.type === 'INT_LIT') {
      this.advance();
      return { type: 'literal', value: parseInt(tok.value, 10) };
    }
    if (tok.type === 'FLOAT_LIT') {
      this.advance();
      return { type: 'literal', value: parseFloat(tok.value) };
    }

    // Bool literal
    if (tok.type === 'BOOL_LIT') {
      this.advance();
      return { type: 'literal', value: tok.value === 'true' };
    }

    // List literal: [...]
    if (tok.type === 'LBRACKET') {
      this.advance();
      const items: AssertionExpr[] = [];
      if (this.peek().type !== 'RBRACKET') {
        items.push(this.parseAssertionExpr());
        while (this.match('COMMA')) {
          items.push(this.parseAssertionExpr());
        }
      }
      this.expect('RBRACKET');
      return { type: 'list', items };
    }

    // Identifier — could be var.field or just a variable
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      this.advance();
      if (this.peek().type === 'DOT') {
        this.advance(); // consume DOT
        const field = this.advance().value; // field name
        return { type: 'dot_access', variable: tok.value, field };
      }
      return { type: 'variable', name: tok.value };
    }

    throw new Error(
      `Parse error at line ${tok.line}:${tok.col}: expected assertion expression, got ${tok.type}(${tok.value})`,
    );
  }

  private parseComparisonOp(): InvariantAssertion['operator'] {
    const tok = this.peek();
    switch (tok.type) {
      case 'EQUALS': this.advance(); return '=';
      case 'NOT_EQUALS': this.advance(); return '!=';
      case 'GT': this.advance(); return '>';
      case 'LT': this.advance(); return '<';
      case 'GTE': this.advance(); return '>=';
      case 'LTE': this.advance(); return '<=';
      case 'KEYWORD':
        if (tok.value === 'in') { this.advance(); return 'in'; }
        // `not in` operator
        if (tok.value === 'not') {
          const next = this.tokens[this.pos + 1];
          if (next && next.type === 'KEYWORD' && next.value === 'in') {
            this.advance(); // consume 'not'
            this.advance(); // consume 'in'
            return 'not in' as InvariantAssertion['operator'];
          }
        }
        break;
    }
    throw new Error(
      `Parse error at line ${tok.line}:${tok.col}: expected comparison operator, got ${tok.type}(${tok.value})`,
    );
  }

  /**
   * Parse a `when` guard clause: conditions joined by `and`.
   * Each condition is an assertion (e.g. `f1.module_id = f2.module_id`).
   */
  private parseWhenClause(): InvariantWhenClause {
    const conditions: InvariantAssertion[] = [];
    conditions.push(this.parseAssertion());
    while (true) {
      this.skipSeps();
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
        this.advance();
        this.skipSeps();
        conditions.push(this.parseAssertion());
      } else {
        break;
      }
    }
    return { conditions };
  }

  private parseActionPattern(): ActionPattern {
    this.skipSeps(); // Skip newlines before action name (e.g. after 'and' keyword)
    const actionName = this.expectIdent().value;
    // Input params are optional: `action(args) -> variant` or `action -> variant`
    let inputArgs: ArgPattern[] = [];
    if (this.peek().type === 'LPAREN') {
      this.advance();
      inputArgs = this.parseArgPatterns();
      this.expect('RPAREN');
    }
    this.skipSeps(); // Skip newlines before -> in multi-line invariant steps
    // Arrow and variant are optional: `action(args)` without result is valid
    let variantName = '';
    let outputArgs: ArgPattern[] = [];
    if (this.peek().type === 'ARROW') {
      this.advance();
      variantName = this.expectIdent().value;
      // Variant params are optional: `-> ok()` or `-> ok` or `-> ok(field: val)`
      if (this.peek().type === 'LPAREN') {
        this.advance();
        outputArgs = this.parseArgPatterns();
        this.expect('RPAREN');
      }
    }
    return { actionName, inputArgs, variantName, outputArgs };
  }

  private parseArgPatterns(): ArgPattern[] {
    const args: ArgPattern[] = [];
    this.skipSeps();
    if (this.peek().type === 'RPAREN') return args;

    args.push(this.parseArgPattern());
    while (this.match('COMMA')) {
      this.skipSeps(); // Skip newlines after comma in multi-line arg lists
      if (this.peek().type === 'RPAREN') break; // trailing comma
      args.push(this.parseArgPattern());
    }
    this.skipSeps();
    return args;
  }

  private parseArgPattern(): ArgPattern {
    // Spread: ...
    if (this.peek().type === 'ELLIPSIS') {
      this.advance();
      return { name: '...', value: { type: 'spread' } };
    }

    const name = this.expectIdent().value;
    this.expect('COLON');
    const value = this.parseArgPatternValue();
    return { name, value };
  }

  private parseArgPatternValue(): ArgPatternValue {
    const tok = this.peek();

    // Spread operator: ...
    if (tok.type === 'ELLIPSIS') {
      this.advance();
      return { type: 'spread' };
    }

    // none literal
    if (tok.type === 'KEYWORD' && tok.value === 'none') {
      this.advance();
      return { type: 'literal', value: false }; // represent none as false for compat
    }

    if (tok.type === 'STRING_LIT') {
      this.advance();
      return { type: 'literal', value: tok.value };
    }
    if (tok.type === 'INT_LIT') {
      this.advance();
      return { type: 'literal', value: parseInt(tok.value, 10) };
    }
    if (tok.type === 'FLOAT_LIT') {
      this.advance();
      return { type: 'literal', value: parseFloat(tok.value) };
    }
    if (tok.type === 'BOOL_LIT') {
      this.advance();
      return { type: 'literal', value: tok.value === 'true' };
    }
    // Record literal: { field: value, field: value, ... }
    if (tok.type === 'LBRACE') {
      this.advance();
      this.skipSeps();
      const fields: ArgPattern[] = [];
      if (this.peek().type !== 'RBRACE') {
        fields.push(this.parseArgPattern());
        while (this.match('COMMA')) {
          this.skipSeps();
          if (this.peek().type === 'RBRACE') break;
          fields.push(this.parseArgPattern());
        }
      }
      this.skipSeps();
      this.expect('RBRACE');
      return { type: 'record', fields };
    }
    // List literal: [value, value, ...]
    if (tok.type === 'LBRACKET') {
      this.advance();
      this.skipSeps();
      const items: ArgPatternValue[] = [];
      if (this.peek().type !== 'RBRACKET') {
        items.push(this.parseArgPatternValue());
        while (this.match('COMMA')) {
          this.skipSeps();
          if (this.peek().type === 'RBRACKET') break;
          items.push(this.parseArgPatternValue());
        }
      }
      this.skipSeps();
      this.expect('RBRACKET');
      return { type: 'list', items };
    }
    // Identifier — could be variable or dot-access (b.hash)
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      this.advance();
      // Check for dot-access: var.field
      if (this.peek().type === 'DOT') {
        this.advance(); // consume DOT
        const field = this.advance().value;
        return { type: 'dot_access', variable: tok.value, field };
      }
      return { type: 'variable', name: tok.value };
    }
    // Wildcard: _  (underscore is parsed as IDENT, but handle primitive types too)
    if (tok.type === 'PRIMITIVE') {
      // Primitives used as variable names in arg patterns (e.g. named param values)
      this.advance();
      return { type: 'variable', name: tok.value };
    }

    throw new Error(`Parse error at line ${tok.line}:${tok.col}: expected literal, variable, record, or list in arg pattern, got ${tok.type}(${tok.value})`);
  }

  private parseCapabilities(): string[] {
    this.expect('KEYWORD', 'capabilities');
    this.expect('LBRACE');

    const caps: string[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      this.expect('KEYWORD', 'requires');
      // Handle hyphenated capability names (e.g. persistent-storage).
      // The tokenizer drops '-' as an unknown character, leaving consecutive IDENTs.
      let capName = this.expectIdent().value;
      while (this.peek().type === 'IDENT') {
        capName += '-' + this.advance().value;
      }
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
