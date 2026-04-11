// ============================================================
// Clef Kernel - .view File Parser
// Tokenizer + Recursive Descent Parser for view manifest files
// Section 16.x: View Invariant Declaration
// ============================================================

import type {
  InvariantDecl,
  InvariantAssertion,
  InvariantASTStep,
  InvariantWhenClause,
  QuantifierBinding,
  QuantifierDomain,
  AssertionExpr,
  ActionPattern,
  ArgPattern,
  ArgPatternValue,
} from '../../../runtime/types.js';

// --- ViewSpec AST ---

export interface ViewSpec {
  name: string;
  shell: string;
  purpose: string;
  invariants: InvariantDecl[];
}

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
  | 'SLASH'
  | 'DOT'
  | 'PIPE'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'SEP'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

// Keywords recognized in .view files
const KEYWORDS = new Set([
  'view', 'shell', 'purpose', 'invariants',
  'always', 'never', 'example', 'forall', 'exists',
  'in', 'implies', 'and', 'then', 'after', 'action',
  'requires', 'ensures', 'compile', 'startsWith', 'subset',
  'given', 'where', 'none', 'eventually',
]);

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
      if (source[i] === '\n') { line++; col = 1; } else { col++; }
      i++;
    }
  }

  function skipWhitespace() {
    while (i < source.length && (source[i] === ' ' || source[i] === '\t' || source[i] === '\r')) {
      advance();
    }
  }

  function skipLineComment() {
    // // style comments
    if (i + 1 < source.length && source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') advance();
      return true;
    }
    // # style comments
    if (source[i] === '#') {
      while (i < source.length && source[i] !== '\n') advance();
      return true;
    }
    return false;
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
      if (tokens.length === 0 || tokens[tokens.length - 1].type !== 'SEP') {
        tokens.push({ type: 'SEP', value: ch, line: l, col: c });
      }
      continue;
    }

    // Multi-char operators
    if (ch === '-' && i + 1 < source.length && source[i + 1] === '>') {
      advance(2);
      tokens.push({ type: 'ARROW', value: '->', line: l, col: c });
      continue;
    }
    if (ch === '!' && i + 1 < source.length && source[i + 1] === '=') {
      advance(2);
      tokens.push({ type: 'NOT_EQUALS', value: '!=', line: l, col: c });
      continue;
    }
    if (ch === '>' && i + 1 < source.length && source[i + 1] === '=') {
      advance(2);
      tokens.push({ type: 'GTE', value: '>=', line: l, col: c });
      continue;
    }
    if (ch === '<' && i + 1 < source.length && source[i + 1] === '=') {
      advance(2);
      tokens.push({ type: 'LTE', value: '<=', line: l, col: c });
      continue;
    }

    // Single-char operators and punctuation
    if (ch === '>') { advance(); tokens.push({ type: 'GT', value: '>', line: l, col: c }); continue; }
    if (ch === '<') { advance(); tokens.push({ type: 'LT', value: '<', line: l, col: c }); continue; }
    if (ch === '=') { advance(); tokens.push({ type: 'EQUALS', value: '=', line: l, col: c }); continue; }
    if (ch === '/') { advance(); tokens.push({ type: 'SLASH', value: '/', line: l, col: c }); continue; }
    if (ch === '.') { advance(); tokens.push({ type: 'DOT', value: '.', line: l, col: c }); continue; }
    if (ch === ':') { advance(); tokens.push({ type: 'COLON', value: ':', line: l, col: c }); continue; }
    if (ch === ',') { advance(); tokens.push({ type: 'COMMA', value: ',', line: l, col: c }); continue; }
    if (ch === '(') { advance(); tokens.push({ type: 'LPAREN', value: '(', line: l, col: c }); continue; }
    if (ch === ')') { advance(); tokens.push({ type: 'RPAREN', value: ')', line: l, col: c }); continue; }
    if (ch === '[') { advance(); tokens.push({ type: 'LBRACKET', value: '[', line: l, col: c }); continue; }
    if (ch === ']') { advance(); tokens.push({ type: 'RBRACKET', value: ']', line: l, col: c }); continue; }
    if (ch === '{') { advance(); tokens.push({ type: 'LBRACE', value: '{', line: l, col: c }); continue; }
    if (ch === '}') { advance(); tokens.push({ type: 'RBRACE', value: '}', line: l, col: c }); continue; }
    if (ch === '|') { advance(); tokens.push({ type: 'PIPE', value: '|', line: l, col: c }); continue; }

    // String literal
    if (ch === '"') {
      advance();
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
      if (i < source.length) advance(); // consume closing "
      tokens.push({ type: 'STRING_LIT', value: str, line: l, col: c });
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < source.length && /[0-9]/.test(source[i])) { num += source[i]; advance(); }
      if (i < source.length && source[i] === '.' && i + 1 < source.length && /[0-9]/.test(source[i + 1])) {
        num += '.'; advance();
        while (i < source.length && /[0-9]/.test(source[i])) { num += source[i]; advance(); }
        tokens.push({ type: 'FLOAT_LIT', value: num, line: l, col: c });
      } else {
        tokens.push({ type: 'INT_LIT', value: num, line: l, col: c });
      }
      continue;
    }

    // Identifier or keyword (allow hyphens for compound names)
    if (/[A-Za-z_]/.test(ch)) {
      let ident = '';
      while (i < source.length && /[A-Za-z0-9_-]/.test(source[i])) {
        ident += source[i];
        advance();
      }
      if (ident === 'true' || ident === 'false') {
        tokens.push({ type: 'BOOL_LIT', value: ident, line: l, col: c });
      } else if (PRIMITIVES.has(ident)) {
        tokens.push({ type: 'PRIMITIVE', value: ident, line: l, col: c });
      } else if (KEYWORDS.has(ident)) {
        tokens.push({ type: 'KEYWORD', value: ident, line: l, col: c });
      } else {
        tokens.push({ type: 'IDENT', value: ident, line: l, col: c });
      }
      continue;
    }

    advance(); // skip unknown characters
  }

  // Clean up SEPs adjacent to braces/brackets to reduce noise
  const cleaned: Token[] = [];
  for (let j = 0; j < tokens.length; j++) {
    const tok = tokens[j];
    if (tok.type === 'SEP') {
      const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : null;
      const next = j + 1 < tokens.length ? tokens[j + 1] : null;
      if (prev && (prev.type === 'LBRACE' || prev.type === 'LBRACKET')) continue;
      if (next && (next.type === 'RBRACE' || next.type === 'RBRACKET')) continue;
      if (prev && prev.type === 'SEP') continue;
    }
    cleaned.push(tok);
  }

  cleaned.push({ type: 'EOF', value: '', line, col });
  return cleaned;
}

// --- Parser ---

class ViewParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType, value?: string): Token {
    const tok = this.peek();
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new Error(
        `View parse error at line ${tok.line}:${tok.col}: expected ${type}${value ? `(${value})` : ''}, got ${tok.type}(${tok.value})`,
      );
    }
    return this.advance();
  }

  private expectIdent(): Token {
    const tok = this.peek();
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD' || tok.type === 'PRIMITIVE') {
      return this.advance();
    }
    throw new Error(
      `View parse error at line ${tok.line}:${tok.col}: expected identifier, got ${tok.type}(${tok.value})`,
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
    while (this.peek().type === 'SEP') this.advance();
  }

  // ---

  parseViewSpec(): ViewSpec {
    this.skipSeps();
    this.expect('KEYWORD', 'view');
    this.skipSeps();

    // View name is a string literal
    const nameTok = this.peek();
    if (nameTok.type !== 'STRING_LIT') {
      throw new Error(
        `View parse error at line ${nameTok.line}:${nameTok.col}: expected string literal (view name), got ${nameTok.type}(${nameTok.value})`,
      );
    }
    const name = this.advance().value;

    this.skipSeps();
    this.expect('LBRACE');

    let shell = '';
    let purpose = '';
    const invariants: InvariantDecl[] = [];

    this.skipSeps();
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      const tok = this.peek();

      if (tok.type === 'KEYWORD' && tok.value === 'shell') {
        shell = this.parseShell();
      } else if (tok.type === 'KEYWORD' && tok.value === 'purpose') {
        purpose = this.parsePurpose();
      } else if (tok.type === 'KEYWORD' && tok.value === 'invariants') {
        const parsed = this.parseInvariantsBlock();
        invariants.push(...parsed);
      } else if (tok.type === 'RBRACE') {
        break;
      } else {
        // Skip unrecognized tokens
        this.advance();
      }
      this.skipSeps();
    }

    this.expect('RBRACE');

    if (!shell) {
      throw new Error(`View parse error: missing required 'shell' declaration in view "${name}"`);
    }

    return { name, shell, purpose, invariants };
  }

  private parseShell(): string {
    this.expect('KEYWORD', 'shell');
    this.skipSeps();
    this.expect('COLON');
    this.skipSeps();
    const tok = this.peek();
    if (tok.type !== 'STRING_LIT') {
      throw new Error(
        `View parse error at line ${tok.line}:${tok.col}: expected string literal for shell, got ${tok.type}(${tok.value})`,
      );
    }
    return this.advance().value;
  }

  private parsePurpose(): string {
    this.expect('KEYWORD', 'purpose');
    this.skipSeps();
    this.expect('LBRACE');

    // Collect all tokens until matching RBRACE as free text
    const parts: string[] = [];
    let depth = 1;
    while (depth > 0 && this.peek().type !== 'EOF') {
      const tok = this.peek();
      if (tok.type === 'LBRACE') depth++;
      if (tok.type === 'RBRACE') {
        depth--;
        if (depth === 0) break;
      }
      parts.push(this.advance().value);
    }
    this.expect('RBRACE');

    // Join tokens with spaces and normalize whitespace
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private parseInvariantsBlock(): InvariantDecl[] {
    this.expect('KEYWORD', 'invariants');
    this.skipSeps();
    this.expect('LBRACE');

    const results: InvariantDecl[] = [];

    this.skipSeps();
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const kw = this.peek();
      if (
        kw.type === 'KEYWORD' &&
        (kw.value === 'always' || kw.value === 'never' || kw.value === 'example' ||
         kw.value === 'forall' || kw.value === 'eventually')
      ) {
        results.push(this.parseNamedInvariantBody(kw.value as 'always' | 'never' | 'example' | 'forall' | 'eventually'));
      } else if (kw.type === 'KEYWORD' && kw.value === 'action') {
        results.push(this.parseActionContract());
      } else {
        // Skip unrecognized tokens inside invariants block
        this.advance();
      }
      this.skipSeps();
    }

    this.expect('RBRACE');
    return results;
  }

  /**
   * Parse a named invariant after its keyword is identified:
   * `always "name": { ... }`, `never "name": { ... }`, etc.
   */
  private parseNamedInvariantBody(
    keyword: 'example' | 'forall' | 'always' | 'never' | 'eventually',
  ): InvariantDecl {
    this.advance(); // consume the keyword

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

    switch (keyword) {
      case 'example':
        return this.parseExampleBody(name);
      case 'forall':
        return this.parseForallBody(name);
      case 'always':
        return this.parseAlwaysBody(name);
      case 'never':
        return this.parseNeverBody(name);
      case 'eventually':
        return this.parseEventuallyBody(name);
    }
  }

  /**
   * Parse an `example` body: `after compile then <assertions...>`.
   * View example invariants use `after compile` as the setup step
   * since views have no concept actions to invoke as setup.
   */
  private parseExampleBody(name?: string): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseExampleBodyStructured(name);
    } catch {
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'example', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseExampleBodyStructured(name?: string): InvariantDecl {
    this.skipSeps();

    // Parse `after compile` — the setup clause for view examples
    const afterPatterns: ActionPattern[] = [];
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'after') {
      this.advance(); // consume 'after'
      this.skipSeps();
      // 'compile' is treated as a special view setup marker
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'compile') {
        this.advance(); // consume 'compile'
        afterPatterns.push({
          actionName: 'compile',
          inputArgs: [],
          variantName: 'ok',
          outputArgs: [],
        });
      }
    }

    // Parse `then <assertions...> [and <assertions...>]*`
    const thenSteps: InvariantASTStep[] = [];
    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'then') {
      this.advance(); // consume 'then'
      this.skipSeps();
      thenSteps.push(this.parseInvariantStep());

      while (true) {
        this.skipSeps();
        if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
          this.advance(); // consume 'and'
          this.skipSeps();
          thenSteps.push(this.parseInvariantStep());
        } else {
          break;
        }
      }
    }

    this.skipSeps();
    this.expect('RBRACE');
    return { kind: 'example', name, afterPatterns, thenPatterns: thenSteps };
  }

  /**
   * Parse `always` body: a predicate that must always hold.
   * Supports: `forall x in col: predicate` or bare predicates.
   */
  private parseAlwaysBody(name?: string): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseAlwaysBodyStructured(name);
    } catch {
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'always', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseAlwaysBodyStructured(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    this.skipSeps();
    // Parse optional `forall x in col:` quantifier
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'forall') {
      this.advance(); // consume 'forall'
      quantifiers.push(this.parseQuantifierBinding());
      this.skipSeps();
      if (this.peek().type === 'COLON') {
        this.advance(); // consume ':'
      }
    }

    // Parse predicate assertion(s)
    this.skipSeps();
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      thenSteps.push(this.parseInvariantStep());
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
   * Parse `never` body: a predicate that must never hold.
   * Supports: `exists x in col: predicate` or bare predicates.
   */
  private parseNeverBody(name?: string): InvariantDecl {
    const savedPos = this.pos;
    try {
      return this.parseNeverBodyStructured(name);
    } catch {
      this.pos = savedPos;
      this.skipToClosingBrace();
      return { kind: 'never', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseNeverBodyStructured(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    this.skipSeps();
    // Parse optional `exists x in col:` quantifier
    if (
      this.peek().type === 'KEYWORD' &&
      (this.peek().value === 'exists' || this.peek().value === 'forall')
    ) {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
      this.skipSeps();
      if (this.peek().type === 'COLON') {
        this.advance();
      }
    }

    // Parse predicate assertion(s)
    this.skipSeps();
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      thenSteps.push(this.parseInvariantStep());
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
   * Parse `forall` body: a universally quantified invariant.
   * `forall { given n in {...} after ... then ... }`
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
    const thenSteps: InvariantASTStep[] = [];
    const afterPatterns: ActionPattern[] = [];

    this.skipSeps();
    // Parse `given x in {...}` bindings
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'given') {
      this.advance(); // consume 'given'
      quantifiers.push(this.parseQuantifierBinding());
      this.skipSeps();
    }

    // Parse optional `after ...` setup
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'after') {
      this.advance();
      // View forall invariants may not have action patterns — skip to then
      this.skipSeps();
    }

    // Parse `then <assertions>`
    this.skipSeps();
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'then') {
      this.advance();
      this.skipSeps();
      thenSteps.push(this.parseInvariantStep());
      while (true) {
        this.skipSeps();
        if (this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
          this.advance(); this.skipSeps();
          thenSteps.push(this.parseInvariantStep());
        } else { break; }
      }
    }

    this.skipSeps();
    this.expect('RBRACE');
    return { kind: 'forall', name, afterPatterns, thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse `eventually` body: a liveness invariant.
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
      this.skipSeps();
      if (this.peek().type === 'COLON') this.advance();
    }

    this.skipSeps();
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      thenSteps.push(this.parseInvariantStep());
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
   * Parse an `action` requires/ensures contract block.
   */
  private parseActionContract(): InvariantDecl {
    this.advance(); // consume 'action'
    const targetAction = this.expectIdent().value;

    this.skipSeps();
    // Handle prose-style: `action X requires { ... } ensures { ... }`
    if (
      this.peek().type === 'KEYWORD' &&
      (this.peek().value === 'requires' || this.peek().value === 'ensures')
    ) {
      while (
        this.peek().type === 'KEYWORD' &&
        (this.peek().value === 'requires' || this.peek().value === 'ensures')
      ) {
        this.advance();
        if (this.peek().type === 'LBRACE') {
          this.advance();
          this.skipToClosingBrace();
        }
        this.skipSeps();
      }
      return { kind: 'requires_ensures', targetAction, afterPatterns: [], thenPatterns: [], contracts: [] };
    }

    this.expect('LBRACE');
    this.skipToClosingBrace();
    return { kind: 'requires_ensures', targetAction, afterPatterns: [], thenPatterns: [], contracts: [] };
  }

  /**
   * Parse a quantifier binding: `x in {set}` or `x in stateField`.
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
   * Parse a quantifier domain: `{set_literal}`, `stateField`, or bracket list.
   */
  private parseQuantifierDomain(): QuantifierDomain {
    const tok = this.peek();

    // Set literal: {"a", "b"} or {a, b}
    if (tok.type === 'LBRACE') {
      this.advance();
      const values: string[] = [];
      this.skipSeps();
      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
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
   * Parse a single invariant step: either a property assertion or an action pattern.
   *
   * View invariants use assertion steps primarily. Supported forms:
   *   - Simple equality:  `purity = "read-only"`, `invokeCount = 0`
   *   - Set emptiness:    `invokedActions != {}`, `uncoveredVariants = []`
   *   - Set membership:   `"Task/escalate" in invokedActions`, `f in sourceFields`
   *   - String prefix:    `ia startsWith "Task/"` (view-specific operator)
   *   - Subset:           `projectedFields subset readFields` (view-specific operator)
   *   - Quantifiers:      `forall f in readFields: <predicate>`
   *   - Implication:      `... implies ...`
   */
  private parseInvariantStep(): InvariantASTStep {
    // Inline forall within a step body: `forall x in col: predicate`
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'forall') {
      return this.parseInlineForallStep();
    }

    return { kind: 'assertion', ...this.parseAssertion() };
  }

  /**
   * Parse an inline forall as an assertion step.
   * `forall f in projectedFields: f in ["id", "node", "kind"]`
   * Represented as a quantified assertion in thenPatterns.
   */
  private parseInlineForallStep(): InvariantASTStep {
    this.advance(); // consume 'forall'
    const variable = this.expectIdent().value;
    this.skipSeps();
    this.expect('KEYWORD', 'in');
    this.skipSeps();
    const domain = this.parseQuantifierDomain();
    this.skipSeps();
    if (this.peek().type === 'COLON') {
      this.advance(); // consume ':'
    }
    this.skipSeps();
    const predicate = this.parseAssertion();

    // Encode as an assertion with variable on left, domain as right,
    // and use the inner predicate as the operator annotation.
    // We use 'in' as the structural operator to match the QuantifierBinding pattern.
    // The predicate is stored inline via the variable name encoding.
    // Represent: forall <var> in <domain>: <predicate>
    // As: { left: { type: 'variable', name: 'forall:<var>:<domain>' }, operator: 'in', right: ... }
    // This is a faithful encoding that test generators can decode.
    const domainStr =
      domain.type === 'state_field' ? domain.name :
      domain.type === 'type_ref' ? domain.name :
      `{${(domain as { values: string[] }).values.join(',')}}`;

    return {
      kind: 'assertion',
      left: { type: 'variable', name: `forall:${variable}:${domainStr}` },
      operator: 'in' as InvariantAssertion['operator'],
      right: {
        type: 'variable',
        name: JSON.stringify({
          variable,
          domain,
          predicate,
        }),
      },
    };
  }

  /**
   * Parse a property assertion with support for view-specific operators.
   *
   * Supported operators:
   *   Standard: =  !=  >  <  >=  <=  in  not in
   *   View-specific: startsWith  subset  implies
   *
   * View-specific operators are encoded using the standard `InvariantAssertion`
   * type by casting the operator string. Test generators understand these encodings.
   */
  private parseAssertion(): InvariantAssertion {
    const left = this.parseAssertionExpr();
    this.skipSeps();
    const op = this.parseAssertionOperator();
    this.skipSeps();
    const right = this.parseAssertionExpr();
    return { left, operator: op, right };
  }

  private parseAssertionOperator(): InvariantAssertion['operator'] {
    const tok = this.peek();

    switch (tok.type) {
      case 'EQUALS':   this.advance(); return '=';
      case 'NOT_EQUALS': this.advance(); return '!=';
      case 'GT':       this.advance(); return '>';
      case 'LT':       this.advance(); return '<';
      case 'GTE':      this.advance(); return '>=';
      case 'LTE':      this.advance(); return '<=';
      case 'KEYWORD':
        if (tok.value === 'in') { this.advance(); return 'in'; }
        if (tok.value === 'not') {
          const next = this.tokens[this.pos + 1];
          if (next && next.type === 'KEYWORD' && next.value === 'in') {
            this.advance(); // consume 'not'
            this.advance(); // consume 'in'
            return 'not in' as InvariantAssertion['operator'];
          }
        }
        // View-specific: `startsWith` operator
        if (tok.value === 'startsWith') {
          this.advance();
          return 'startsWith' as InvariantAssertion['operator'];
        }
        // View-specific: `subset` operator
        if (tok.value === 'subset') {
          this.advance();
          return 'subset' as InvariantAssertion['operator'];
        }
        // View-specific: `implies` logical connective
        if (tok.value === 'implies') {
          this.advance();
          return 'implies' as InvariantAssertion['operator'];
        }
        break;
      case 'IDENT':
        // Allow identifiers that are view-specific operators
        if (tok.value === 'startsWith') {
          this.advance();
          return 'startsWith' as InvariantAssertion['operator'];
        }
        if (tok.value === 'subset') {
          this.advance();
          return 'subset' as InvariantAssertion['operator'];
        }
        if (tok.value === 'implies') {
          this.advance();
          return 'implies' as InvariantAssertion['operator'];
        }
        break;
    }

    throw new Error(
      `View parse error at line ${tok.line}:${tok.col}: expected comparison operator (=, !=, >, <, >=, <=, in, not in, startsWith, subset, implies), got ${tok.type}(${tok.value})`,
    );
  }

  /**
   * Parse an assertion expression — the operand in a comparison.
   *
   * Supports:
   *   - String literals:  "read-only"
   *   - Number literals:  0, 42
   *   - Bool literals:    true, false
   *   - `none` (null)
   *   - Empty list:       []
   *   - List literal:     ["a", "b", "c"]
   *   - Empty set:        {}
   *   - Variable:         purity, invokedActions, f
   *   - Dot access:       d.status
   */
  private parseAssertionExpr(): AssertionExpr {
    const tok = this.peek();

    // none (null literal)
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

    // List literal: ["a", "b"] or empty []
    if (tok.type === 'LBRACKET') {
      this.advance();
      const items: AssertionExpr[] = [];
      this.skipSeps();
      if (this.peek().type !== 'RBRACKET') {
        items.push(this.parseAssertionExpr());
        while (this.match('COMMA')) {
          this.skipSeps();
          items.push(this.parseAssertionExpr());
        }
      }
      this.expect('RBRACKET');
      return { type: 'list', items };
    }

    // Empty set: {} — represents an empty set/object literal
    // Encoded as an empty list for compatibility with AssertionExpr
    if (tok.type === 'LBRACE') {
      this.advance();
      this.skipSeps();
      this.expect('RBRACE');
      return { type: 'list', items: [] };
    }

    // Identifier (variable or dot access)
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD' || tok.type === 'PRIMITIVE') {
      this.advance();
      this.skipSeps();
      if (this.peek().type === 'DOT') {
        this.advance(); // consume DOT
        const fieldTok = this.advance();
        return { type: 'dot_access', variable: tok.value, field: fieldTok.value };
      }
      return { type: 'variable', name: tok.value };
    }

    throw new Error(
      `View parse error at line ${tok.line}:${tok.col}: expected assertion expression (literal, variable, list, or set), got ${tok.type}(${tok.value})`,
    );
  }

  /**
   * Skip tokens until the matching closing brace (for error recovery).
   */
  private skipToClosingBrace(): void {
    let depth = 1;
    while (depth > 0 && this.pos < this.tokens.length) {
      const tok = this.advance();
      if (tok.type === 'LBRACE') depth++;
      if (tok.type === 'RBRACE') depth--;
    }
  }
}

// --- Public API ---

/**
 * Parse a `.view` manifest file and return its AST.
 *
 * A `.view` file declares a view name, the shell it corresponds to,
 * and a set of declarative invariants over the compiled QueryProgram.
 *
 * Example:
 * ```
 * view "content-list" {
 *   shell: "content-list"
 *
 *   invariants {
 *     always "purity is read-only": {
 *       purity = "read-only"
 *     }
 *
 *     never "invoke instructions present": {
 *       invokedActions != {}
 *     }
 *   }
 * }
 * ```
 *
 * @throws Error if the source is syntactically invalid or missing `shell`.
 */
export function parseViewFile(source: string): ViewSpec {
  const tokens = tokenize(source);
  const parser = new ViewParser(tokens);
  return parser.parseViewSpec();
}
