// ============================================================
// Clef Kernel - .sync File Parser
// ============================================================

import type { CompiledSync, WhenPattern, FieldPattern, WhereEntry, ThenAction, ThenField } from '../../../runtime/types.js';

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
  | 'EQUALS'
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

    if (ch === '=' && (i + 1 >= source.length || source[i + 1] !== '>')) {
      advance();
      tokens.push({ type: 'EQUALS', value: '=', line: l, col: c });
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

  private peekAt(offset: number): Token | null {
    const idx = this.pos + offset;
    return idx < this.tokens.length ? this.tokens[idx] : null;
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

  /** Expect an identifier, but also accept keywords used as identifiers (e.g. "sync" as action name). */
  private expectIdent(): Token {
    const tok = this.peek();
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      return this.advance();
    }
    throw new Error(
      `Sync parse error at line ${tok.line}:${tok.col}: expected identifier, got ${tok.type}(${tok.value})`,
    );
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

    // Parse optional purpose metadata: purpose: "string" or purpose { prose }
    let purpose: string | undefined;
    if (this.peek().type === 'IDENT' && this.peek().value === 'purpose') {
      this.advance(); // consume 'purpose'
      if (this.match('LBRACE')) {
        // Brace-delimited prose: purpose { text here }
        let prose = '';
        let depth = 1;
        while (depth > 0 && this.peek().type !== 'EOF') {
          if (this.peek().type === 'LBRACE') depth++;
          if (this.peek().type === 'RBRACE') {
            depth--;
            if (depth === 0) break;
          }
          if (prose.length > 0 || this.peek().type !== 'SEP') {
            prose += this.peek().value + ' ';
          }
          this.advance();
        }
        this.expect('RBRACE');
        purpose = prose.trim();
      } else {
        this.expect('COLON');
        purpose = this.expect('STRING_LIT').value;
      }
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

    // Parse then clause(s) — some syncs have multiple sequential then blocks
    let then: ThenAction[] = this.parseThenClause();
    this.skipSeps();
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'then') {
      then = then.concat(this.parseThenClause());
      this.skipSeps();
    }

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

      // Parse ConceptAction: Concept/Action (supports ?variable for dynamic dispatch)
      let concept: string;
      if (this.peek().type === 'QUESTION') {
        this.advance();
        concept = `?${this.expectIdent().value}`;
      } else {
        concept = this.parseConceptRef();
      }
      this.expect('SLASH');
      let action: string;
      if (this.peek().type === 'QUESTION') {
        this.advance();
        action = `?${this.expectIdent().value}`;
      } else {
        action = this.expectIdent().value;
      }

      this.expect('COLON');

      // Parse input fields: [ field: ?var; ... ]
      this.expect('LBRACKET');
      const inputFields = this.parseFieldPatterns();
      this.expect('RBRACKET');

      // Parse => output: various formats
      // => [ field: ?var; ... ]
      // => ok(field: ?var; ...)
      // => [ ok(field: ?var; ...) ]
      // => [ ok ]
      // => [ variant: "ok" ]
      this.skipSeps();
      this.expect('FAT_ARROW');
      this.skipSeps();

      let outputFields: FieldPattern[] = [];
      let outputVariant: string | undefined;

      if (this.peek().type === 'LBRACKET') {
        this.advance();
        this.skipSeps();

        // Check if it's [ ok ] or [ ok(...) ] — named variant inside brackets
        if (this.peek().type === 'IDENT' && this.peek().value !== '_' &&
            this.peekAt(1) !== null &&
            (this.peekAt(1)!.type === 'RBRACKET' || this.peekAt(1)!.type === 'LPAREN')) {
          outputVariant = this.advance().value;
          if (this.match('LPAREN')) {
            outputFields = this.parseFieldPatterns();
            this.expect('RPAREN');
          }
        } else {
          outputFields = this.parseFieldPatterns();
        }
        this.expect('RBRACKET');
      } else if (this.peek().type === 'IDENT') {
        // => ok(field: ?var; ...) — named variant without brackets
        outputVariant = this.advance().value;
        if (this.match('LPAREN')) {
          outputFields = this.parseFieldPatterns();
          this.expect('RPAREN');
        }
      }

      // If variant was parsed, add it as a field pattern
      if (outputVariant) {
        outputFields.unshift({
          name: 'variant',
          match: { type: 'literal', value: outputVariant },
        });
      }

      patterns.push({
        concept: concept.startsWith('?') ? concept : `urn:clef/${concept}`,
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
    let ref = this.expectIdent().value;
    // Handle dotted names like Phone.Profile
    while (this.match('DOT')) {
      ref += '.' + this.expectIdent().value;
    }
    return ref;
  }

  private parseFieldPatterns(): FieldPattern[] {
    const fields: FieldPattern[] = [];

    while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'RPAREN' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACKET' || this.peek().type === 'RPAREN') break;

      const name = this.expectIdent().value;
      this.expect('COLON');

      let match: FieldPattern['match'];

      if (this.peek().type === 'QUESTION') {
        // Variable: ?name (name could be a keyword like ?sync, ?where, ?filter)
        this.advance();
        const varName = this.expectIdent().value;
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
      } else if (this.peek().type === 'LBRACE') {
        // Nested record: { key: value; ... }
        match = { type: 'literal', value: this.parseNestedObjectBraces() };
      } else {
        throw new Error(`Sync parse error at line ${this.peek().line}: expected field value, got ${this.peek().type}(${this.peek().value})`);
      }

      fields.push({ name, match });

      this.match('SEMICOLON');
      this.match('COMMA');
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
      } else if (this.peek().type === 'IDENT' && this.peek().value === 'guard') {
        entries.push(this.parseGuardExpr());
      } else if (this.peek().type === 'IDENT' && this.peek().value === 'any') {
        entries.push(this.parseAnyExpr());
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

    // Parse expression — collect tokens until we see 'as' at depth 0
    let expr = '';
    let depth = 0;
    while (this.peek().type !== 'EOF') {
      if (this.peek().type === 'LPAREN') depth++;
      if (this.peek().type === 'RPAREN') {
        if (depth === 0) break;
        depth--;
      }
      if (depth === 0 && this.peek().type === 'IDENT' && this.peek().value === 'as') break;
      const tok = this.advance();
      // Reconstruct token text
      if (tok.type === 'QUESTION') {
        expr += '?';
      } else {
        expr += tok.value;
      }
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

  private parseGuardExpr(): WhereEntry {
    this.advance(); // consume 'guard'
    this.expect('LPAREN');

    let expr = '';
    let depth = 1;
    while (depth > 0 && this.peek().type !== 'EOF') {
      if (this.peek().type === 'LPAREN') depth++;
      if (this.peek().type === 'RPAREN') {
        depth--;
        if (depth === 0) break;
      }
      const tok = this.advance();
      if (tok.type === 'QUESTION') {
        expr += '?';
      } else {
        expr += tok.value;
      }
    }
    this.expect('RPAREN');

    return { type: 'filter', expr: `guard(${expr.trim()})` };
  }

  private parseAnyExpr(): WhereEntry {
    this.advance(); // consume 'any'
    this.expect('LPAREN');

    let expr = '';
    let depth = 1;
    while (depth > 0 && this.peek().type !== 'EOF') {
      if (this.peek().type === 'LPAREN') depth++;
      if (this.peek().type === 'RPAREN') {
        depth--;
        if (depth === 0) break;
      }
      const tok = this.advance();
      if (tok.type === 'QUESTION') {
        expr += '?';
      } else if (tok.type === 'SEMICOLON') {
        expr += '; ';
      } else if (tok.type === 'EQUALS') {
        expr += ' = ';
      } else {
        expr += tok.value;
      }
    }
    this.expect('RPAREN');

    return { type: 'filter', expr: `any(${expr.trim()})` };
  }

  private parseConceptQuery(): WhereEntry {
    const concept = this.parseConceptRef();

    // Check if this is Concept/action: [...] => [...] or Concept: { ... }
    if (this.peek().type === 'SLASH') {
      // Concept/action: [...] => [...] form
      this.advance();
      const action = this.expectIdent().value;
      this.expect('COLON');
      this.expect('LBRACKET');
      const inputFields = this.parseFieldPatterns();
      this.expect('RBRACKET');

      this.skipSeps();
      this.expect('FAT_ARROW');
      this.skipSeps();

      // Parse output: [ variant: "ok"; field: ?var ] or ok(field: ?var)
      let outputFields: FieldPattern[] = [];
      let outputVariant: string | undefined;

      if (this.peek().type === 'LBRACKET') {
        this.advance();
        this.skipSeps();
        if (this.peek().type === 'IDENT' && this.peek().value !== '_' &&
            this.peekAt(1) !== null &&
            (this.peekAt(1)!.type === 'RBRACKET' || this.peekAt(1)!.type === 'LPAREN')) {
          outputVariant = this.advance().value;
          if (this.match('LPAREN')) {
            outputFields = this.parseFieldPatterns();
            this.expect('RPAREN');
          }
        } else {
          outputFields = this.parseFieldPatterns();
        }
        this.expect('RBRACKET');
      } else if (this.peek().type === 'IDENT') {
        outputVariant = this.advance().value;
        if (this.match('LPAREN')) {
          outputFields = this.parseFieldPatterns();
          this.expect('RPAREN');
        }
      }

      if (outputVariant) {
        outputFields.unshift({
          name: 'variant',
          match: { type: 'literal', value: outputVariant },
        });
      }

      // Collect bindings from output fields
      const bindings: { variable: string; field: string }[] = [];
      for (const f of outputFields) {
        if (f.match.type === 'variable') {
          bindings.push({ variable: f.match.name, field: f.name });
        }
      }

      return {
        type: 'query',
        concept: `urn:clef/${concept}/${action}`,
        bindings,
      };
    }

    // Concept: { ?var field: value } form
    this.expect('COLON');
    this.expect('LBRACE');

    const bindings: { variable: string; field: string }[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      if (this.peek().type === 'QUESTION') {
        // ?var field: value pattern
        this.advance();
        const varName = this.expectIdent().value;

        // Next should be field: value pairs
        while (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') {
          const field = this.expectIdent().value;
          this.expect('COLON');

          if (this.peek().type === 'QUESTION') {
            this.advance();
            const valVar = this.expectIdent().value;
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
        // field: value or field: ?var as ?binding
        const field = this.expectIdent().value;
        this.expect('COLON');
        if (this.peek().type === 'QUESTION') {
          this.advance();
          const varName = this.expectIdent().value;
          bindings.push({ variable: varName, field });
        } else {
          // literal value — skip
          this.advance();
        }
        // Check for "as ?binding" pattern (works for both ?var as ?x and "literal" as ?x)
        if (this.peek().type === 'IDENT' && this.peek().value === 'as') {
          this.advance(); // consume 'as'
          this.expect('QUESTION');
          const asVar = this.expectIdent().value;
          bindings.push({ variable: asVar, field: `${field}__as` });
        }
        this.match('SEMICOLON');
      }
      this.skipSeps();
    }

    this.expect('RBRACE');

    return {
      type: 'query',
      concept: `urn:clef/${concept}`,
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

      // Handle "for each ?var in ?list { ... }" — skip as expression block
      if (this.peek().type === 'IDENT' && this.peek().value === 'for') {
        this.skipBraceBlock();
        this.skipSeps();
        continue;
      }

      // Handle ?variable/action: [...] — dynamic concept reference
      let concept: string;
      if (this.peek().type === 'QUESTION') {
        this.advance();
        concept = `?${this.expectIdent().value}`;
      } else {
        concept = this.parseConceptRef();
      }
      this.expect('SLASH');
      // Support dynamic action references: ?variable or static identifier
      let action: string;
      if (this.peek().type === 'QUESTION') {
        this.advance();
        action = `?${this.expectIdent().value}`;
      } else {
        action = this.expectIdent().value;
      }

      this.expect('COLON');
      this.expect('LBRACKET');

      const fields = this.parseThenFields();

      this.expect('RBRACKET');
      actions.push({ concept: concept.startsWith('?') ? concept : `urn:clef/${concept}`, action, fields });
      this.skipSeps();
    }

    this.expect('RBRACE');
    return actions;
  }

  private parseThenFieldValue(): ThenField['value'] {
    if (this.peek().type === 'QUESTION') {
      this.advance();
      const varName = this.expectIdent().value;
      // Check for dot access: ?var.field
      if (this.peek().type === 'DOT') {
        return { type: 'variable', name: `${varName}.${this.advance() && this.expectIdent().value}` };
      }
      return { type: 'variable', name: varName };
    }
    if (this.peek().type === 'STRING_LIT') {
      return { type: 'literal', value: this.advance().value };
    }
    if (this.peek().type === 'INT_LIT') {
      return { type: 'literal', value: parseInt(this.advance().value, 10) };
    }
    if (this.peek().type === 'FLOAT_LIT') {
      return { type: 'literal', value: parseFloat(this.advance().value) };
    }
    if (this.peek().type === 'BOOL_LIT') {
      return { type: 'literal', value: this.advance().value === 'true' };
    }
    if (this.peek().type === 'LBRACKET') {
      // Could be empty [] or list literal [?var, ...] or nested object [key: value; ...]
      if (this.peekAt(1)?.type === 'RBRACKET') {
        this.advance(); this.advance();
        return { type: 'literal', value: [] };
      }
      // List literal: starts with ? (variable) or string/int/bool without colon after
      if (this.peekAt(1)?.type === 'QUESTION' ||
          (this.peekAt(1)?.type === 'STRING_LIT' && this.peekAt(2)?.type !== 'COLON')) {
        return { type: 'literal', value: this.parseThenListLiteral() };
      }
      return { type: 'literal', value: this.parseNestedObject() };
    }
    if (this.peek().type === 'LBRACE') {
      return { type: 'literal', value: this.parseNestedObjectBraces() };
    }
    // Handle null, none, and other ident values
    if (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') {
      const val = this.peek().value;
      // Function calls: concat(...), cond(...), length(...), etc.
      if (this.peekAt(1)?.type === 'LPAREN') {
        return { type: 'literal', value: this.collectExpression() };
      }
      this.advance();
      if (val === 'null') return { type: 'literal', value: null };
      if (val === 'none') return { type: 'literal', value: null };
      return { type: 'literal', value: val };
    }
    throw new Error(`Sync parse error at line ${this.peek().line}: expected then field value, got ${this.peek().type}(${this.peek().value})`);
  }

  private parseThenFields(): ThenField[] {
    const fields: ThenField[] = [];
    while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACKET') break;

      const name = this.expectIdent().value;
      this.expect('COLON');
      const value = this.parseThenFieldValue();
      fields.push({ name, value });
      this.match('SEMICOLON');
      this.skipSeps();
    }
    return fields;
  }

  /** Parse a list literal like [?loc] or [?a, ?b] inside then fields. */
  private parseThenListLiteral(): string {
    this.expect('LBRACKET');
    let items: string[] = [];
    while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
      if (this.peek().type === 'QUESTION') {
        this.advance();
        const name = this.expectIdent().value;
        items.push(`?${name}`);
      } else if (this.peek().type === 'STRING_LIT') {
        items.push(`"${this.advance().value}"`);
      } else {
        items.push(this.advance().value);
      }
      this.match('COMMA');
      this.match('SEMICOLON');
    }
    this.expect('RBRACKET');
    return `[${items.join(', ')}]`;
  }

  /** Collect a function-call expression like concat("a", ?b, "c") preserving structure. */
  private collectExpression(): string {
    let expr = '';
    let depth = 0;
    while (this.peek().type !== 'EOF') {
      const tok = this.peek();
      if (tok.type === 'LPAREN') depth++;
      if (tok.type === 'RPAREN') {
        depth--;
        if (depth < 0) break;
      }
      if (depth === 0 && (tok.type === 'SEMICOLON' || tok.type === 'RBRACKET' || tok.type === 'RBRACE')) break;
      if (tok.type === 'QUESTION') {
        expr += '?';
      } else if (tok.type === 'SEP') {
        // skip newlines inside expressions
      } else {
        expr += tok.value;
      }
      this.advance();
    }
    return expr.trim();
  }

  /** Skip a brace-delimited block (e.g. "for each ... { ... }"). Consumes tokens up to and including matching }. */
  private skipBraceBlock(): void {
    // Advance until we hit a LBRACE
    while (this.peek().type !== 'LBRACE' && this.peek().type !== 'EOF') {
      this.advance();
    }
    if (this.peek().type === 'EOF') return;
    this.advance(); // consume LBRACE
    let depth = 1;
    while (depth > 0 && this.peek().type !== 'EOF') {
      if (this.peek().type === 'LBRACE') depth++;
      if (this.peek().type === 'RBRACE') depth--;
      this.advance();
    }
  }

  private parseNestedObjectBraces(): Record<string, unknown> {
    this.expect('LBRACE');
    this.skipSeps();

    // Check for set literal pattern: { ?var, ?var }
    if (this.peek().type === 'QUESTION') {
      const items: string[] = [];
      while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RBRACE') break;
        if (this.peek().type === 'QUESTION') {
          this.advance();
          items.push(`?${this.expectIdent().value}`);
        } else {
          items.push(this.advance().value);
        }
        this.match('COMMA');
        this.skipSeps();
      }
      this.expect('RBRACE');
      return { __set: items };
    }

    const obj: Record<string, unknown> = {};

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const key = this.expectIdent().value;
      this.expect('COLON');

      if (this.peek().type === 'QUESTION') {
        this.advance();
        const varName = this.expectIdent().value;
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
      } else if ((this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') && this.peekAt(1)?.type === 'LPAREN') {
        // Function call: concat(...), cond(...)
        obj[key] = this.collectExpression();
      } else if (this.peek().type === 'IDENT' && this.peek().value === 'null') {
        this.advance();
        obj[key] = null;
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

      const key = this.expectIdent().value;
      this.expect('COLON');

      if (this.peek().type === 'QUESTION') {
        this.advance();
        const varName = this.expectIdent().value;
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
