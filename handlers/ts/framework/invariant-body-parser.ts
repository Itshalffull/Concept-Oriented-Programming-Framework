// ============================================================
// Clef Kernel - Shared Invariant Body Parser
//
// Grammar-unification helper (PRD: invariant-grammar-portability,
// MAG-910 / INV-6). Both the concept parser (.concept) and the
// widget spec parser (.widget) used to duplicate ~600 lines each
// of invariant-body parsing logic. This module extracts that
// shared logic behind a minimal `TokenStream` abstraction so
// each host parser only implements the small differences that
// touch its own tokeniser/AST surface.
//
// Callers construct an `InvariantBodyParser` with:
//   - a `TokenStream` view over their own token array, and
//   - an `AssertionContext` that resolves identifiers against
//     the host's namespace (concept action table vs widget
//     anatomy+FSM tables). The context is currently used only
//     for diagnostics and future validation hooks — it does not
//     alter the AST shape.
//
// The AST produced (InvariantDecl, InvariantASTStep, ActionPattern,
// QuantifierBinding, InvariantAssertion, AssertionExpr) is the same
// shape declared in runtime/types.ts and is byte-identical to what
// the previous in-parser implementations produced.
// ============================================================

import type {
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
} from '../../../runtime/types.js';

// --- Token stream abstraction ----------------------------------------------

export interface BasicToken {
  type: string;
  value: string;
  line: number;
  col: number;
}

/**
 * Minimal shape both the concept-parser and widget-parser token streams
 * must expose to be driven by the shared invariant parser.
 *
 * `match` returns the token on a match and consumes it (normalised to the
 * concept-parser's shape; the widget parser's boolean-returning match is
 * wrapped at adapter construction time).
 */
export interface TokenStream {
  peek(): BasicToken;
  peekAt(offset: number): BasicToken | undefined;
  advance(): BasicToken;
  expect(type: string, value?: string): BasicToken;
  match(type: string, value?: string): BasicToken | null;
  /** Consume an ident-shaped token (IDENT or KEYWORD). */
  expectIdent(): BasicToken;
  /**
   * Skip inter-statement separators. A no-op for grammars that do not
   * emit separator tokens (e.g. the widget parser's SEMICOLON-free
   * invariant sub-grammar).
   */
  skipSeps(): void;
  /** Current token index — used for savepoint/rollback on fallback paths. */
  position(): number;
  /** Restore the stream to an earlier savepoint. */
  seek(pos: number): void;
}

// --- Assertion context -----------------------------------------------------

export type ResolvedIdentifier =
  | { kind: 'action'; concept?: string; action: string }
  | { kind: 'part'; part: string }
  | { kind: 'state'; field: string }
  | { kind: 'query-column'; column: string }
  | { kind: 'fixture'; fixture: string };

export interface AssertionContext {
  /** Resolve an identifier in the host spec's namespace. Null if unknown. */
  resolveIdentifier(name: string): ResolvedIdentifier | null;
  /** Top-level symbols known to the host (used for diagnostics only). */
  declaredSymbols(): string[];
}

// --- Parser options --------------------------------------------------------

export interface InvariantBodyParserOptions {
  /**
   * When a structured invariant body fails to parse, fall back to
   * consuming tokens until the closing brace and returning an empty
   * InvariantDecl of the right kind. Used by the concept parser to
   * tolerate prose-style invariants; the widget parser propagates errors
   * instead.
   */
  withFallback: boolean;

  /**
   * Accept dotted action names in action patterns (`body.type(args)`).
   * Widget grammar uses this to express part-method calls; concept
   * grammar does not.
   */
  dottedActionNames: boolean;

  /**
   * Accept bare literals as positional args (`_0`, `_1`, ...) in action
   * patterns. Widget grammar only.
   */
  positionalArgs: boolean;

  /**
   * Require a trailing `-> variant` on action patterns. Widget grammar
   * is strict; concept grammar allows bare action calls without a variant.
   */
  requireVariantArrow: boolean;

  /**
   * Accept FLOAT_LIT tokens in assertion expressions and arg pattern
   * values. Concept tokeniser emits these; widget tokeniser does not.
   */
  supportsFloatLit: boolean;

  /**
   * Accept `{...}` as a set literal inside an assertion expression
   * (widget grammar). Concept grammar never takes this path.
   */
  supportsBraceSetInAssertion: boolean;

  /**
   * Accept record and list literals as arg-pattern values. Concept
   * grammar supports nested records/lists; widget grammar does not.
   */
  supportsRecordAndListArgValues: boolean;

  /**
   * Support the `not in` comparison operator. Concept grammar only.
   */
  supportsNotIn: boolean;

  /**
   * Accept PRIMITIVE tokens as variable names in arg patterns. Concept
   * parser emits a PRIMITIVE token type; widget parser does not.
   */
  supportsPrimitiveAsVariable: boolean;

  /**
   * Accept prose-style `action X requires { … } ensures { … }` blocks
   * and stray top-level `action X(params) { variants }` declarations.
   * Concept grammar only.
   */
  supportsProseActionContract: boolean;

  /**
   * Consume inter-statement separator tokens between invariant steps.
   * True for concept (SEP tokens); false for widget (no separator tokens
   * between invariant pieces).
   */
  useSkipSeps: boolean;

  /**
   * Error-message prefix, e.g. "Parse error" or "Widget parse error",
   * used so throws remain identical to the in-parser implementations.
   */
  errorPrefix: string;
}

export const CONCEPT_OPTIONS: InvariantBodyParserOptions = {
  withFallback: true,
  dottedActionNames: false,
  positionalArgs: false,
  requireVariantArrow: false,
  supportsFloatLit: true,
  supportsBraceSetInAssertion: false,
  supportsRecordAndListArgValues: true,
  supportsNotIn: true,
  supportsPrimitiveAsVariable: true,
  supportsProseActionContract: true,
  useSkipSeps: true,
  errorPrefix: 'Parse error',
};

export const WIDGET_OPTIONS: InvariantBodyParserOptions = {
  withFallback: false,
  dottedActionNames: true,
  positionalArgs: true,
  requireVariantArrow: true,
  supportsFloatLit: false,
  supportsBraceSetInAssertion: true,
  supportsRecordAndListArgValues: false,
  supportsNotIn: false,
  supportsPrimitiveAsVariable: false,
  supportsProseActionContract: false,
  useSkipSeps: false,
  errorPrefix: 'Widget parse error',
};

// --- Shared parser ---------------------------------------------------------

type NamedKind = 'example' | 'forall' | 'always' | 'never' | 'eventually';

export class InvariantBodyParser {
  private positionalArgCounter = 0;

  constructor(
    private stream: TokenStream,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _ctx: AssertionContext,
    private opts: InvariantBodyParserOptions,
  ) {}

  private skipSeps(): void {
    if (this.opts.useSkipSeps) this.stream.skipSeps();
  }

  private errorAt(tok: BasicToken, msg: string): Error {
    const loc = this.opts.errorPrefix === 'Parse error'
      ? `at line ${tok.line}:${tok.col}`
      : `at line ${tok.line}`;
    return new Error(`${this.opts.errorPrefix} ${loc}: ${msg}`);
  }

  // ------------------------------------------------------------------
  // Entry points
  // ------------------------------------------------------------------

  /**
   * Parse the contents of a top-level `invariant { … }` block. The caller
   * is expected to have consumed the `invariant` keyword and the opening
   * `{`. This method consumes up to and including the closing `}`.
   *
   * Returns the list of invariant declarations found inside. Empty list
   * is allowed.
   */
  parseInvariantBlock(legacyProseStrings = false): InvariantDecl[] {
    const results: InvariantDecl[] = [];

    this.skipSeps();
    // Check for named sub-invariants vs bare after/then body
    const tok = this.stream.peek();
    const isNamedSubInvariant = tok.type === 'KEYWORD' && (
      tok.value === 'example' || tok.value === 'forall' ||
      tok.value === 'always' || tok.value === 'never' ||
      tok.value === 'eventually' || tok.value === 'action'
    );

    // Widget legacy-prose mode: `invariant { "text"; "text"; }`
    if (legacyProseStrings && !isNamedSubInvariant) {
      while (this.stream.peek().type !== 'RBRACE' && this.stream.peek().type !== 'EOF') {
        const t = this.stream.peek();
        if (t.type === 'KEYWORD' && (
          t.value === 'example' || t.value === 'forall' ||
          t.value === 'always' || t.value === 'never' ||
          t.value === 'eventually'
        )) {
          results.push(this.parseNamedInvariantBody(t.value as NamedKind));
          this.stream.match('SEMICOLON');
          continue;
        }
        if (t.type === 'KEYWORD' && t.value === 'action') {
          results.push(this.parseActionContract());
          this.stream.match('SEMICOLON');
          continue;
        }
        if (t.type === 'STRING_LIT') {
          const text = this.stream.advance().value;
          results.push({
            kind: 'example',
            name: text,
            afterPatterns: [],
            thenPatterns: [],
          });
          this.stream.match('SEMICOLON');
          continue;
        }
        this.stream.advance(); // skip unrecognised
      }
      if (this.stream.peek().type === 'RBRACE') this.stream.advance();
      return results;
    }

    if (isNamedSubInvariant) {
      while (this.stream.peek().type !== 'RBRACE' && this.stream.peek().type !== 'EOF') {
        this.skipSeps();
        if (this.stream.peek().type === 'RBRACE') break;

        const kw = this.stream.peek();
        if (kw.type === 'KEYWORD' && kw.value === 'action') {
          results.push(this.parseActionContract());
        } else if (kw.type === 'KEYWORD' && (
          kw.value === 'example' || kw.value === 'forall' ||
          kw.value === 'always' || kw.value === 'never' ||
          kw.value === 'eventually'
        )) {
          results.push(this.parseNamedInvariantBody(kw.value as NamedKind));
        } else if (legacyProseStrings && kw.type === 'STRING_LIT') {
          // Mixed mode: legacy prose strings interleaved with structured
          // invariants inside the same `invariant { … }` block.
          const text = this.stream.advance().value;
          results.push({
            kind: 'example',
            name: text,
            afterPatterns: [],
            thenPatterns: [],
          });
          this.stream.match('SEMICOLON');
        } else {
          // Unknown token — skip
          this.stream.advance();
        }
        this.skipSeps();
      }
      this.stream.expect('RBRACE');
      return results;
    }

    // Bare invariant body: `invariant { after … then … }`
    results.push(this.parseBareInvariantBody());
    return results;
  }

  /**
   * Parse a named invariant body after one of the keywords (example,
   * forall, always, never, eventually) has been identified. This method
   * consumes the keyword itself.
   */
  parseNamedInvariantBody(keyword: NamedKind): InvariantDecl {
    this.stream.advance(); // consume keyword

    // Optional name: "string"
    let name: string | undefined;
    this.skipSeps();
    if (this.stream.peek().type === 'STRING_LIT') {
      name = this.stream.advance().value;
    }

    // Optional colon after name
    this.skipSeps();
    if (this.stream.peek().type === 'COLON') {
      this.stream.advance();
    }

    this.skipSeps();
    this.stream.expect('LBRACE');

    if (keyword === 'example') {
      const result = this.parseBareInvariantBody();
      return { ...result, kind: 'example', name };
    }
    if (keyword === 'forall') return this.parseForallBody(name);
    if (keyword === 'always') return this.parseAlwaysBody(name);
    if (keyword === 'never') return this.parseNeverBody(name);
    if (keyword === 'eventually') return this.parseEventuallyBody(name);

    this.skipToClosingBrace();
    return { kind: keyword, name, afterPatterns: [], thenPatterns: [] };
  }

  /**
   * Parse a top-level `action X { … }` contract (requires/ensures).
   * Consumes the `action` keyword.
   */
  parseActionContract(): InvariantDecl {
    this.stream.advance(); // consume 'action'
    const targetAction = this.stream.expectIdent().value;

    if (this.opts.supportsProseActionContract) {
      // Prose-style: `action X requires { ... } ensures { ... }`
      if (
        this.stream.peek().type === 'KEYWORD' &&
        (this.stream.peek().value === 'requires' || this.stream.peek().value === 'ensures')
      ) {
        while (
          this.stream.peek().type === 'KEYWORD' &&
          (this.stream.peek().value === 'requires' || this.stream.peek().value === 'ensures')
        ) {
          this.stream.advance();
          if (this.stream.peek().type === 'LBRACE') {
            this.stream.advance();
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

      // Stray action decl: `action X(params) { variants }`
      if (this.stream.peek().type === 'LPAREN') {
        this.stream.advance();
        let parenDepth = 1;
        while (parenDepth > 0 && this.stream.peek().type !== 'EOF') {
          const t = this.stream.advance();
          if (t.type === 'LPAREN') parenDepth++;
          else if (t.type === 'RPAREN') parenDepth--;
        }
        if (this.stream.peek().type === 'LBRACE') {
          this.stream.advance();
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
    }

    this.stream.expect('LBRACE');

    const save = this.stream.position();
    try {
      return this.parseActionContractStructured(targetAction);
    } catch (e) {
      if (!this.opts.withFallback) throw e;
      this.stream.seek(save);
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

  // ------------------------------------------------------------------
  // Body variants
  // ------------------------------------------------------------------

  private parseBareInvariantBody(): InvariantDecl {
    const save = this.stream.position();
    try {
      return this.parseBareInvariantBodyStructured();
    } catch (e) {
      if (!this.opts.withFallback) throw e;
      this.stream.seek(save);
      this.skipToClosingBrace();
      return { kind: 'example', afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseBareInvariantBodyStructured(): InvariantDecl {
    // Optional name: "string":
    this.skipSeps();
    let name: string | undefined;
    if (this.stream.peek().type === 'STRING_LIT') {
      const next = this.stream.peekAt(1);
      if (next && next.type === 'COLON') {
        name = this.stream.advance().value;
        this.stream.advance(); // colon
      }
    }

    // Optional leading "when"
    this.skipSeps();
    let whenClause: InvariantWhenClause | undefined;
    if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'when') {
      this.stream.advance();
      whenClause = this.parseWhenClause();
      this.skipSeps();
    }

    // "after" pattern(s)
    this.skipSeps();
    this.stream.expect('KEYWORD', 'after');
    const afterPatterns: ActionPattern[] = [];
    afterPatterns.push(this.parseActionPattern());

    while (this.isSepOrAnd()) {
      this.skipSeps();
      if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'and') {
        this.stream.advance();
        afterPatterns.push(this.parseActionPattern());
      } else if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'then') {
        break;
      } else {
        break;
      }
    }

    // "then" chain
    const thenSteps: InvariantASTStep[] = [];
    this.skipSeps();
    if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'then') {
      this.stream.advance();
      thenSteps.push(this.parseInvariantASTStep());

      while (true) {
        this.skipSeps();
        const t = this.stream.peek();
        if (t.type === 'KEYWORD' && t.value === 'and') {
          this.stream.advance();
          this.skipSeps();
          thenSteps.push(this.parseInvariantASTStep());
        } else if (t.type === 'KEYWORD' && t.value === 'then') {
          this.stream.advance();
          this.skipSeps();
          thenSteps.push(this.parseInvariantASTStep());
        } else {
          break;
        }
      }
    }

    // Optional trailing "when"
    if (!whenClause) {
      this.skipSeps();
      if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'when') {
        this.stream.advance();
        whenClause = this.parseWhenClause();
      }
    }

    this.skipSeps();
    this.stream.expect('RBRACE');
    return { kind: 'example', name, afterPatterns, thenPatterns: thenSteps, whenClause };
  }

  private isSepOrAnd(): boolean {
    const t = this.stream.peek();
    if (this.opts.useSkipSeps && t.type === 'SEP') return true;
    return t.type === 'KEYWORD' && t.value === 'and';
  }

  private parseForallBody(name?: string): InvariantDecl {
    const save = this.stream.position();
    try {
      return this.parseForallBodyStructured(name);
    } catch (e) {
      if (!this.opts.withFallback) throw e;
      this.stream.seek(save);
      this.skipToClosingBrace();
      return { kind: 'forall', name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseForallBodyStructured(name?: string): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];

    this.skipSeps();
    while (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'given') {
      this.stream.advance();
      quantifiers.push(this.parseQuantifierBinding());
      this.skipSeps();
    }

    const afterPatterns: ActionPattern[] = [];
    const thenSteps: InvariantASTStep[] = [];
    const whenClause: InvariantWhenClause | undefined = undefined;

    this.skipSeps();
    if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'after') {
      this.stream.advance();
      afterPatterns.push(this.parseActionPattern());
      while (this.isSepOrAnd()) {
        this.skipSeps();
        if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'and') {
          this.stream.advance();
          afterPatterns.push(this.parseActionPattern());
        } else if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'then') {
          break;
        } else {
          break;
        }
      }
    }

    this.skipSeps();
    if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'then') {
      this.stream.advance();
      thenSteps.push(this.parseInvariantASTStep());
      while (true) {
        this.skipSeps();
        if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'and') {
          this.stream.advance();
          this.skipSeps();
          thenSteps.push(this.parseInvariantASTStep());
        } else {
          break;
        }
      }
    }

    this.skipSeps();
    this.stream.expect('RBRACE');
    return { kind: 'forall', name, afterPatterns, thenPatterns: thenSteps, quantifiers, whenClause };
  }

  private parseAlwaysBody(name?: string): InvariantDecl {
    return this.parseQuantifiedPredicateBody('always', name, ['forall']);
  }

  private parseNeverBody(name?: string): InvariantDecl {
    return this.parseQuantifiedPredicateBody('never', name, ['exists', 'forall']);
  }

  private parseEventuallyBody(name?: string): InvariantDecl {
    return this.parseQuantifiedPredicateBody('eventually', name, ['forall']);
  }

  private parseQuantifiedPredicateBody(
    kind: 'always' | 'never' | 'eventually',
    name: string | undefined,
    allowedQuantifierKeywords: string[],
  ): InvariantDecl {
    const save = this.stream.position();
    try {
      return this.parseQuantifiedPredicateBodyStructured(kind, name, allowedQuantifierKeywords);
    } catch (e) {
      if (!this.opts.withFallback) throw e;
      this.stream.seek(save);
      this.skipToClosingBrace();
      return { kind, name, afterPatterns: [], thenPatterns: [] };
    }
  }

  private parseQuantifiedPredicateBodyStructured(
    kind: 'always' | 'never' | 'eventually',
    name: string | undefined,
    allowedQuantifierKeywords: string[],
  ): InvariantDecl {
    const quantifiers: QuantifierBinding[] = [];
    const thenSteps: InvariantASTStep[] = [];

    this.skipSeps();
    const t = this.stream.peek();
    if (t.type === 'KEYWORD' && allowedQuantifierKeywords.includes(t.value)) {
      this.stream.advance();
      quantifiers.push(this.parseQuantifierBinding());
    }

    this.skipSeps();
    if (this.stream.peek().type === 'COLON') this.stream.advance();

    this.skipSeps();
    while (this.stream.peek().type !== 'RBRACE' && this.stream.peek().type !== 'EOF') {
      thenSteps.push(this.parseInvariantASTStep());
      this.skipSeps();
      if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'and') {
        this.stream.advance();
        this.skipSeps();
      }
    }

    this.stream.expect('RBRACE');
    return { kind, name, afterPatterns: [], thenPatterns: thenSteps, quantifiers };
  }

  private parseActionContractStructured(targetAction: string): InvariantDecl {
    const contracts: ActionContract[] = [];
    this.skipSeps();

    while (this.stream.peek().type !== 'RBRACE' && this.stream.peek().type !== 'EOF') {
      const kw = this.stream.peek();
      if (kw.type === 'KEYWORD' && kw.value === 'requires') {
        this.stream.advance();
        if (this.stream.peek().type === 'COLON') this.stream.advance();
        this.skipSeps();
        const predicate = this.parseAssertion();
        contracts.push({ kind: 'requires', predicate });
      } else if (kw.type === 'KEYWORD' && kw.value === 'ensures') {
        this.stream.advance();
        let variant: string | undefined;
        this.skipSeps();
        const peek0 = this.stream.peek();
        if (
          peek0.type === 'IDENT' ||
          (peek0.type === 'KEYWORD' && peek0.value !== 'requires' && peek0.value !== 'ensures')
        ) {
          const next = this.stream.peekAt(1);
          if (next && next.type === 'COLON') {
            variant = this.stream.advance().value;
            this.stream.advance();
          }
        }
        if (!variant && this.stream.peek().type === 'COLON') this.stream.advance();
        this.skipSeps();
        const predicate = this.parseAssertion();
        contracts.push({ kind: 'ensures', variant, predicate });
      } else {
        this.stream.advance();
      }
      this.skipSeps();
    }

    this.stream.expect('RBRACE');
    return {
      kind: 'requires_ensures',
      targetAction,
      afterPatterns: [],
      thenPatterns: [],
      contracts,
    };
  }

  // ------------------------------------------------------------------
  // Steps / patterns / assertions
  // ------------------------------------------------------------------

  parseQuantifierBinding(): QuantifierBinding {
    const variable = this.stream.expectIdent().value;
    this.skipSeps();
    this.stream.expect('KEYWORD', 'in');
    this.skipSeps();
    const domain = this.parseQuantifierDomain();

    let whereCondition: InvariantAssertion | undefined;
    this.skipSeps();
    if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'where') {
      this.stream.advance();
      this.skipSeps();
      whereCondition = this.parseAssertion();
    }
    return { variable, domain, whereCondition };
  }

  private parseQuantifierDomain(): QuantifierDomain {
    const tok = this.stream.peek();

    if (tok.type === 'LBRACE') {
      this.stream.advance();
      const values: string[] = [];
      this.skipSeps();
      while (this.stream.peek().type !== 'RBRACE' && this.stream.peek().type !== 'EOF') {
        const t = this.stream.peek();
        if (t.type === 'STRING_LIT') values.push(this.stream.advance().value);
        else if (t.type === 'IDENT' || t.type === 'KEYWORD') values.push(this.stream.advance().value);
        else this.stream.advance();
        this.skipSeps();
        if (this.stream.peek().type === 'COMMA') this.stream.advance();
        this.skipSeps();
      }
      this.stream.expect('RBRACE');
      return { type: 'set_literal', values };
    }

    const name = this.stream.expectIdent().value;
    if (name[0] === name[0].toUpperCase() && name.length > 1) {
      return { type: 'type_ref', name };
    }
    return { type: 'state_field', name };
  }

  parseWhenClause(): InvariantWhenClause {
    const conditions: InvariantAssertion[] = [];
    conditions.push(this.parseAssertion());
    while (true) {
      this.skipSeps();
      if (this.stream.peek().type === 'KEYWORD' && this.stream.peek().value === 'and') {
        this.stream.advance();
        this.skipSeps();
        conditions.push(this.parseAssertion());
      } else {
        break;
      }
    }
    return { conditions };
  }

  parseInvariantASTStep(): InvariantASTStep {
    const tok = this.stream.peek();
    const next = this.stream.peekAt(1);

    // Dot-access: could be action.variant(args) pattern or assertion
    if ((tok.type === 'IDENT' || tok.type === 'KEYWORD') && next?.type === 'DOT') {
      const afterDot = this.stream.peekAt(2);
      const afterAfterDot = this.stream.peekAt(3);
      // Only the concept grammar uses action.variant(args) as a pattern.
      // The widget grammar uses dotted identifiers as part-method calls
      // (e.g. body.type(...)) which are handled by parseActionPattern via
      // the dottedActionNames option — at this layer we treat those as
      // action patterns too, so the same check works for both.
      if (
        !this.opts.dottedActionNames &&
        afterDot && (afterDot.type === 'IDENT' || afterDot.type === 'KEYWORD') &&
        afterAfterDot && afterAfterDot.type === 'LPAREN'
      ) {
        const actionName = this.stream.advance().value;
        this.stream.advance(); // DOT
        const variantName = this.stream.advance().value;
        this.stream.advance(); // LPAREN
        const outputArgs = this.parseArgPatterns();
        this.stream.expect('RPAREN');
        return { kind: 'action', actionName, inputArgs: [], variantName, outputArgs };
      }
      if (
        this.opts.dottedActionNames &&
        afterDot && (afterDot.type === 'IDENT' || afterDot.type === 'KEYWORD') &&
        afterAfterDot && afterAfterDot.type === 'LPAREN'
      ) {
        // widget grammar: `part.method(args) -> variant` is an action pattern
        return { kind: 'action', ...this.parseActionPattern() };
      }
      return { kind: 'assertion', ...this.parseAssertion() };
    }

    if (
      (tok.type === 'IDENT' || tok.type === 'KEYWORD') &&
      next && (
        next.type === 'EQUALS' || next.type === 'NOT_EQUALS' ||
        next.type === 'GT' || next.type === 'GTE' ||
        next.type === 'LT' || next.type === 'LTE' ||
        (next.type === 'KEYWORD' && next.value === 'in') ||
        (this.opts.supportsNotIn && next.type === 'KEYWORD' && next.value === 'not')
      )
    ) {
      return { kind: 'assertion', ...this.parseAssertion() };
    }

    return { kind: 'action', ...this.parseActionPattern() };
  }

  private parseAssertion(): InvariantAssertion {
    const left = this.parseAssertionExpr();
    const op = this.parseComparisonOp();
    const right = this.parseAssertionExpr();
    return { left, operator: op, right };
  }

  private parseAssertionExpr(): AssertionExpr {
    const tok = this.stream.peek();

    if (tok.type === 'KEYWORD' && tok.value === 'none') {
      this.stream.advance();
      return { type: 'literal', value: null };
    }
    if (tok.type === 'STRING_LIT') {
      this.stream.advance();
      return { type: 'literal', value: tok.value };
    }
    if (tok.type === 'INT_LIT') {
      this.stream.advance();
      return { type: 'literal', value: parseInt(tok.value, 10) };
    }
    if (this.opts.supportsFloatLit && tok.type === 'FLOAT_LIT') {
      this.stream.advance();
      return { type: 'literal', value: parseFloat(tok.value) };
    }
    if (tok.type === 'BOOL_LIT') {
      this.stream.advance();
      return { type: 'literal', value: tok.value === 'true' };
    }
    if (tok.type === 'LBRACKET') {
      this.stream.advance();
      const items: AssertionExpr[] = [];
      if (this.stream.peek().type !== 'RBRACKET') {
        items.push(this.parseAssertionExpr());
        while (this.stream.match('COMMA')) {
          items.push(this.parseAssertionExpr());
        }
      }
      this.stream.expect('RBRACKET');
      return { type: 'list', items };
    }
    if (this.opts.supportsBraceSetInAssertion && tok.type === 'LBRACE') {
      this.stream.advance();
      const items: AssertionExpr[] = [];
      while (this.stream.peek().type !== 'RBRACE' && this.stream.peek().type !== 'EOF') {
        items.push(this.parseAssertionExpr());
        if (this.stream.peek().type === 'COMMA') this.stream.advance();
      }
      this.stream.expect('RBRACE');
      return { type: 'list', items };
    }
    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      this.stream.advance();
      if (this.stream.peek().type === 'DOT') {
        this.stream.advance();
        const field = this.stream.advance().value;
        return { type: 'dot_access', variable: tok.value, field };
      }
      return { type: 'variable', name: tok.value };
    }

    throw this.errorAt(tok, `expected assertion expression, got ${tok.type}(${tok.value})`);
  }

  private parseComparisonOp(): InvariantAssertion['operator'] {
    const tok = this.stream.peek();
    switch (tok.type) {
      case 'EQUALS': this.stream.advance(); return '=';
      case 'NOT_EQUALS': this.stream.advance(); return '!=';
      case 'GT': this.stream.advance(); return '>';
      case 'LT': this.stream.advance(); return '<';
      case 'GTE': this.stream.advance(); return '>=';
      case 'LTE': this.stream.advance(); return '<=';
      case 'KEYWORD':
        if (tok.value === 'in') { this.stream.advance(); return 'in'; }
        if (this.opts.supportsNotIn && tok.value === 'not') {
          const next = this.stream.peekAt(1);
          if (next && next.type === 'KEYWORD' && next.value === 'in') {
            this.stream.advance();
            this.stream.advance();
            return 'not in' as InvariantAssertion['operator'];
          }
        }
        break;
    }
    throw this.errorAt(tok, `expected comparison operator, got ${tok.type}(${tok.value})`);
  }

  parseActionPattern(): ActionPattern {
    this.skipSeps();

    let actionName: string;
    if (this.opts.dottedActionNames) {
      actionName = this.stream.advance().value;
      if (this.stream.peek().type === 'DOT') {
        this.stream.advance();
        const method = this.stream.advance().value;
        actionName = `${actionName}.${method}`;
      }
    } else {
      actionName = this.stream.expectIdent().value;
    }

    let inputArgs: ArgPattern[] = [];
    if (this.opts.positionalArgs) this.positionalArgCounter = 0;

    if (this.stream.peek().type === 'LPAREN') {
      this.stream.advance();
      inputArgs = this.parseArgPatterns();
      this.stream.expect('RPAREN');
    } else if (this.opts.requireVariantArrow) {
      // Widget requires LPAREN before ARROW — missing paren is a parse error
      this.stream.expect('LPAREN');
    }

    this.skipSeps();

    let variantName = '';
    let outputArgs: ArgPattern[] = [];
    if (this.opts.requireVariantArrow) {
      this.stream.expect('ARROW');
      variantName = this.stream.advance().value;
      if (this.stream.match('LPAREN')) {
        outputArgs = this.parseArgPatterns();
        this.stream.expect('RPAREN');
      }
    } else if (this.stream.peek().type === 'ARROW') {
      this.stream.advance();
      variantName = this.stream.expectIdent().value;
      if (this.stream.peek().type === 'LPAREN') {
        this.stream.advance();
        outputArgs = this.parseArgPatterns();
        this.stream.expect('RPAREN');
      }
    }

    return { actionName, inputArgs, variantName, outputArgs };
  }

  private parseArgPatterns(): ArgPattern[] {
    const args: ArgPattern[] = [];
    this.skipSeps();
    if (this.stream.peek().type === 'RPAREN') return args;

    args.push(this.parseArgPattern());
    while (this.stream.match('COMMA')) {
      this.skipSeps();
      if (this.stream.peek().type === 'RPAREN') break;
      args.push(this.parseArgPattern());
    }
    this.skipSeps();
    return args;
  }

  private parseArgPattern(): ArgPattern {
    if (this.stream.peek().type === 'ELLIPSIS') {
      this.stream.advance();
      return { name: '...', value: { type: 'spread' } };
    }

    if (this.opts.positionalArgs) {
      const tok = this.stream.peek();
      const isPositional =
        tok.type === 'STRING_LIT' ||
        tok.type === 'INT_LIT' ||
        tok.type === 'BOOL_LIT' ||
        (tok.type === 'KEYWORD' && tok.value === 'none');
      if (isPositional) {
        const value = this.parseArgPatternValue();
        return { name: `_${this.positionalArgCounter++}`, value };
      }
      const name = this.stream.advance().value;
      this.stream.expect('COLON');
      const value = this.parseArgPatternValue();
      return { name, value };
    }

    const name = this.stream.expectIdent().value;
    this.stream.expect('COLON');
    const value = this.parseArgPatternValue();
    return { name, value };
  }

  private parseArgPatternValue(): ArgPatternValue {
    const tok = this.stream.peek();

    if (tok.type === 'ELLIPSIS') {
      this.stream.advance();
      return { type: 'spread' };
    }
    if (tok.type === 'KEYWORD' && tok.value === 'none') {
      this.stream.advance();
      return { type: 'literal', value: false };
    }
    if (tok.type === 'STRING_LIT') {
      this.stream.advance();
      return { type: 'literal', value: tok.value };
    }
    if (tok.type === 'INT_LIT') {
      this.stream.advance();
      return { type: 'literal', value: parseInt(tok.value, 10) };
    }
    if (this.opts.supportsFloatLit && tok.type === 'FLOAT_LIT') {
      this.stream.advance();
      return { type: 'literal', value: parseFloat(tok.value) };
    }
    if (tok.type === 'BOOL_LIT') {
      this.stream.advance();
      return { type: 'literal', value: tok.value === 'true' };
    }

    if (this.opts.supportsRecordAndListArgValues && tok.type === 'LBRACE') {
      this.stream.advance();
      this.skipSeps();
      const fields: ArgPattern[] = [];
      if (this.stream.peek().type !== 'RBRACE') {
        fields.push(this.parseArgPattern());
        while (this.stream.match('COMMA')) {
          this.skipSeps();
          if (this.stream.peek().type === 'RBRACE') break;
          fields.push(this.parseArgPattern());
        }
      }
      this.skipSeps();
      this.stream.expect('RBRACE');
      return { type: 'record', fields };
    }

    if (this.opts.supportsRecordAndListArgValues && tok.type === 'LBRACKET') {
      this.stream.advance();
      this.skipSeps();
      const items: ArgPatternValue[] = [];
      if (this.stream.peek().type !== 'RBRACKET') {
        items.push(this.parseArgPatternValue());
        while (this.stream.match('COMMA')) {
          this.skipSeps();
          if (this.stream.peek().type === 'RBRACKET') break;
          items.push(this.parseArgPatternValue());
        }
      }
      this.skipSeps();
      this.stream.expect('RBRACKET');
      return { type: 'list', items };
    }

    if (tok.type === 'IDENT' || tok.type === 'KEYWORD') {
      this.stream.advance();
      if (this.stream.peek().type === 'DOT') {
        this.stream.advance();
        const field = this.stream.advance().value;
        return { type: 'dot_access', variable: tok.value, field };
      }
      return { type: 'variable', name: tok.value };
    }

    if (this.opts.supportsPrimitiveAsVariable && tok.type === 'PRIMITIVE') {
      this.stream.advance();
      return { type: 'variable', name: tok.value };
    }

    throw this.errorAt(
      tok,
      this.opts.positionalArgs
        ? `expected arg pattern value, got ${tok.type}(${tok.value})`
        : `expected literal, variable, record, or list in arg pattern, got ${tok.type}(${tok.value})`,
    );
  }

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------

  private skipToClosingBrace(): void {
    let depth = 1;
    while (depth > 0 && this.stream.peek().type !== 'EOF') {
      const t = this.stream.advance();
      if (t.type === 'LBRACE') depth++;
      else if (t.type === 'RBRACE') depth--;
    }
  }
}
