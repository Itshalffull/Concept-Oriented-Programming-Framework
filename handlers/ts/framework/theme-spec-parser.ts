// ============================================================
// Clef Kernel - .theme File Parser
// Tokenizer + Recursive Descent Parser for theme specifications
// Produces ThemeManifest typed IR.
// ============================================================

import type { ThemeManifest } from '../../../runtime/types.js';

// --- Token Types ---

type TokenType =
  | 'KEYWORD'
  | 'IDENT'
  | 'STRING_LIT'
  | 'INT_LIT'
  | 'FLOAT_LIT'
  | 'COLOR_LIT'
  | 'COLON'
  | 'COMMA'
  | 'SEMICOLON'
  | 'LBRACE'
  | 'RBRACE'
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
  'theme', 'extends', 'palette', 'typography', 'spacing', 'motion',
  'elevation', 'radius', 'purpose',
  'base', 'unit', 'scale',
]);

// --- Tokenizer ---

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  while (i < source.length) {
    if (source[i] === ' ' || source[i] === '\t' || source[i] === '\r') {
      i++; col++; continue;
    }
    if (source[i] === '\n') {
      i++; line++; col = 1; continue;
    }

    // Comments
    if (source[i] === '#' || (source[i] === '/' && source[i + 1] === '/')) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // String literals
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      const startCol = col;
      i++; col++;
      let val = '';
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') { i++; col++; }
        val += source[i];
        i++; col++;
      }
      if (i < source.length) { i++; col++; }
      tokens.push({ type: 'STRING_LIT', value: val, line, col: startCol });
      continue;
    }

    const startCol = col;

    // Symbols
    switch (source[i]) {
      case '{': tokens.push({ type: 'LBRACE', value: '{', line, col }); i++; col++; continue;
      case '}': tokens.push({ type: 'RBRACE', value: '}', line, col }); i++; col++; continue;
      case '(': tokens.push({ type: 'LPAREN', value: '(', line, col }); i++; col++; continue;
      case ')': tokens.push({ type: 'RPAREN', value: ')', line, col }); i++; col++; continue;
      case ':': tokens.push({ type: 'COLON', value: ':', line, col }); i++; col++; continue;
      case ',': tokens.push({ type: 'COMMA', value: ',', line, col }); i++; col++; continue;
      case ';': tokens.push({ type: 'SEMICOLON', value: ';', line, col }); i++; col++; continue;
      case '@': tokens.push({ type: 'AT', value: '@', line, col }); i++; col++; continue;
    }

    // Color literals (oklch(...), hsl(...), #hex)
    if (source.slice(i).match(/^(oklch|hsl|rgb|hwb)\s*\(/)) {
      const funcMatch = source.slice(i).match(/^(oklch|hsl|rgb|hwb)\s*\([^)]*\)/);
      if (funcMatch) {
        tokens.push({ type: 'COLOR_LIT', value: funcMatch[0], line, col: startCol });
        i += funcMatch[0].length;
        col += funcMatch[0].length;
        continue;
      }
    }
    if (source[i] === '#' && /[0-9a-fA-F]/.test(source[i + 1] || '')) {
      let hex = '#';
      i++; col++;
      while (i < source.length && /[0-9a-fA-F]/.test(source[i])) {
        hex += source[i];
        i++; col++;
      }
      tokens.push({ type: 'COLOR_LIT', value: hex, line, col: startCol });
      continue;
    }

    // Numbers (including decimals and units like 4px, 0.25rem)
    if ((source[i] >= '0' && source[i] <= '9') || (source[i] === '-' && source[i + 1] >= '0' && source[i + 1] <= '9')) {
      let num = '';
      if (source[i] === '-') { num += '-'; i++; col++; }
      while (i < source.length && ((source[i] >= '0' && source[i] <= '9') || source[i] === '.')) {
        num += source[i];
        i++; col++;
      }
      // Include unit suffix (px, rem, ms, s, %)
      while (i < source.length && /[a-zA-Z%]/.test(source[i])) {
        num += source[i];
        i++; col++;
      }
      const type = num.includes('.') ? 'FLOAT_LIT' : 'INT_LIT';
      tokens.push({ type, value: num, line, col: startCol });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(source[i])) {
      let ident = '';
      while (i < source.length && /[\w-]/.test(source[i])) {
        ident += source[i];
        i++; col++;
      }
      if (KEYWORDS.has(ident)) {
        tokens.push({ type: 'KEYWORD', value: ident, line, col: startCol });
      } else {
        tokens.push({ type: 'IDENT', value: ident, line, col: startCol });
      }
      continue;
    }

    // Skip unknown
    i++; col++;
  }

  tokens.push({ type: 'EOF', value: '', line, col });
  return tokens;
}

// --- Parser ---

class ThemeSpecParser {
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
        `Theme parse error at line ${tok.line}: expected ${type}${value ? `(${value})` : ''}, got ${tok.type}(${tok.value})`,
      );
    }
    return tok;
  }

  private match(type: TokenType, value?: string): boolean {
    const tok = this.peek();
    return tok.type === type && (value === undefined || tok.value === value);
  }

  parseTheme(): ThemeManifest {
    // Skip annotations (@version etc.)
    while (this.match('AT')) {
      this.advance();
      this.advance();
      if (this.match('LPAREN')) {
        this.advance();
        while (!this.match('RPAREN') && !this.match('EOF')) this.advance();
        if (this.match('RPAREN')) this.advance();
      }
    }

    this.expect('KEYWORD', 'theme');
    const name = this.advance().value;

    let extendsTheme: string | undefined;
    if (this.match('KEYWORD', 'extends')) {
      this.advance();
      extendsTheme = this.advance().value;
    }

    this.expect('LBRACE');

    const manifest: ThemeManifest = {
      name,
      purpose: '',
      extends: extendsTheme,
      palette: {},
      colorRoles: {},
      typography: {},
      spacing: { scale: {} },
      motion: {},
      elevation: {},
      radius: {},
    };

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();

      if (tok.type === 'KEYWORD' && tok.value === 'purpose') {
        this.advance();
        manifest.purpose = this.readBraceBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'palette') {
        this.advance();
        manifest.palette = this.parseTokenBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'typography') {
        this.advance();
        manifest.typography = this.parseTokenBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'spacing') {
        this.advance();
        const tokens = this.parseTokenBlock();
        const unit = tokens['base'] || tokens['unit'];
        delete tokens['base'];
        delete tokens['unit'];
        manifest.spacing = { unit: unit as string | undefined, scale: tokens };
      } else if (tok.type === 'KEYWORD' && tok.value === 'motion') {
        this.advance();
        manifest.motion = this.parseTokenBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'elevation') {
        this.advance();
        manifest.elevation = this.parseTokenBlock();
      } else if (tok.type === 'KEYWORD' && tok.value === 'radius') {
        this.advance();
        manifest.radius = this.parseTokenBlock();
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return manifest;
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

  private parseTokenBlock(): Record<string, string> {
    const tokens: Record<string, string> = {};
    this.expect('LBRACE');

    while (!this.match('RBRACE') && !this.match('EOF')) {
      const tok = this.peek();

      // Skip sub-block comments (handled by tokenizer already)
      if (tok.type === 'IDENT' || tok.type === 'KEYWORD' || tok.type === 'INT_LIT') {
        const key = this.advance().value;

        if (this.match('COLON')) {
          this.advance();

          // Value can be: color literal, string, number, ident, or nested block
          if (this.match('LBRACE')) {
            // Nested token block — flatten with dot notation
            const nested = this.parseTokenBlock();
            for (const [nk, nv] of Object.entries(nested)) {
              tokens[`${key}.${nk}`] = nv;
            }
          } else {
            // Collect value tokens until semicolon or next key
            const valueParts: string[] = [];
            while (
              !this.match('SEMICOLON') &&
              !this.match('RBRACE') &&
              !this.match('EOF') &&
              // Stop if next token looks like a new key (ident followed by colon)
              !(
                (this.peek().type === 'IDENT' || this.peek().type === 'KEYWORD' || this.peek().type === 'INT_LIT') &&
                this.tokens[this.pos + 1]?.type === 'COLON'
              )
            ) {
              valueParts.push(this.advance().value);
            }
            tokens[key] = valueParts.join(' ');
          }
        }

        if (this.match('SEMICOLON')) this.advance();
      } else {
        this.advance();
      }
    }

    if (this.match('RBRACE')) this.advance();
    return tokens;
  }
}

/**
 * Parse a .theme file source string into a ThemeManifest.
 */
export function parseThemeFile(source: string): ThemeManifest {
  const tokens = tokenize(source);
  const parser = new ThemeSpecParser(tokens);
  return parser.parseTheme();
}
