// ============================================================
// Clef Kernel - .derived File Parser
// Tokenizer + Recursive Descent Parser for derived concepts
// ============================================================

import type {
  DerivedAST,
  ComposesEntry,
  DerivedSurfaceAction,
  DerivedSurfaceQuery,
  DerivedActionMatch,
  DerivedActionTrigger,
  DerivedPrinciple,
  DerivedPrincipleStep,
  ParamDecl,
  TypeExpr,
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
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'SLASH'
  | 'DOT'
  | 'PIPE'
  | 'SEP'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'derived', 'purpose', 'composes', 'syncs', 'surface',
  'action', 'query', 'principle', 'matches', 'required',
  'recommended', 'after', 'then', 'and', 'entry', 'triggers',
  'reads', 'on',
]);

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

    if (ch === '\n' || ch === ';') {
      advance();
      if (tokens.length === 0 || tokens[tokens.length - 1].type !== 'SEP') {
        tokens.push({ type: 'SEP', value: ch, line: l, col: c });
      }
      continue;
    }

    if (ch === '-' && i + 1 < source.length && source[i + 1] === '>') {
      advance(2);
      tokens.push({ type: 'ARROW', value: '->', line: l, col: c });
      continue;
    }

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
      if (i < source.length) advance();
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

    // Identifier or keyword
    // Allow hyphens in identifiers for sync names (e.g. trash-delete)
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
      if (prev && prev.type === 'SEP') continue;
    }
    cleaned.push(tok);
  }

  cleaned.push({ type: 'EOF', value: '', line, col });
  return cleaned;
}

// --- Parser ---

class DerivedParser {
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
        `Derived parse error at line ${tok.line}:${tok.col}: expected ${type}${value ? `(${value})` : ''}, got ${tok.type}(${tok.value})`,
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
      `Derived parse error at line ${tok.line}:${tok.col}: expected identifier, got ${tok.type}(${tok.value})`,
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

  parseDerived(): DerivedAST {
    this.skipSeps();
    this.expect('KEYWORD', 'derived');
    const name = this.expectIdent().value;
    const typeParams = this.parseTypeParams();
    this.expect('LBRACE');

    const ast: DerivedAST = {
      name,
      typeParams,
      composes: [],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const keyword = this.peek();
      if (keyword.type !== 'KEYWORD') {
        throw new Error(`Derived parse error at line ${keyword.line}: expected section keyword, got ${keyword.type}(${keyword.value})`);
      }

      switch (keyword.value) {
        case 'purpose':
          ast.purpose = this.parsePurpose();
          break;
        case 'composes':
          ast.composes = this.parseComposes();
          break;
        case 'syncs':
          ast.syncs = this.parseSyncs();
          break;
        case 'surface':
          this.parseSurface(ast);
          break;
        case 'principle':
          ast.principle = this.parsePrinciple();
          break;
        default:
          throw new Error(`Derived parse error at line ${keyword.line}: unexpected keyword '${keyword.value}'`);
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

    let prose = '';
    let depth = 1;
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

  private parseComposes(): ComposesEntry[] {
    this.expect('KEYWORD', 'composes');
    this.expect('LBRACE');

    const entries: ComposesEntry[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      let isDerived = false;
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'derived') {
        this.advance();
        isDerived = true;
      }

      const name = this.expectIdent().value;
      const typeParams = this.parseTypeParams();

      entries.push({ name, typeParams, isDerived });
      this.skipSeps();
    }

    this.expect('RBRACE');
    return entries;
  }

  private parseSyncs(): { required: string[]; recommended?: string[] } {
    this.expect('KEYWORD', 'syncs');
    this.expect('LBRACE');

    const required: string[] = [];
    const recommended: string[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const tok = this.peek();
      if (tok.type === 'KEYWORD' && (tok.value === 'required' || tok.value === 'recommended')) {
        const tier = tok.value;
        this.advance();
        this.expect('COLON');
        this.expect('LBRACKET');

        const target = tier === 'required' ? required : recommended;

        while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
          this.skipSeps();
          if (this.peek().type === 'RBRACKET') break;

          const syncName = this.expectIdent().value;
          target.push(syncName);
          this.match('COMMA');
          this.skipSeps();
        }

        this.expect('RBRACKET');
      } else {
        // Skip unknown tokens to avoid infinite loops
        this.advance();
      }
      this.skipSeps();
    }

    this.expect('RBRACE');
    return recommended.length > 0 ? { required, recommended } : { required };
  }

  private parseSurface(ast: DerivedAST): void {
    this.expect('KEYWORD', 'surface');
    this.expect('LBRACE');

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const keyword = this.peek();
      if (keyword.type === 'KEYWORD' && keyword.value === 'action') {
        ast.surface.actions.push(this.parseSurfaceAction(ast.typeParams));
      } else if (keyword.type === 'KEYWORD' && keyword.value === 'query') {
        ast.surface.queries.push(this.parseSurfaceQuery(ast.typeParams));
      } else {
        throw new Error(`Derived parse error at line ${keyword.line}: expected 'action' or 'query' in surface, got ${keyword.value}`);
      }

      this.skipSeps();
    }

    this.expect('RBRACE');
  }

  private parseSurfaceAction(typeParams: string[]): DerivedSurfaceAction {
    this.expect('KEYWORD', 'action');
    const name = this.expectIdent().value;
    this.expect('LPAREN');
    const params = this.parseParamList(typeParams);
    this.expect('RPAREN');
    this.expect('LBRACE');
    this.skipSeps();

    const tok = this.peek();

    // entry: / triggers: format
    if (tok.type === 'KEYWORD' && tok.value === 'entry') {
      this.advance();
      this.expect('COLON');

      // Parse: Concept/action matches on field: ?binding, ...
      const concept = this.expectIdent().value;
      this.expect('SLASH');
      const action = this.expectIdent().value;

      const fields: Record<string, string> = {};
      // Optional "matches on field: ?binding" clause
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'matches') {
        this.advance(); // matches
        this.expect('KEYWORD', 'on'); // on
        // Parse field: ?binding pairs
        while (this.peek().type !== 'SEP' && this.peek().type !== 'RBRACE' &&
               this.peek().type !== 'EOF' && !(this.peek().type === 'KEYWORD' && this.peek().value === 'triggers')) {
          const fieldName = this.expectIdent().value;
          this.expect('COLON');
          // ?binding — the ? is not a separate token, it's part of the ident
          const bindVal = this.expectIdent().value;
          fields[fieldName] = bindVal;
          this.match('COMMA');
          this.skipSeps();
        }
      }

      const matches: DerivedActionMatch = {
        type: 'entry',
        concept,
        action,
        ...(Object.keys(fields).length > 0 ? { fields } : {}),
      };

      this.skipSeps();

      // Parse triggers: [...]
      let triggers: DerivedActionTrigger[] | undefined;
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'triggers') {
        this.advance();
        this.expect('COLON');
        this.expect('LBRACKET');
        triggers = [];

        while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
          this.skipSeps();
          if (this.peek().type === 'RBRACKET') break;

          const tConcept = this.expectIdent().value;
          this.expect('SLASH');
          const tAction = this.expectIdent().value;
          this.expect('LPAREN');

          const tArgs: Record<string, string> = {};
          while (this.peek().type !== 'RPAREN' && this.peek().type !== 'EOF') {
            this.skipSeps();
            if (this.peek().type === 'RPAREN') break;
            const argName = this.expectIdent().value;
            this.expect('COLON');
            // Value: ?binding, string literal, or ident
            let argVal: string;
            if (this.peek().type === 'STRING_LIT') {
              argVal = this.advance().value;
            } else if (this.peek().type === 'INT_LIT' || this.peek().type === 'FLOAT_LIT') {
              argVal = this.advance().value;
            } else {
              argVal = this.expectIdent().value;
            }
            tArgs[argName] = argVal;
            this.match('COMMA');
            this.skipSeps();
          }
          this.expect('RPAREN');

          triggers.push({ concept: tConcept, action: tAction, args: tArgs });
          this.match('COMMA');
          this.skipSeps();
        }

        this.expect('RBRACKET');
      }

      this.skipSeps();
      this.expect('RBRACE');

      return { name, params, matches, ...(triggers ? { triggers } : {}) };
    }

    // Standard matches: format (supports pipe-separated alternatives: Concept/action | Concept/action)
    this.expect('KEYWORD', 'matches');
    this.expect('COLON');
    const matches = this.parseActionMatch();
    // Consume any pipe-separated alternative matches (first match wins)
    while (this.peek().type === 'PIPE') {
      this.advance(); // consume |
      this.skipSeps();
      this.parseActionMatch(); // consume and discard alternatives
    }
    this.skipSeps();
    this.expect('RBRACE');

    return { name, params, matches };
  }

  private parseActionMatch(): DerivedActionMatch {
    // Two forms:
    // 1. Concept/action or Concept/action(field: value, ...)
    // 2. derivedContext "DerivedName/actionName"

    if (this.peek().type === 'IDENT' && this.peek().value === 'derivedContext') {
      this.advance();
      const tag = this.expect('STRING_LIT').value;
      return { type: 'derivedContext', tag };
    }

    // Parse Concept/action reference
    const concept = this.expectIdent().value;
    this.expect('SLASH');
    const action = this.expectIdent().value;

    // Optional field matches in parentheses
    const fields: Record<string, unknown> = {};
    if (this.match('LPAREN')) {
      while (this.peek().type !== 'RPAREN' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RPAREN') break;
        const fieldName = this.expectIdent().value;
        this.expect('COLON');
        const fieldValue = this.parseFieldValue();
        fields[fieldName] = fieldValue;
        this.match('COMMA');
        this.skipSeps();
      }
      this.expect('RPAREN');
    }

    return {
      type: 'action',
      concept,
      action,
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
    };
  }

  private parseFieldValue(): unknown {
    const tok = this.peek();
    if (tok.type === 'STRING_LIT') { this.advance(); return tok.value; }
    if (tok.type === 'INT_LIT') { this.advance(); return parseInt(tok.value, 10); }
    if (tok.type === 'FLOAT_LIT') { this.advance(); return parseFloat(tok.value); }
    if (tok.type === 'BOOL_LIT') { this.advance(); return tok.value === 'true'; }
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') { this.advance(); return tok.value; }
    throw new Error(`Derived parse error at line ${tok.line}: expected value, got ${tok.type}(${tok.value})`);
  }

  private parseSurfaceQuery(typeParams: string[]): DerivedSurfaceQuery {
    this.expect('KEYWORD', 'query');
    const name = this.expectIdent().value;
    this.expect('LPAREN');
    const params = this.parseParamList(typeParams);
    this.expect('RPAREN');

    // Two formats:
    // 1. -> Concept/action(arg: paramRef, ...)
    // 2. { reads: Concept/action(arg: ?binding, ...) }
    if (this.match('LBRACE')) {
      this.skipSeps();
      this.expect('KEYWORD', 'reads');
      this.expect('COLON');

      const target = this.parseQueryTarget();
      this.skipSeps();
      this.expect('RBRACE');

      return { name, params, target };
    }

    this.expect('ARROW');

    // Support: -> derivedContext "Concept/action"
    if (this.peek().type === 'IDENT' && this.peek().value === 'derivedContext') {
      this.advance();
      const tag = this.expect('STRING_LIT').value;
      const slashIdx = tag.indexOf('/');
      const concept = slashIdx >= 0 ? tag.substring(0, slashIdx) : tag;
      const action = slashIdx >= 0 ? tag.substring(slashIdx + 1) : tag;
      return { name, params, target: { concept, action, args: {} } };
    }

    const target = this.parseQueryTarget();
    return { name, params, target };
  }

  private parseQueryTarget(): { concept: string; action: string; args: Record<string, string> } {
    const concept = this.expectIdent().value;
    this.expect('SLASH');
    const action = this.expectIdent().value;
    this.expect('LPAREN');

    const args: Record<string, string> = {};
    while (this.peek().type !== 'RPAREN' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RPAREN') break;
      const argName = this.expectIdent().value;
      this.expect('COLON');
      // Value: ?binding, string literal, or ident
      let argValue: string;
      if (this.peek().type === 'STRING_LIT') {
        argValue = this.advance().value;
      } else {
        argValue = this.expectIdent().value;
      }
      args[argName] = argValue;
      this.match('COMMA');
      this.skipSeps();
    }
    this.expect('RPAREN');

    return { concept, action, args };
  }

  private parsePrinciple(): DerivedPrinciple {
    this.expect('KEYWORD', 'principle');
    this.expect('LBRACE');

    const steps: DerivedPrincipleStep[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.skipSeps();
      if (this.peek().type === 'RBRACE') break;

      const keyword = this.peek();
      if (keyword.type !== 'KEYWORD' || !['after', 'then', 'and'].includes(keyword.value)) {
        // Continuation line — append to previous step's text
        if (steps.length > 0) {
          let contText = '';
          while (this.peek().type !== 'SEP' && this.peek().type !== 'RBRACE' &&
                 this.peek().type !== 'EOF' &&
                 !(this.peek().type === 'KEYWORD' && ['after', 'then', 'and'].includes(this.peek().value))) {
            contText += this.advance().value + ' ';
          }
          if (contText.trim()) {
            steps[steps.length - 1].text += ' ' + contText.trim();
          }
          this.skipSeps();
          continue;
        }
        throw new Error(`Derived parse error at line ${keyword.line}: expected 'after', 'then', or 'and' in principle, got ${keyword.value}`);
      }

      const kind = this.advance().value as 'after' | 'then' | 'and';

      // Collect the rest of the line as text, but also try to parse structured form
      const step = this.parsePrincipleStep(kind);
      steps.push(step);

      this.skipSeps();
    }

    this.expect('RBRACE');
    return { steps };
  }

  private parsePrincipleStep(kind: 'after' | 'then' | 'and'): DerivedPrincipleStep {
    // Try to parse structured form: actionName(arg: value, ...)
    // or: actionName(arg: value) assertion expression
    const tok = this.peek();

    if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && this.isNextLParen()) {
      const actionName = this.expectIdent().value;
      this.expect('LPAREN');

      const args: Record<string, string> = {};
      while (this.peek().type !== 'RPAREN' && this.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.peek().type === 'RPAREN') break;
        const argName = this.expectIdent().value;
        this.expect('COLON');

        // Value can be a string lit, ident, or complex expression
        let argValue: string;
        if (this.peek().type === 'STRING_LIT') {
          argValue = this.advance().value;
        } else if (this.peek().type === 'LBRACKET') {
          // List value like ["a.concept"]
          argValue = this.collectBracketedText();
        } else {
          argValue = this.expectIdent().value;
        }
        args[argName] = argValue;
        this.match('COMMA');
        this.skipSeps();
      }
      this.expect('RPAREN');

      // Check for assertion after the action call
      let assertion: string | undefined;
      let restText = '';
      if (this.peek().type !== 'SEP' && this.peek().type !== 'RBRACE' &&
          this.peek().type !== 'EOF' && this.peek().type !== 'KEYWORD') {
        // Collect remaining text until end of line or next keyword
        while (this.peek().type !== 'SEP' && this.peek().type !== 'RBRACE' &&
               this.peek().type !== 'EOF' &&
               !(this.peek().type === 'KEYWORD' && ['after', 'then', 'and'].includes(this.peek().value))) {
          restText += this.advance().value + ' ';
        }
        restText = restText.trim();
        if (restText) assertion = restText;
      }

      const text = `${actionName}(${Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(', ')})${assertion ? ' ' + assertion : ''}`;
      return { kind, text, actionName, args, assertion };
    }

    // Unstructured: collect tokens until next principle keyword or RBRACE
    let text = '';
    while (this.peek().type !== 'SEP' && this.peek().type !== 'RBRACE' &&
           this.peek().type !== 'EOF' &&
           !(this.peek().type === 'KEYWORD' && ['after', 'then', 'and'].includes(this.peek().value))) {
      text += this.advance().value + ' ';
    }

    return { kind, text: text.trim() };
  }

  /** Look ahead to see if the next non-SEP token after current is LPAREN. */
  private isNextLParen(): boolean {
    let look = this.pos + 1;
    while (look < this.tokens.length && this.tokens[look].type === 'SEP') look++;
    return look < this.tokens.length && this.tokens[look].type === 'LPAREN';
  }

  private collectBracketedText(): string {
    this.expect('LBRACKET');
    let text = '[';
    let depth = 1;
    while (depth > 0 && this.peek().type !== 'EOF') {
      if (this.peek().type === 'LBRACKET') depth++;
      if (this.peek().type === 'RBRACKET') {
        depth--;
        if (depth === 0) { this.advance(); break; }
      }
      text += this.advance().value;
    }
    return text + ']';
  }

  private parseParamList(typeParams: string[]): ParamDecl[] {
    const params: ParamDecl[] = [];
    this.skipSeps();
    if (this.peek().type === 'RPAREN') return params;

    params.push(this.parseParam(typeParams));
    while (this.match('COMMA')) {
      this.skipSeps();
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

  private parseTypeExpr(typeParams: string[]): TypeExpr {
    const tok = this.peek();

    if (tok.type === 'IDENT' && CONTEXTUAL_KEYWORDS.has(tok.value)) {
      const kind = tok.value as 'set' | 'list' | 'option';
      this.advance();
      const inner = this.parseTypeExpr(typeParams);
      return { kind, inner };
    }

    if (tok.type === 'PRIMITIVE') {
      this.advance();
      return { kind: 'primitive', name: tok.value };
    }

    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      this.advance();
      if (typeParams.includes(tok.value)) {
        return { kind: 'param', name: tok.value };
      }
      return { kind: 'primitive', name: tok.value };
    }

    throw new Error(`Derived parse error at line ${tok.line}: expected type expression, got ${tok.type}(${tok.value})`);
  }
}

/**
 * Parse a .derived file source string into a DerivedAST.
 */
export function parseDerivedFile(source: string): DerivedAST {
  const tokens = tokenize(source);
  const parser = new DerivedParser(tokens);
  return parser.parseDerived();
}
