// ============================================================
// COPF Kernel - .sync File Parser
// ============================================================

import type { CompiledSync, WhenPattern, FieldPattern, WhereEntry, ThenAction, ThenField } from '../../../kernel/src/types.js';

// --- Token Types ---

type TokenType =
  | 'KEYWORD'
  | 'IDENT'
  | 'STRING_LIT'
  | 'INT_LIT'
  | 'FLOAT_LIT'
  | 'BOOL_LIT'
  | 'ARROW'
  | 'FAT_ARROW'
  | 'COLON'
  | 'COMMA'
  | 'SEMICOLON'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'SLASH'
  | 'QUESTION'
  | 'DOT'
  | 'SEP'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const SYNC_KEYWORDS = new Set([
  'sync', 'when', 'where', 'then', 'bind', 'filter',
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
    if (i + 1 < source.length && source[i] === '#') {
      while (i < source.length && source[i] !== '\n') advance();
      return true;
    }
    if (i + 1 < source.length && source[i] === '/' && source[i + 1] === '/') {
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

    if (ch === '\n') {
      advance();
      if (tokens.length === 0 || tokens[tokens.length - 1].type !== 'SEP') {
        tokens.push({ type: 'SEP', value: '\n', line: l, col: c });
      }
      continue;
    }

    if (ch === '=' && i + 1 < source.length && source[i + 1] === '>') {
      advance(2);
      tokens.push({ type: 'FAT_ARROW', value: '=>', line: l, col: c });
      continue;
    }

    if (ch === '-' && i + 1 < source.length && source[i + 1] === '>') {
      advance(2);
      tokens.push({ type: 'ARROW', value: '->', line: l, col: c });
      continue;
    }

    if (ch === '?') { advance(); tokens.push({ type: 'QUESTION', value: '?', line: l, col: c }); continue; }
    if (ch === '.') { advance(); tokens.push({ type: 'DOT', value: '.', line: l, col: c }); continue; }
    if (ch === '/') { advance(); tokens.push({ type: 'SLASH', value: '/', line: l, col: c }); continue; }
    if (ch === ':') { advance(); tokens.push({ type: 'COLON', value: ':', line: l, col: c }); continue; }
    if (ch === ',') { advance(); tokens.push({ type: 'COMMA', value: ',', line: l, col: c }); continue; }
    if (ch === ';') { advance(); tokens.push({ type: 'SEMICOLON', value: ';', line: l, col: c }); continue; }
    if (ch === '(') { advance(); tokens.push({ type: 'LPAREN', value: '(', line: l, col: c }); continue; }
    if (ch === ')') { advance(); tokens.push({ type: 'RPAREN', value: ')', line: l, col: c }); continue; }
    if (ch === '[') { advance(); tokens.push({ type: 'LBRACKET', value: '[', line: l, col: c }); continue; }
    if (ch === ']') { advance(); tokens.push({ type: 'RBRACKET', value: ']', line: l, col: c }); continue; }
    if (ch === '{') { advance(); tokens.push({ type: 'LBRACE', value: '{', line: l, col: c }); continue; }
    if (ch === '}') { advance(); tokens.push({ type: 'RBRACE', value: '}', line: l, col: c }); continue; }

    if (ch === '"') {
      advance();
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
      if (i < source.length) advance();
      tokens.push({ type: 'STRING_LIT', value: str, line: l, col: c });
      continue;
    }

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

    if (/[A-Za-z_]/.test(ch)) {
      let ident = '';
      // Allow hyphens in identifiers for capability names and annotation names
      while (i < source.length && /[A-Za-z0-9_-]/.test(source[i])) {
        ident += source[i];
        advance();
      }

      if (ident === 'true' || ident === 'false') {
        tokens.push({ type: 'BOOL_LIT', value: ident, line: l, col: c });
      } else if (SYNC_KEYWORDS.has(ident)) {
        tokens.push({ type: 'KEYWORD', value: ident, line: l, col: c });
      } else {
        tokens.push({ type: 'IDENT', value: ident, line: l, col: c });
      }
      continue;
    }

    advance(); // skip unknown
  }

  // Clean SEPs adjacent to braces/brackets
  const cleaned: Token[] = [];
  for (let j = 0; j < tokens.length; j++) {
    const tok = tokens[j];
    if (tok.type === 'SEP') {
      const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : null;
      const next = j + 1 < tokens.length ? tokens[j + 1] : null;
      if (prev && (prev.type === 'LBRACE' || prev.type === 'LBRACKET')) continue;
      if (next && (next.type === 'RBRACE' || next.type === 'RBRACKET')) continue;
      // Collapse consecutive SEPs
      if (prev && prev.type === 'SEP') continue;
    }
    cleaned.push(tok);
  }

  cleaned.push({ type: 'EOF', value: '', line, col });
  return cleaned;
}

// --- Parser ---

class SyncFileParser {
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
        `Sync parse error at line ${tok.line}:${tok.col}: expected ${type}${value ? `(${value})` : ''}, got ${tok.type}(${tok.value})`,
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
    while (this.peek().type === 'SEP' || this.peek().type === 'SEMICOLON') {
      this.advance();
    }
  }

  parseFile(): CompiledSync[] {
    const syncs: CompiledSync[] = [];

    while (this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'EOF') break;
      syncs.push(this.parseSyncDecl());
    }

    return syncs;
  }

  private parseSyncDecl(): CompiledSync {
    this.expect('KEYWORD', 'sync');
    const name = this.expect('IDENT').value;

    // Parse optional annotations
    const annotations: string[] = [];
    while (this.match('LBRACKET')) {
      annotations.push(this.expect('IDENT').value);
      this.expect('RBRACKET');
    }

    this.skipSeps();

    // Parse optional purpose metadata: purpose: "description string"
    let purpose: string | undefined;
    if (this.peek().type === 'IDENT' && this.peek().value === 'purpose') {
      this.advance(); // consume 'purpose'
      this.expect('COLON');
      purpose = this.expect('STRING_LIT').value;
      this.skipSeps();
    }

    // Parse when clause
    const when = this.parseWhenClause();

    this.skipSeps();

    // Parse optional where clause
    let where: WhereEntry[] = [];
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'where') {
      where = this.parseWhereClause();
    }

    this.skipSeps();

    // Parse then clause
    const then = this.parseThenClause();

    const result: CompiledSync = { name, annotations, when, where, then };
    if (purpose) result.purpose = purpose;
    return result;
  }

  private parseWhenClause(): WhenPattern[] {
    this.expect('KEYWORD', 'when');
    this.expect('LBRACE');

    const patterns: WhenPattern[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      // Parse ConceptAction: Concept/Action
      const concept = this.parseConceptRef();
      this.expect('SLASH');
      const action = this.expect('IDENT').value;

      this.expect('COLON');

      // Parse input fields: [ field: ?var; ... ]
      this.expect('LBRACKET');
      const inputFields = this.parseFieldPatterns();
      this.expect('RBRACKET');

      // Parse => output fields: => [ field: ?var; ... ]
      // Skip any separators (newlines) between ] and =>
      this.skipSeps();
      this.expect('FAT_ARROW');
      this.skipSeps();
      this.expect('LBRACKET');
      const outputFields = this.parseFieldPatterns();
      this.expect('RBRACKET');

      patterns.push({
        concept: `urn:copf/${concept}`,
        action,
        inputFields,
        outputFields,
      });

      this.skipSeps();
    }

    this.expect('RBRACE');
    return patterns;
  }

  private parseConceptRef(): string {
    let ref = this.expect('IDENT').value;
    // Handle dotted names like Phone.Profile
    while (this.match('DOT')) {
      ref += '.' + this.expect('IDENT').value;
    }
    return ref;
  }

  private parseFieldPatterns(): FieldPattern[] {
    const fields: FieldPattern[] = [];

    while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACKET') break;

      const name = this.expect('IDENT').value;
      this.expect('COLON');

      let match: FieldPattern['match'];

      if (this.peek().type === 'QUESTION') {
        // Variable: ?name
        this.advance();
        const varName = this.expect('IDENT').value;
        match = { type: 'variable', name: varName };
      } else if (this.peek().type === 'STRING_LIT') {
        match = { type: 'literal', value: this.advance().value };
      } else if (this.peek().type === 'INT_LIT') {
        match = { type: 'literal', value: parseInt(this.advance().value, 10) };
      } else if (this.peek().type === 'FLOAT_LIT') {
        match = { type: 'literal', value: parseFloat(this.advance().value) };
      } else if (this.peek().type === 'BOOL_LIT') {
        match = { type: 'literal', value: this.advance().value === 'true' };
      } else if (this.peek().type === 'IDENT' && this.peek().value === '_') {
        this.advance();
        match = { type: 'wildcard' };
      } else {
        throw new Error(`Sync parse error at line ${this.peek().line}: expected field value, got ${this.peek().type}(${this.peek().value})`);
      }

      fields.push({ name, match });

      this.match('SEMICOLON');
      this.skipSeps();
    }

    return fields;
  }

  private parseWhereClause(): WhereEntry[] {
    this.expect('KEYWORD', 'where');
    this.expect('LBRACE');

    const entries: WhereEntry[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      if (this.peek().type === 'KEYWORD' && this.peek().value === 'bind') {
        entries.push(this.parseBindExpr());
      } else if (this.peek().type === 'KEYWORD' && this.peek().value === 'filter') {
        entries.push(this.parseFilterExpr());
      } else {
        entries.push(this.parseConceptQuery());
      }

      this.skipSeps();
    }

    this.expect('RBRACE');
    return entries;
  }

  private parseBindExpr(): WhereEntry {
    this.expect('KEYWORD', 'bind');
    this.expect('LPAREN');

    // Parse expression like uuid() or some other expr
    let expr = '';
    while (this.peek().type !== 'IDENT' || this.peek().value !== 'as') {
      expr += this.advance().value;
    }
    expr = expr.trim();

    this.expect('IDENT'); // 'as'
    this.expect('QUESTION');
    const varName = this.expect('IDENT').value;
    this.expect('RPAREN');

    return { type: 'bind', expr, as: varName };
  }

  private parseFilterExpr(): WhereEntry {
    this.expect('KEYWORD', 'filter');
    this.expect('LPAREN');

    let expr = '';
    let depth = 1;
    while (depth > 0 && this.peek().type !== 'EOF') {
      if (this.peek().type === 'LPAREN') depth++;
      if (this.peek().type === 'RPAREN') {
        depth--;
        if (depth === 0) break;
      }
      expr += this.advance().value + ' ';
    }
    this.expect('RPAREN');

    return { type: 'filter', expr: expr.trim() };
  }

  private parseConceptQuery(): WhereEntry {
    // Concept: { ?var field: value }
    const concept = this.parseConceptRef();
    this.expect('COLON');
    this.expect('LBRACE');

    const bindings: { variable: string; field: string }[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      if (this.peek().type === 'QUESTION') {
        // ?var field: value pattern
        this.advance();
        const varName = this.expect('IDENT').value;

        // Next should be field: value pairs
        while (this.peek().type === 'IDENT') {
          const field = this.expect('IDENT').value;
          this.expect('COLON');

          if (this.peek().type === 'QUESTION') {
            this.advance();
            const valVar = this.expect('IDENT').value;
            bindings.push({ variable: valVar, field });
          } else {
            // literal — skip for now
            this.advance();
          }
          this.match('SEMICOLON');
          this.skipSeps();
        }

        // The first variable is the key binding
        bindings.unshift({ variable: varName, field: '__key' });
      } else {
        // field: value
        const field = this.expect('IDENT').value;
        this.expect('COLON');
        if (this.peek().type === 'QUESTION') {
          this.advance();
          const varName = this.expect('IDENT').value;
          bindings.push({ variable: varName, field });
        } else {
          this.advance();
        }
        this.match('SEMICOLON');
      }
      this.skipSeps();
    }

    this.expect('RBRACE');

    return {
      type: 'query',
      concept: `urn:copf/${concept}`,
      bindings,
    };
  }

  private parseThenClause(): ThenAction[] {
    this.expect('KEYWORD', 'then');
    this.expect('LBRACE');

    const actions: ThenAction[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const concept = this.parseConceptRef();
      this.expect('SLASH');
      const action = this.expect('IDENT').value;

      this.expect('COLON');
      this.expect('LBRACKET');

      const fields: ThenField[] = [];
      while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACKET') break;

        const name = this.expect('IDENT').value;
        this.expect('COLON');

        let value: ThenField['value'];
        if (this.peek().type === 'QUESTION') {
          this.advance();
          const varName = this.expect('IDENT').value;
          value = { type: 'variable', name: varName };
        } else if (this.peek().type === 'STRING_LIT') {
          value = { type: 'literal', value: this.advance().value };
        } else if (this.peek().type === 'INT_LIT') {
          value = { type: 'literal', value: parseInt(this.advance().value, 10) };
        } else if (this.peek().type === 'FLOAT_LIT') {
          value = { type: 'literal', value: parseFloat(this.advance().value) };
        } else if (this.peek().type === 'BOOL_LIT') {
          value = { type: 'literal', value: this.advance().value === 'true' };
        } else if (this.peek().type === 'LBRACKET') {
          // Nested object literal: [ key: value; ... ]
          value = { type: 'literal', value: this.parseNestedObject() };
        } else if (this.peek().type === 'LBRACE') {
          // Nested object literal: { key: value; ... }
          value = { type: 'literal', value: this.parseNestedObjectBraces() };
        } else {
          throw new Error(`Sync parse error at line ${this.peek().line}: expected then field value, got ${this.peek().type}(${this.peek().value})`);
        }

        fields.push({ name, value });

        this.match('SEMICOLON');
        this.skipSeps();
      }

      this.expect('RBRACKET');
      actions.push({ concept: `urn:copf/${concept}`, action, fields });
      this.skipSeps();
    }

    this.expect('RBRACE');
    return actions;
  }

  private parseNestedObjectBraces(): Record<string, unknown> {
    this.expect('LBRACE');
    const obj: Record<string, unknown> = {};

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const key = this.expect('IDENT').value;
      this.expect('COLON');

      if (this.peek().type === 'QUESTION') {
        this.advance();
        const varName = this.expect('IDENT').value;
        obj[key] = `{{${varName}}}`;
      } else if (this.peek().type === 'STRING_LIT') {
        obj[key] = this.advance().value;
      } else if (this.peek().type === 'INT_LIT') {
        obj[key] = parseInt(this.advance().value, 10);
      } else if (this.peek().type === 'BOOL_LIT') {
        obj[key] = this.advance().value === 'true';
      } else if (this.peek().type === 'LBRACE') {
        obj[key] = this.parseNestedObjectBraces();
      } else if (this.peek().type === 'LBRACKET') {
        obj[key] = this.parseNestedObject();
      } else {
        obj[key] = this.advance().value;
      }

      this.match('SEMICOLON');
      this.skipSeps();
    }

    this.expect('RBRACE');
    return obj;
  }

  private parseNestedObject(): Record<string, unknown> {
    this.expect('LBRACKET');
    const obj: Record<string, unknown> = {};

    while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACKET') break;

      const key = this.expect('IDENT').value;
      this.expect('COLON');

      if (this.peek().type === 'QUESTION') {
        this.advance();
        const varName = this.expect('IDENT').value;
        // Store as template variable reference
        obj[key] = `{{${varName}}}`;
      } else if (this.peek().type === 'STRING_LIT') {
        obj[key] = this.advance().value;
      } else if (this.peek().type === 'INT_LIT') {
        obj[key] = parseInt(this.advance().value, 10);
      } else if (this.peek().type === 'BOOL_LIT') {
        obj[key] = this.advance().value === 'true';
      } else if (this.peek().type === 'LBRACKET') {
        obj[key] = this.parseNestedObject();
      } else {
        obj[key] = this.advance().value;
      }

      this.match('SEMICOLON');
      this.skipSeps();
    }

    this.expect('RBRACKET');
    return obj;
  }
}

/**
 * Parse a .sync file source string into compiled sync definitions.
 */
export function parseSyncFile(source: string): CompiledSync[] {
  const tokens = tokenize(source);
  const parser = new SyncFileParser(tokens);
  return parser.parseFile();
}
