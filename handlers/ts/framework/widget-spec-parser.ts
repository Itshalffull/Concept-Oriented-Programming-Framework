// ============================================================
// Clef Kernel - .widget File Parser
// Tokenizer + Recursive Descent Parser for widget specifications
// Produces WidgetManifest typed IR.
// ============================================================

import type {
  WidgetManifest,
  WidgetAnatomyPart,
  WidgetState,
  WidgetAccessibility,
  WidgetAffordance,
  WidgetProp,
} from '../../../runtime/types.js';

// --- Token Types ---

type TokenType =
  | 'KEYWORD'
  | 'IDENT'
  | 'STRING_LIT'
  | 'INT_LIT'
  | 'BOOL_LIT'
  | 'ARROW'
  | 'COLON'
  | 'COMMA'
  | 'SEMICOLON'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'AT'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'widget', 'purpose', 'requires', 'anatomy', 'states', 'accessibility',
  'affordance', 'props', 'connect', 'compose', 'invariant',
  'on', 'entry', 'exit', 'role', 'keyboard', 'focus', 'aria',
  'serves', 'specificity', 'when', 'bind',
  'true', 'false', 'initial',
  'container', 'text', 'presentation', 'interactive',
  'fields', 'actions',
]);

// --- Tokenizer ---

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  while (i < source.length) {
    // Skip whitespace
    if (source[i] === ' ' || source[i] === '\t' || source[i] === '\r') {
      i++;
      col++;
      continue;
    }
    if (source[i] === '\n') {
      i++;
      line++;
      col = 1;
      continue;
    }

    // Skip comments
    if (source[i] === '#' || (source[i] === '/' && source[i + 1] === '/')) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // String literals
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      const startCol = col;
      i++;
      col++;
      let val = '';
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') { i++; col++; }
        val += source[i];
        i++;
        col++;
      }
      if (i < source.length) { i++; col++; }
      tokens.push({ type: 'STRING_LIT', value: val, line, col: startCol });
      continue;
    }

    // Brace-delimited prose blocks (purpose, description)
    // We handle these at the parser level, not tokenizer

    // Symbols
    const startCol = col;
    switch (source[i]) {
      case '{': tokens.push({ type: 'LBRACE', value: '{', line, col }); i++; col++; continue;
      case '}': tokens.push({ type: 'RBRACE', value: '}', line, col }); i++; col++; continue;
      case '[': tokens.push({ type: 'LBRACKET', value: '[', line, col }); i++; col++; continue;
      case ']': tokens.push({ type: 'RBRACKET', value: ']', line, col }); i++; col++; continue;
      case '(': tokens.push({ type: 'LPAREN', value: '(', line, col }); i++; col++; continue;
      case ')': tokens.push({ type: 'RPAREN', value: ')', line, col }); i++; col++; continue;
      case ':': tokens.push({ type: 'COLON', value: ':', line, col }); i++; col++; continue;
      case ',': tokens.push({ type: 'COMMA', value: ',', line, col }); i++; col++; continue;
      case ';': tokens.push({ type: 'SEMICOLON', value: ';', line, col }); i++; col++; continue;
      case '@': tokens.push({ type: 'AT', value: '@', line, col }); i++; col++; continue;
    }

    if (source[i] === '-' && source[i + 1] === '>') {
      tokens.push({ type: 'ARROW', value: '->', line, col });
      i += 2;
      col += 2;
      continue;
    }

    // Numbers
    if (source[i] >= '0' && source[i] <= '9') {
      let num = '';
      while (i < source.length && source[i] >= '0' && source[i] <= '9') {
        num += source[i];
        i++;
        col++;
      }
      tokens.push({ type: 'INT_LIT', value: num, line, col: startCol });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(source[i])) {
      let ident = '';
      while (i < source.length && /[\w-]/.test(source[i])) {
        ident += source[i];
        i++;
        col++;
      }
      if (ident === 'true' || ident === 'false') {
        tokens.push({ type: 'BOOL_LIT', value: ident, line, col: startCol });
      } else if (KEYWORDS.has(ident)) {
        tokens.push({ type: 'KEYWORD', value: ident, line, col: startCol });
      } else {
        tokens.push({ type: 'IDENT', value: ident, line, col: startCol });
      }
      continue;
    }

    // Skip unknown characters
    i++;
    col++;
  }

  tokens.push({ type: 'EOF', value: '', line, col });
  return tokens;
}

// --- Parser ---

class WidgetSpecParser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    return this.tokens[this.pos++] || { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private expect(type: TokenType, value?: string): Token {
    const tok = this.advance();
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new Error(
        `Widget parse error at line ${tok.line}: expected ${type}${value ? `(${value})` : ''}, got ${tok.type}(${tok.value})`,
      );
    }
    return tok;
  }

  private match(type: TokenType, value?: string): boolean {
    const tok = this.peek();
    return tok.type === type && (value === undefined || tok.value === value);
  }

  private skipAnnotations(): void {
    while (this.match('AT')) {
      this.advance(); // @
      this.advance(); // annotation name
      if (this.match('LPAREN')) {
        this.advance();
        while (!this.match('RPAREN') && !this.match('EOF')) this.advance();
        if (this.match('RPAREN')) this.advance();
      }
    }
  }

  private readBraceBlock(): string {
    this.expect('LBRACE');
    let depth = 1;
    const parts: string[] = [];
    while (depth > 0 && !this.match('EOF')) {
      const tok = this.advance();
      if (tok.type === 'LBRACE') depth++;
      else if (tok.type === 'RBRACE') {
        depth--;
        if (depth === 0) break;
      }
      parts.push(tok.value);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  parseWidget(): WidgetManifest {
    this.skipAnnotations();
    this.expect('KEYWORD', 'widget');
    const name = this.advance().value;
    this.expect('LBRACE');

    const manifest: WidgetManifest = {
      name,
      purpose: '',
      anatomy: [],
      states: [],
      props: [],
      slots: [],
      accessibility: { role: '', keyboard: [], focus: {} },
      composedWidgets: [],
    };

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();

      if (tok.type === 'KEYWORD' && tok.value === 'purpose') {
        this.advance();
        manifest.purpose = this.readBraceBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'requires') {
        this.advance();
        // Skip requires block (e.g. @1 { fields { ... } })
        if (this.match('AT')) { this.advance(); this.advance(); }
        this.skipBraceBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'anatomy') {
        this.advance();
        manifest.anatomy = this.parseAnatomy();
      } else if (tok.type === 'KEYWORD' && tok.value === 'states') {
        this.advance();
        manifest.states = this.parseStates();
      } else if (tok.type === 'KEYWORD' && tok.value === 'accessibility') {
        this.advance();
        manifest.accessibility = this.parseAccessibility();
      } else if (tok.type === 'KEYWORD' && tok.value === 'affordance') {
        this.advance();
        manifest.affordance = this.parseAffordance();
      } else if (tok.type === 'KEYWORD' && tok.value === 'props') {
        this.advance();
        manifest.props = this.parseProps();
      } else if (tok.type === 'KEYWORD' && tok.value === 'connect') {
        this.advance();
        this.skipBraceBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'compose') {
        this.advance();
        manifest.composedWidgets = this.parseCompose();
      } else if (tok.type === 'KEYWORD' && tok.value === 'invariant') {
        this.advance();
        this.skipBraceBlock();
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return manifest;
  }

  private skipBraceBlock(): void {
    if (!this.match('LBRACE')) return;
    this.advance();
    let depth = 1;
    while (depth > 0 && !this.match('EOF')) {
      const tok = this.advance();
      if (tok.type === 'LBRACE') depth++;
      else if (tok.type === 'RBRACE') depth--;
    }
  }

  private parseAnatomy(): WidgetAnatomyPart[] {
    const parts: WidgetAnatomyPart[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
        const name = this.advance().value;
        let role: string | undefined;
        if (this.match('COLON')) {
          this.advance();
          if (this.peek().type === 'KEYWORD' || this.peek().type === 'IDENT') {
            role = this.advance().value;
          }
        }
        // Skip inline description { ... }
        if (this.match('LBRACE')) this.skipBraceBlock();
        parts.push({ name, role });
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return parts;
  }

  private parseStates(): WidgetState[] {
    const states: WidgetState[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || (tok.type === 'KEYWORD' && !['on', 'entry', 'exit'].includes(tok.value))) {
        const name = this.advance().value;
        let initial = false;
        if (this.match('LBRACKET')) {
          this.advance();
          if (this.match('KEYWORD', 'initial') || this.match('IDENT')) {
            if (this.peek().value === 'initial') initial = true;
            this.advance();
          }
          if (this.match('RBRACKET')) this.advance();
        }

        const transitions: WidgetState['transitions'] = [];
        const entryActions: string[] = [];
        const exitActions: string[] = [];

        this.expect('LBRACE');
        while (!this.match('RBRACE') && !this.match('EOF')) {
          if (this.match('KEYWORD', 'on')) {
            this.advance();
            const event = this.advance().value;
            this.expect('ARROW');
            const target = this.advance().value;
            transitions.push({ event, target });
            if (this.match('SEMICOLON')) this.advance();
          } else if (this.match('KEYWORD', 'entry')) {
            this.advance();
            if (this.match('LBRACKET')) {
              this.advance();
              while (!this.match('RBRACKET') && !this.match('EOF')) {
                entryActions.push(this.advance().value);
                if (this.match('SEMICOLON')) this.advance();
              }
              if (this.match('RBRACKET')) this.advance();
            }
            if (this.match('SEMICOLON')) this.advance();
          } else if (this.match('KEYWORD', 'exit')) {
            this.advance();
            if (this.match('LBRACKET')) {
              this.advance();
              while (!this.match('RBRACKET') && !this.match('EOF')) {
                exitActions.push(this.advance().value);
                if (this.match('SEMICOLON')) this.advance();
              }
              if (this.match('RBRACKET')) this.advance();
            }
            if (this.match('SEMICOLON')) this.advance();
          } else {
            this.advance();
          }
        }
        if (this.match('RBRACE')) this.advance();

        states.push({
          name,
          initial,
          transitions,
          entryActions: entryActions.length ? entryActions : undefined,
          exitActions: exitActions.length ? exitActions : undefined,
        });
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return states;
  }

  private parseAccessibility(): WidgetAccessibility {
    const a11y: WidgetAccessibility = { role: '', keyboard: [], focus: {} };
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      if (this.match('KEYWORD', 'role')) {
        this.advance();
        if (this.match('COLON')) this.advance();
        a11y.role = this.advance().value;
        if (this.match('SEMICOLON')) this.advance();
      } else if (this.match('KEYWORD', 'keyboard')) {
        this.advance();
        this.expect('LBRACE');
        while (!this.match('RBRACE') && !this.match('EOF')) {
          const key = this.advance().value;
          if (this.match('COLON')) {
            this.advance();
            // Read until semicolon or next key
            const actionParts: string[] = [];
            while (!this.match('SEMICOLON') && !this.match('RBRACE') && !this.match('EOF')) {
              actionParts.push(this.advance().value);
            }
            a11y.keyboard.push({ key, action: actionParts.join(' ') });
            if (this.match('SEMICOLON')) this.advance();
          }
        }
        if (this.match('RBRACE')) this.advance();
      } else if (this.match('KEYWORD', 'focus')) {
        this.advance();
        this.expect('LBRACE');
        while (!this.match('RBRACE') && !this.match('EOF')) {
          const prop = this.advance().value;
          if (this.match('COLON')) {
            this.advance();
            const val = this.advance().value;
            if (prop === 'trap') a11y.focus.trap = val === 'true';
            else if (prop === 'initial') a11y.focus.initial = val;
            else if (prop === 'roving') a11y.focus.roving = val === 'true';
            if (this.match('SEMICOLON')) this.advance();
          }
        }
        if (this.match('RBRACE')) this.advance();
      } else if (this.match('KEYWORD', 'aria')) {
        this.advance();
        this.skipBraceBlock();
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return a11y;
  }

  private parseAffordance(): WidgetAffordance {
    const aff: WidgetAffordance = { serves: '', binds: [] };
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      if (this.match('KEYWORD', 'serves')) {
        this.advance();
        if (this.match('COLON')) this.advance();
        aff.serves = this.advance().value;
        if (this.match('SEMICOLON')) this.advance();
      } else if (this.match('KEYWORD', 'specificity')) {
        this.advance();
        if (this.match('COLON')) this.advance();
        aff.specificity = parseInt(this.advance().value, 10);
        if (this.match('SEMICOLON')) this.advance();
      } else if (this.match('KEYWORD', 'when')) {
        this.advance();
        if (this.match('COLON')) this.advance();
        // Read until semicolon
        const parts: string[] = [];
        while (!this.match('SEMICOLON') && !this.match('RBRACE') && !this.match('EOF')) {
          parts.push(this.advance().value);
        }
        aff.when = parts.join(' ');
        if (this.match('SEMICOLON')) this.advance();
      } else if (this.match('KEYWORD', 'bind')) {
        this.advance();
        this.expect('LBRACE');
        while (!this.match('RBRACE') && !this.match('EOF')) {
          const field = this.advance().value;
          if (this.match('COLON')) {
            this.advance();
            const source = this.advance().value;
            aff.binds.push({ field, source });
            if (this.match('SEMICOLON')) this.advance();
          }
        }
        if (this.match('RBRACE')) this.advance();
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return aff;
  }

  private parseProps(): WidgetProp[] {
    const props: WidgetProp[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
        const name = this.advance().value;
        if (this.match('COLON')) {
          this.advance();
          const type = this.advance().value;
          let defaultValue: string | undefined;
          // Check for (default: value) or = value
          if (this.match('LPAREN')) {
            this.advance();
            // skip "default:"
            if (this.peek().value === 'default') {
              this.advance();
              if (this.match('COLON')) this.advance();
              defaultValue = this.advance().value;
            }
            while (!this.match('RPAREN') && !this.match('EOF')) this.advance();
            if (this.match('RPAREN')) this.advance();
          }
          if (this.match('SEMICOLON')) this.advance();
          props.push({ name, type, defaultValue });
        }
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return props;
  }

  private parseCompose(): string[] {
    const widgets: string[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
        widgets.push(this.advance().value);
        if (this.match('LBRACE')) this.skipBraceBlock();
        if (this.match('SEMICOLON')) this.advance();
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return widgets;
  }
}

/**
 * Parse a .widget file source string into a WidgetManifest.
 */
export function parseWidgetFile(source: string): WidgetManifest {
  const tokens = tokenize(source);
  const parser = new WidgetSpecParser(tokens);
  return parser.parseWidget();
}
