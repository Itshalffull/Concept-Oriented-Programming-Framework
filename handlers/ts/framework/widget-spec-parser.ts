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
  WidgetAriaBinding,
  WidgetConnectBinding,
  InvariantDecl,
  InvariantASTStep,
  InvariantAssertion,
  InvariantWhenClause,
  ActionPattern,
  ArgPattern,
  ArgPatternValue,
  QuantifierBinding,
  QuantifierDomain,
  ActionContract,
  AssertionExpr,
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
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'PIPE'
  | 'DOT'
  | 'QUESTION'
  | 'PLUS'
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
  'on', 'entry', 'exit', 'role', 'keyboard', 'focus', 'aria', 'modal',
  'serves', 'specificity', 'when', 'bind',
  'true', 'false', 'initial',
  'container', 'text', 'presentation', 'interactive', 'action', 'widget',
  'fields', 'actions',
  // Structured invariant keywords (shared with concept parser)
  'example', 'forall', 'always', 'never', 'eventually',
  'after', 'then', 'and', 'given', 'exists', 'ensures', 'not', 'old', 'where', 'in', 'none',
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
      case '=': tokens.push({ type: 'EQUALS', value: '=', line, col }); i++; col++; continue;
      case '!':
        if (source[i + 1] === '=') {
          tokens.push({ type: 'NOT_EQUALS', value: '!=', line, col }); i += 2; col += 2; continue;
        }
        i++; col++; continue;
      case '>':
        if (source[i + 1] === '=') {
          tokens.push({ type: 'GTE', value: '>=', line, col }); i += 2; col += 2; continue;
        }
        tokens.push({ type: 'GT', value: '>', line, col }); i++; col++; continue;
      case '<':
        if (source[i + 1] === '=') {
          tokens.push({ type: 'LTE', value: '<=', line, col }); i += 2; col += 2; continue;
        }
        tokens.push({ type: 'LT', value: '<', line, col }); i++; col++; continue;
      case '|': tokens.push({ type: 'PIPE', value: '|', line, col }); i++; col++; continue;
      case '.': tokens.push({ type: 'DOT', value: '.', line, col }); i++; col++; continue;
      case '?': tokens.push({ type: 'QUESTION', value: '?', line, col }); i++; col++; continue;
      case '+': tokens.push({ type: 'PLUS', value: '+', line, col }); i++; col++; continue;
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
        manifest.connect = this.parseConnect();
      } else if (tok.type === 'KEYWORD' && tok.value === 'compose') {
        this.advance();
        manifest.composedWidgets = this.parseCompose();
      } else if (tok.type === 'KEYWORD' && tok.value === 'invariant') {
        this.advance();
        manifest.invariants = this.parseInvariant();
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
    this.parseStatesInner(states, '');
    if (this.match('RBRACE')) this.advance();
    return states;
  }

  /**
   * Parse state declarations within a brace-delimited block.
   * Supports nested state groups: `row { unselected [initial] { ... } selected { ... } }`
   * Nested states are flattened with a prefix: `row.unselected`, `row.selected`.
   */
  private parseStatesInner(states: WidgetState[], prefix: string): void {
    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || (tok.type === 'KEYWORD' && !['on', 'entry', 'exit'].includes(tok.value))) {
        const rawName = this.advance().value;
        const name = prefix ? `${prefix}.${rawName}` : rawName;
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

        // Peek ahead to determine if this is a state group (contains sub-states)
        // or a leaf state (contains on/entry/exit directives).
        // A state group's first meaningful token is an IDENT/KEYWORD followed by
        // either [ (for [initial]) or { (for the state body), not 'on'/'entry'/'exit'.
        const isGroup = this.isStateGroup();

        if (isGroup) {
          // Recurse: nested state group
          this.parseStatesInner(states, name);
          if (this.match('RBRACE')) this.advance();
        } else {
          // Leaf state: parse transitions, entry, exit
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
        }
      } else {
        this.advance();
      }
    }
  }

  /**
   * Look ahead to determine if the current brace block contains sub-state
   * declarations (state group) or on/entry/exit directives (leaf state).
   */
  private isStateGroup(): boolean {
    // Save position for lookahead
    const saved = this.pos;
    let depth = 0;

    // Check the first meaningful content inside the block
    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok.type === 'EOF') break;

      // If first token is on/entry/exit, it's a leaf state
      if (tok.type === 'KEYWORD' && ['on', 'entry', 'exit'].includes(tok.value)) {
        this.pos = saved;
        return false;
      }

      // If first token is an ident/keyword followed by [ or {, it's a group
      if (tok.type === 'IDENT' || (tok.type === 'KEYWORD' && !['on', 'entry', 'exit'].includes(tok.value))) {
        const next = this.tokens[this.pos + 1];
        if (next && (next.type === 'LBRACKET' || next.type === 'LBRACE')) {
          this.pos = saved;
          return true;
        }
        // Not followed by [ or {, unknown — treat as leaf
        this.pos = saved;
        return false;
      }

      break;
    }

    this.pos = saved;
    return false;
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
          // Collect the key name — may be compound like "Shift+Tab"
          const keyParts: string[] = [];
          while (
            !this.match('ARROW') && !this.match('COLON') &&
            !this.match('RBRACE') && !this.match('EOF')
          ) {
            keyParts.push(this.advance().value);
          }
          const key = keyParts.join('');
          if (!key) { this.advance(); continue; }

          // Accept both -> and : as separator
          if (this.match('ARROW') || this.match('COLON')) {
            this.advance();
            const actionParts: string[] = [];
            while (!this.match('SEMICOLON') && !this.match('RBRACE') && !this.match('EOF')) {
              actionParts.push(this.advance().value);
            }
            a11y.keyboard.push({ key: key.trim(), action: actionParts.join(' ').trim() });
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
      } else if (this.match('KEYWORD', 'modal')) {
        // modal: true/false — skip, not yet in the type
        this.advance();
        if (this.match('COLON')) this.advance();
        this.advance(); // value
        if (this.match('SEMICOLON')) this.advance();
      } else if (this.match('KEYWORD', 'aria')) {
        this.advance();
        a11y.ariaBindings = this.parseAriaBindings();
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
          // Collect full type expression until = or newline-level token or }
          const typeParts: string[] = [];
          while (
            !this.match('EOF') && !this.match('RBRACE') &&
            !this.match('SEMICOLON') && !this.match('EQUALS')
          ) {
            // Stop if we hit an IDENT that looks like the next prop name
            // (followed by COLON) — peek ahead
            if (
              (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') &&
              this.tokens[this.pos + 1]?.type === 'COLON' &&
              typeParts.length > 0
            ) {
              break;
            }
            typeParts.push(this.advance().value);
          }
          const type = typeParts.join(' ').trim();

          let defaultValue: string | undefined;
          // Handle = value default
          if (this.match('EQUALS')) {
            this.advance(); // skip =
            const valParts: string[] = [];
            while (
              !this.match('EOF') && !this.match('RBRACE') &&
              !this.match('SEMICOLON')
            ) {
              // Stop if next token looks like a new prop declaration
              if (
                (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') &&
                this.tokens[this.pos + 1]?.type === 'COLON' &&
                valParts.length > 0
              ) {
                break;
              }
              valParts.push(this.advance().value);
            }
            defaultValue = valParts.join(' ').trim();
          }
          // Handle (default: value) syntax
          if (this.match('LPAREN')) {
            this.advance();
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
        const slotName = this.advance().value;

        // Handle both `slotName: widget("type", { ... });` and `widgetName { desc }`
        if (this.match('COLON')) {
          this.advance();
          // Expect widget("type", { ... })
          if (this.match('KEYWORD', 'widget') || this.match('IDENT')) {
            const widgetRef = this.advance().value;
            if (widgetRef === 'widget' && this.match('LPAREN')) {
              this.advance();
              // First arg is the widget type string
              if (this.match('STRING_LIT')) {
                const widgetType = this.advance().value;
                widgets.push(widgetType);
              }
              // Skip remaining args until )
              let parenDepth = 1;
              while (parenDepth > 0 && !this.match('EOF')) {
                if (this.match('LPAREN')) parenDepth++;
                if (this.match('RPAREN')) parenDepth--;
                if (parenDepth > 0) this.advance();
              }
              if (this.match('RPAREN')) this.advance();
            } else {
              widgets.push(widgetRef);
            }
          }
          if (this.match('SEMICOLON')) this.advance();
        } else {
          // Simple form: widgetName { description }
          widgets.push(slotName);
          if (this.match('LBRACE')) this.skipBraceBlock();
          if (this.match('SEMICOLON')) this.advance();
        }
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return widgets;
  }

  /**
   * Parse `aria { partName -> { attr: value; ... }; ... }`
   * Grammar: partName ARROW LBRACE (attrName COLON value SEMICOLON)* RBRACE SEMICOLON
   */
  private parseAriaBindings(): WidgetAriaBinding[] {
    const bindings: WidgetAriaBinding[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
        const part = this.advance().value;
        if (this.match('ARROW')) {
          this.advance();
          const attrs = this.parseAttrBlock();
          bindings.push({ part, attrs });
          if (this.match('SEMICOLON')) this.advance();
        } else {
          // skip unexpected tokens
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return bindings;
  }

  /**
   * Parse `connect { partName -> { attr: value; ... } ... }`
   * Same grammar as aria bindings.
   */
  private parseConnect(): WidgetConnectBinding[] {
    const bindings: WidgetConnectBinding[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
        const part = this.advance().value;
        if (this.match('ARROW')) {
          this.advance();
          const attrs = this.parseAttrBlock();
          bindings.push({ part, attrs });
          if (this.match('SEMICOLON')) this.advance();
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return bindings;
  }

  /**
   * Parse a `{ name: value; name: value; }` attribute block.
   * Values are collected as raw strings — they may contain expressions
   * like `if state.display == "badge" then "collapsed" else "expanded"`,
   * `concat(...)`, `send(TAP)`, `?prop.field`, etc.
   */
  private parseAttrBlock(): { name: string; value: string }[] {
    const attrs: { name: string; value: string }[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();
      if (tok.type === 'IDENT' || tok.type === 'KEYWORD' || tok.type === 'STRING_LIT') {
        const name = this.advance().value;
        if (this.match('COLON')) {
          this.advance();
          // Collect everything until ; or }
          const valueParts: string[] = [];
          let parenDepth = 0;
          while (!this.match('EOF')) {
            if (this.match('SEMICOLON') && parenDepth === 0) break;
            if (this.match('RBRACE') && parenDepth === 0) break;
            if (this.match('LPAREN')) parenDepth++;
            if (this.match('RPAREN')) parenDepth--;
            valueParts.push(this.advance().value);
          }
          attrs.push({ name, value: valueParts.join(' ').trim() });
          if (this.match('SEMICOLON')) this.advance();
        } else {
          // No colon — skip
        }
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return attrs;
  }

  /**
   * Parse `invariant { ... }` block.
   *
   * Supports two formats:
   * 1. Legacy prose strings: `invariant { "text"; "text"; }`
   *    → each string becomes an InvariantDecl with kind='example' and name = the string text
   * 2. Structured invariants (same syntax as concept parser):
   *    `invariant { example "name": { after ... then ... } always "name": { ... } }`
   */
  private parseInvariant(): InvariantDecl[] {
    const invariants: InvariantDecl[] = [];
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();

      // Structured invariant keywords
      if (tok.type === 'KEYWORD' && (
        tok.value === 'example' || tok.value === 'forall' ||
        tok.value === 'always' || tok.value === 'never' ||
        tok.value === 'eventually'
      )) {
        invariants.push(this.parseNamedInvariantBody(
          tok.value as 'example' | 'forall' | 'always' | 'never' | 'eventually',
        ));
        if (this.match('SEMICOLON')) this.advance();
        continue;
      }

      // Action requires/ensures contract
      if (tok.type === 'KEYWORD' && tok.value === 'action') {
        invariants.push(this.parseActionContract());
        if (this.match('SEMICOLON')) this.advance();
        continue;
      }

      // Legacy prose string → wrap as kind='example' with the string as the name
      if (tok.type === 'STRING_LIT') {
        const text = this.advance().value;
        invariants.push({
          kind: 'example',
          name: text,
          afterPatterns: [],
          thenPatterns: [],
        });
        if (this.match('SEMICOLON')) this.advance();
        continue;
      }

      // Skip unrecognized tokens
      this.advance();
    }

    if (this.match('RBRACE')) this.advance();
    return invariants;
  }

  // ================================================================
  // Structured Invariant Parsing (mirrors concept parser)
  // ================================================================

  /**
   * Parse a named invariant body after the keyword has been identified.
   * Handles: example, forall, always, never, eventually
   */
  private parseNamedInvariantBody(
    keyword: 'example' | 'forall' | 'always' | 'never' | 'eventually',
  ): InvariantDecl {
    this.advance(); // consume the keyword

    // Parse optional name: "string"
    let name: string | undefined;
    if (this.match('STRING_LIT')) {
      name = this.advance().value;
    }

    // Consume optional colon after name
    if (this.match('COLON')) {
      this.advance();
    }

    this.expect('LBRACE');

    if (keyword === 'example') {
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

    // Fallback
    this.skipBraceBlockInner();
    return { kind: keyword, name, afterPatterns: [], thenPatterns: [] };
  }

  /**
   * Parse a bare invariant body: after/then/and chains.
   * Expects to be called after the opening { has been consumed.
   * Consumes the closing }.
   */
  private parseBareInvariantBody(): InvariantDecl {
    // Parse optional "when" guard clause
    let whenClause: InvariantWhenClause | undefined;
    if (this.match('KEYWORD', 'when')) {
      this.advance();
      whenClause = this.parseWhenClause();
    }

    // Parse "after" pattern(s)
    this.expect('KEYWORD', 'after');
    const afterPatterns: ActionPattern[] = [];
    afterPatterns.push(this.parseActionPattern());

    while (this.match('KEYWORD', 'and') && !this.match('KEYWORD', 'then')) {
      this.advance();
      afterPatterns.push(this.parseActionPattern());
    }

    // Parse "then" chain
    const thenSteps: InvariantASTStep[] = [];
    if (this.match('KEYWORD', 'then')) {
      this.advance();
      thenSteps.push(this.parseInvariantASTStep());

      while (true) {
        if (this.match('KEYWORD', 'and')) {
          this.advance();
          thenSteps.push(this.parseInvariantASTStep());
        } else if (this.match('KEYWORD', 'then')) {
          this.advance();
          thenSteps.push(this.parseInvariantASTStep());
        } else {
          break;
        }
      }
    }

    // Parse optional trailing "when" guard
    if (!whenClause && this.match('KEYWORD', 'when')) {
      this.advance();
      whenClause = this.parseWhenClause();
    }

    this.expect('RBRACE');
    return { kind: 'example', afterPatterns, thenPatterns: thenSteps, whenClause };
  }

  /**
   * Parse forall body: `given x in {set} after ... then ...`
   */
  private parseForallBody(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];

    while (this.match('KEYWORD', 'given')) {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    const afterPatterns: ActionPattern[] = [];
    const thenSteps: InvariantASTStep[] = [];

    if (this.match('KEYWORD', 'after')) {
      this.advance();
      afterPatterns.push(this.parseActionPattern());
      while (this.match('KEYWORD', 'and')) {
        this.advance();
        afterPatterns.push(this.parseActionPattern());
      }
    }

    if (this.match('KEYWORD', 'then')) {
      this.advance();
      thenSteps.push(this.parseInvariantASTStep());
      while (this.match('KEYWORD', 'and')) {
        this.advance();
        thenSteps.push(this.parseInvariantASTStep());
      }
    }

    this.expect('RBRACE');
    return { kind: 'forall', name, afterPatterns, thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse always body: `forall p in state_field: predicate`
   */
  private parseAlwaysBody(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    if (this.match('KEYWORD', 'forall')) {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    if (this.match('COLON')) this.advance();

    while (!this.match('RBRACE') && !this.match('EOF')) {
      thenSteps.push(this.parseInvariantASTStep());
      if (this.match('KEYWORD', 'and')) {
        this.advance();
      }
    }

    this.expect('RBRACE');
    return { kind: 'always', name, afterPatterns: [], thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse never body: `exists p in state_field: bad_predicate`
   */
  private parseNeverBody(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    if (this.match('KEYWORD', 'exists')) {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    if (this.match('COLON')) this.advance();

    while (!this.match('RBRACE') && !this.match('EOF')) {
      thenSteps.push(this.parseInvariantASTStep());
      if (this.match('KEYWORD', 'and')) {
        this.advance();
      }
    }

    this.expect('RBRACE');
    return { kind: 'never', name, afterPatterns: [], thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse eventually body: `forall r where cond: outcome`
   */
  private parseEventuallyBody(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    if (this.match('KEYWORD', 'forall')) {
      this.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    if (this.match('COLON')) this.advance();

    while (!this.match('RBRACE') && !this.match('EOF')) {
      thenSteps.push(this.parseInvariantASTStep());
      if (this.match('KEYWORD', 'and')) {
        this.advance();
      }
    }

    this.expect('RBRACE');
    return { kind: 'eventually', name, afterPatterns: [], thenPatterns: thenSteps, quantifiers };
  }

  /**
   * Parse action requires/ensures contract block:
   * `action X { requires: P  ensures ok: Q }`
   */
  private parseActionContract(): InvariantDecl {
    this.advance(); // consume 'action'
    const targetAction = this.advance().value;
    this.expect('LBRACE');

    const contracts: ActionContract[] = [];

    while (!this.match('RBRACE') && !this.match('EOF')) {
      if (this.match('KEYWORD', 'requires')) {
        this.advance();
        if (this.match('COLON')) this.advance();
        const predicate = this.parseAssertion();
        contracts.push({ kind: 'requires', predicate });
      } else if (this.match('KEYWORD', 'ensures')) {
        this.advance();
        // Parse optional variant name
        let variant: string | undefined;
        if (
          (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') &&
          this.tokens[this.pos + 1]?.type === 'COLON'
        ) {
          variant = this.advance().value;
          this.advance(); // consume colon
        }
        if (!variant && this.match('COLON')) this.advance();
        const predicate = this.parseAssertion();
        contracts.push({ kind: 'ensures', variant, predicate });
      } else {
        this.advance();
      }
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

  // ================================================================
  // Invariant Helpers (assertion parsing, quantifiers, action patterns)
  // ================================================================

  /**
   * Parse one step in a then-chain: action pattern or property assertion.
   */
  private parseInvariantASTStep(): InvariantASTStep {
    const tok = this.peek();
    const next = this.tokens[this.pos + 1];

    // Dot-access assertion: var.field op value
    if (
      (tok.type === 'IDENT' || tok.type === 'KEYWORD') &&
      next?.type === 'DOT'
    ) {
      return { kind: 'assertion', ...this.parseAssertion() };
    }

    // Comparison assertion: var op value
    if (
      (tok.type === 'IDENT' || tok.type === 'KEYWORD') &&
      next && (
        next.type === 'EQUALS' || next.type === 'NOT_EQUALS' ||
        next.type === 'GT' || next.type === 'GTE' ||
        next.type === 'LT' || next.type === 'LTE' ||
        (next.type === 'KEYWORD' && next.value === 'in')
      )
    ) {
      return { kind: 'assertion', ...this.parseAssertion() };
    }

    // Action pattern
    return { kind: 'action', ...this.parseActionPattern() };
  }

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

    // Bool literal
    if (tok.type === 'BOOL_LIT') {
      this.advance();
      return { type: 'literal', value: tok.value === 'true' };
    }

    // List literal: [...]
    if (tok.type === 'LBRACKET') {
      this.advance();
      const items: AssertionExpr[] = [];
      if (!this.match('RBRACKET')) {
        items.push(this.parseAssertionExpr());
        while (this.match('COMMA')) {
          this.advance();
          items.push(this.parseAssertionExpr());
        }
      }
      this.expect('RBRACKET');
      return { type: 'list', items };
    }

    // Set literal: {"a", "b", "c"} — used in `x in {"a", "b"}` assertions
    if (tok.type === 'LBRACE') {
      this.advance();
      const items: AssertionExpr[] = [];
      while (!this.match('RBRACE') && !this.match('EOF')) {
        items.push(this.parseAssertionExpr());
        if (this.match('COMMA')) this.advance();
      }
      this.expect('RBRACE');
      return { type: 'list', items };
    }

    // Identifier — could be var.field or just a variable
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      this.advance();
      if (this.peek().type === 'DOT') {
        this.advance(); // consume DOT
        const field = this.advance().value;
        return { type: 'dot_access', variable: tok.value, field };
      }
      return { type: 'variable', name: tok.value };
    }

    throw new Error(
      `Widget parse error at line ${tok.line}: expected assertion expression, got ${tok.type}(${tok.value})`,
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
        break;
    }
    throw new Error(
      `Widget parse error at line ${tok.line}: expected comparison operator, got ${tok.type}(${tok.value})`,
    );
  }

  private parseWhenClause(): InvariantWhenClause {
    const conditions: InvariantAssertion[] = [];
    conditions.push(this.parseAssertion());
    while (this.match('KEYWORD', 'and')) {
      this.advance();
      conditions.push(this.parseAssertion());
    }
    return { conditions };
  }

  private parseActionPattern(): ActionPattern {
    const actionName = this.advance().value;
    this.expect('LPAREN');
    const inputArgs = this.parseArgPatterns();
    this.expect('RPAREN');
    this.expect('ARROW');
    const variantName = this.advance().value;
    let outputArgs: ArgPattern[] = [];
    if (this.match('LPAREN')) {
      this.advance();
      outputArgs = this.parseArgPatterns();
      this.expect('RPAREN');
    }
    return { actionName, inputArgs, variantName, outputArgs };
  }

  private parseArgPatterns(): ArgPattern[] {
    const args: ArgPattern[] = [];
    if (this.match('RPAREN')) return args;

    args.push(this.parseArgPattern());
    while (this.match('COMMA')) {
      this.advance();
      if (this.match('RPAREN')) break;
      args.push(this.parseArgPattern());
    }
    return args;
  }

  private parseArgPattern(): ArgPattern {
    const name = this.advance().value;
    this.expect('COLON');
    const value = this.parseArgPatternValue();
    return { name, value };
  }

  private parseArgPatternValue(): ArgPatternValue {
    const tok = this.peek();

    // none literal
    if (tok.type === 'KEYWORD' && tok.value === 'none') {
      this.advance();
      return { type: 'literal', value: false };
    }

    if (tok.type === 'STRING_LIT') {
      this.advance();
      return { type: 'literal', value: tok.value };
    }
    if (tok.type === 'INT_LIT') {
      this.advance();
      return { type: 'literal', value: parseInt(tok.value, 10) };
    }
    if (tok.type === 'BOOL_LIT') {
      this.advance();
      return { type: 'literal', value: tok.value === 'true' };
    }

    // Identifier or dot-access
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      this.advance();
      if (this.peek().type === 'DOT') {
        this.advance();
        const field = this.advance().value;
        return { type: 'dot_access', variable: tok.value, field };
      }
      return { type: 'variable', name: tok.value };
    }

    throw new Error(
      `Widget parse error at line ${tok.line}: expected arg pattern value, got ${tok.type}(${tok.value})`,
    );
  }

  private parseQuantifierBinding(): QuantifierBinding {
    const variable = this.advance().value;
    this.expect('KEYWORD', 'in');
    const domain = this.parseQuantifierDomain();

    let whereCondition: InvariantAssertion | undefined;
    if (this.match('KEYWORD', 'where')) {
      this.advance();
      whereCondition = this.parseAssertion();
    }

    return { variable, domain, whereCondition };
  }

  private parseQuantifierDomain(): QuantifierDomain {
    const tok = this.peek();

    // Set literal: {"a", "b", "c"}
    if (tok.type === 'LBRACE') {
      this.advance();
      const values: string[] = [];
      while (!this.match('RBRACE') && !this.match('EOF')) {
        if (this.match('STRING_LIT')) {
          values.push(this.advance().value);
        } else if (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD') {
          values.push(this.advance().value);
        } else {
          this.advance();
        }
        if (this.match('COMMA')) this.advance();
      }
      this.expect('RBRACE');
      return { type: 'set_literal', values };
    }

    // State field reference or type reference
    const name = this.advance().value;
    if (name[0] === name[0].toUpperCase() && name.length > 1) {
      return { type: 'type_ref', name };
    }
    return { type: 'state_field', name };
  }

  /**
   * Skip tokens inside a brace block (after opening { has been consumed).
   * Consumes everything up to and including the matching }.
   */
  private skipBraceBlockInner(): void {
    let depth = 1;
    while (depth > 0 && !this.match('EOF')) {
      const tok = this.advance();
      if (tok.type === 'LBRACE') depth++;
      else if (tok.type === 'RBRACE') depth--;
    }
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
