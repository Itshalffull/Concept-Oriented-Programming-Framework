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
  FixtureDecl,
} from '../../../runtime/types.js';
import {
  InvariantBodyParser,
  CONCEPT_OPTIONS,
  type AssertionContext,
  type BasicToken,
  type TokenStream,
} from './invariant-body-parser.js';

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
  | 'DOLLAR'
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
  // Scenario-kind invariant keywords (MAG-912 / INV-8)
  'scenario', 'settlement', 'assert',
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

    if (ch === '$') {
      advance();
      pushToken('DOLLAR', '$', l, c);
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
        case 'scenario':
          ast.invariants.push(this.parseNamedInvariant(keyword.value as 'example' | 'forall' | 'always' | 'never' | 'eventually' | 'scenario'));
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
      let reversal: string | undefined;

      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACE') break;

        // Parse reversal declaration: reversal: actionName | reversal: none
        if ((this.peek().type === 'KEYWORD' || this.peek().type === 'IDENT') && this.peek().value === 'reversal') {
          this.advance(); // consume 'reversal'
          this.expect('COLON');
          reversal = this.expectIdent().value;
          this.skipSeps();
          continue;
        }

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
      if (reversal !== undefined) {
        actionDecl.reversal = reversal;
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
    // Fixture output reference: $fixtureName.field
    if (tok.type === 'DOLLAR') {
      this.advance(); // consume '$'
      const refFixture = this.expectIdent().value;
      this.expect('DOT');
      const refField = this.expectIdent().value;
      return { type: 'ref', fixture: refFixture, field: refField };
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

  // ================================================================
  // Invariant parsing — delegated to shared InvariantBodyParser.
  // The concept parser historically owned ~900 lines of invariant body
  // parsing; that logic now lives in invariant-body-parser.ts behind a
  // TokenStream adapter, parameterised for the concept-grammar flavour.
  // See docs/plans/invariant-grammar-portability-prd.md (MAG-910).
  // ================================================================

  private conceptInvariantContext(): AssertionContext {
    return {
      resolveIdentifier: (name: string) => {
        // Action names are the primary concept-level identifiers that
        // an invariant assertion can reference. The parser itself only
        // consults this for diagnostics; semantic validation runs later.
        return { kind: 'action', action: name };
      },
      declaredSymbols: () => [],
    };
  }

  private makeInvariantBodyParser(): InvariantBodyParser {
    const stream: TokenStream = {
      peek: () => this.tokens[this.pos] as BasicToken,
      peekAt: (offset: number) => this.tokens[this.pos + offset] as BasicToken | undefined,
      advance: () => this.advance() as unknown as BasicToken,
      expect: (type: string, value?: string) =>
        this.expect(type as TokenType, value) as unknown as BasicToken,
      match: (type: string, value?: string) =>
        (this.match(type as TokenType, value) as unknown as BasicToken | null),
      expectIdent: () => this.expectIdent() as unknown as BasicToken,
      skipSeps: () => this.skipSeps(),
      position: () => this.pos,
      seek: (pos: number) => { this.pos = pos; },
    };
    return new InvariantBodyParser(stream, this.conceptInvariantContext(), CONCEPT_OPTIONS);
  }

  private parseInvariant(): InvariantDecl[] {
    this.expect('KEYWORD', 'invariant');
    this.expect('LBRACE');
    return this.makeInvariantBodyParser().parseInvariantBlock();
  }

  /**
   * Parse a top-level named invariant: `example "name" { ... }` etc.
   * Called when keyword appears at concept body level (not inside `invariant {}`).
   */
  private parseNamedInvariant(
    keyword: 'example' | 'forall' | 'always' | 'never' | 'eventually' | 'scenario',
  ): InvariantDecl {
    return this.makeInvariantBodyParser().parseNamedInvariantBody(keyword);
  }

  /**
   * Parse top-level `action X { requires / ensures }` contract.
   */
  private parseActionContract(): InvariantDecl {
    return this.makeInvariantBodyParser().parseActionContract();
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
