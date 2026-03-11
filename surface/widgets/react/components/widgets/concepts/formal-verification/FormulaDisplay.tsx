/* ---------------------------------------------------------------------------
 * FormulaDisplay state machine
 * States: idle (initial), copied, rendering
 * ------------------------------------------------------------------------- */

export type FormulaDisplayState = 'idle' | 'copied' | 'rendering';
export type FormulaDisplayEvent =
  | { type: 'COPY' }
  | { type: 'RENDER_LATEX' }
  | { type: 'TIMEOUT' }
  | { type: 'RENDER_COMPLETE' };

export function formulaDisplayReducer(state: FormulaDisplayState, event: FormulaDisplayEvent): FormulaDisplayState {
  switch (state) {
    case 'idle':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'RENDER_LATEX') return 'rendering';
      return state;
    case 'copied':
      if (event.type === 'TIMEOUT') return 'idle';
      return state;
    case 'rendering':
      if (event.type === 'RENDER_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Language-specific keyword sets for syntax highlighting
 * ------------------------------------------------------------------------- */

type FormulaLanguage = 'smtlib' | 'tlaplus' | 'alloy' | 'lean' | 'dafny' | 'cvl';

const LANGUAGE_LABELS: Record<FormulaLanguage, string> = {
  smtlib: 'SMT-LIB',
  tlaplus: 'TLA+',
  alloy: 'Alloy',
  lean: 'Lean',
  dafny: 'Dafny',
  cvl: 'CVL',
};

const LANGUAGE_KEYWORDS: Record<FormulaLanguage, Set<string>> = {
  smtlib: new Set([
    'assert', 'check-sat', 'declare-fun', 'declare-const', 'define-fun',
    'forall', 'exists', 'let', 'and', 'or', 'not', 'ite', 'true', 'false',
    'Int', 'Bool', 'Real', 'Array', 'set-logic', 'push', 'pop',
  ]),
  tlaplus: new Set([
    'VARIABLE', 'VARIABLES', 'CONSTANT', 'CONSTANTS', 'ASSUME', 'THEOREM',
    'MODULE', 'EXTENDS', 'INSTANCE', 'LOCAL', 'LET', 'IN', 'IF', 'THEN',
    'ELSE', 'CHOOSE', 'CASE', 'OTHER', 'ENABLED', 'UNCHANGED', 'EXCEPT',
    'DOMAIN', 'SUBSET', 'UNION', 'TRUE', 'FALSE',
  ]),
  alloy: new Set([
    'sig', 'abstract', 'extends', 'fact', 'fun', 'pred', 'assert', 'check',
    'run', 'open', 'module', 'lone', 'one', 'some', 'no', 'all', 'disj',
    'set', 'seq', 'let', 'in', 'and', 'or', 'not', 'implies', 'iff',
    'else', 'none', 'univ', 'iden',
  ]),
  lean: new Set([
    'theorem', 'lemma', 'def', 'axiom', 'constant', 'variable', 'example',
    'inductive', 'structure', 'class', 'instance', 'where', 'let', 'in',
    'have', 'show', 'assume', 'match', 'with', 'if', 'then', 'else',
    'forall', 'fun', 'by', 'sorry', 'Prop', 'Type', 'Sort', 'true', 'false',
  ]),
  dafny: new Set([
    'method', 'function', 'predicate', 'lemma', 'class', 'module', 'import',
    'requires', 'ensures', 'invariant', 'decreases', 'modifies', 'reads',
    'var', 'ghost', 'forall', 'exists', 'if', 'then', 'else', 'while',
    'assert', 'assume', 'return', 'returns', 'true', 'false', 'old', 'fresh',
    'nat', 'int', 'bool', 'seq', 'set', 'map', 'multiset',
  ]),
  cvl: new Set([
    'rule', 'invariant', 'ghost', 'hook', 'definition', 'methods', 'filtered',
    'require', 'assert', 'satisfy', 'env', 'calldataarg', 'storage',
    'forall', 'exists', 'sinvoke', 'invoke', 'if', 'else', 'return',
    'true', 'false', 'uint256', 'address', 'bool', 'bytes32', 'mathint',
  ]),
};

const OPERATOR_PATTERN = /^(=>|->|<->|<=|>=|!=|==|&&|\|\||\\\/|\/\\|!|~|\+|-|\*|\/|%|::|:=|:|\|)/;
const NUMBER_PATTERN = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/;

/* ---------------------------------------------------------------------------
 * Token types for syntax highlighting
 * ------------------------------------------------------------------------- */

type TokenType = 'keyword' | 'operator' | 'number' | 'string' | 'comment' | 'paren' | 'text';

interface Token {
  type: TokenType;
  value: string;
}

/** Tokenize a formula string for syntax highlighting. */
function tokenize(formula: string, language: FormulaLanguage): Token[] {
  const keywords = LANGUAGE_KEYWORDS[language];
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const rest = formula.slice(i);

    // Whitespace
    const wsMatch = rest.match(/^(\s+)/);
    if (wsMatch) {
      tokens.push({ type: 'text', value: wsMatch[1] });
      i += wsMatch[1].length;
      continue;
    }

    // Single-line comment (-- or ;; or //)
    const commentMatch = rest.match(/^(--|;;|\/\/)(.*)$/m);
    if (commentMatch) {
      tokens.push({ type: 'comment', value: commentMatch[0] });
      i += commentMatch[0].length;
      continue;
    }

    // String literal
    if (rest[0] === '"') {
      const endIdx = rest.indexOf('"', 1);
      const str = endIdx === -1 ? rest : rest.slice(0, endIdx + 1);
      tokens.push({ type: 'string', value: str });
      i += str.length;
      continue;
    }

    // Parentheses / brackets
    if ('()[]{}⟨⟩'.includes(rest[0])) {
      tokens.push({ type: 'paren', value: rest[0] });
      i += 1;
      continue;
    }

    // Operators
    const opMatch = rest.match(OPERATOR_PATTERN);
    if (opMatch) {
      tokens.push({ type: 'operator', value: opMatch[1] });
      i += opMatch[1].length;
      continue;
    }

    // Numbers
    const numMatch = rest.match(NUMBER_PATTERN);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[1] });
      i += numMatch[1].length;
      continue;
    }

    // Words (identifiers / keywords)
    const wordMatch = rest.match(/^[a-zA-Z_$?'][a-zA-Z0-9_$?'-]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const type: TokenType = keywords.has(word) ? 'keyword' : 'text';
      tokens.push({ type, value: word });
      i += word.length;
      continue;
    }

    // Fallback: single character
    tokens.push({ type: 'text', value: rest[0] });
    i += 1;
  }

  return tokens;
}

/* ---------------------------------------------------------------------------
 * Collapse threshold (characters)
 * ------------------------------------------------------------------------- */

const COLLAPSE_THRESHOLD = 200;

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface FormulaDisplayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The formula / logic expression text. */
  formula: string;
  /** Formal language the formula is written in. */
  language: FormulaLanguage;
  /** Optional property scope (local, global, sync, etc.). */
  scope?: string | undefined;
  /** Whether to attempt LaTeX rendering (future use). */
  renderLatex?: boolean;
  /** Optional human-readable name for the formula. */
  name?: string | undefined;
  /** Optional description text (shown in collapsible panel). */
  description?: string | undefined;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const FormulaDisplay = forwardRef<HTMLDivElement, FormulaDisplayProps>(
  function FormulaDisplay(
    {
      formula,
      language = 'smtlib',
      scope,
      renderLatex = false,
      name,
      description,
      // Destructure to avoid forwarding non-DOM props
      children: _children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(formulaDisplayReducer, 'idle');
    const [expanded, setExpanded] = useState(false);
    const [descriptionOpen, setDescriptionOpen] = useState(false);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const codeBlockRef = useRef<HTMLPreElement>(null);

    const isLong = formula.length > COLLAPSE_THRESHOLD;
    const displayFormula = isLong && !expanded ? formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026' : formula;
    const tokens = tokenize(displayFormula, language);

    /* -- Copy to clipboard ------------------------------------------------ */
    const handleCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(formula);
      } catch {
        // Fallback for insecure contexts
        const ta = document.createElement('textarea');
        ta.value = formula;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      send({ type: 'COPY' });
    }, [formula]);

    /* -- Auto-reset copied state after 2 seconds -------------------------- */
    useEffect(() => {
      if (state === 'copied') {
        copyTimerRef.current = setTimeout(() => send({ type: 'TIMEOUT' }), 2000);
        return () => clearTimeout(copyTimerRef.current);
      }
    }, [state]);

    /* -- LaTeX rendering trigger ------------------------------------------ */
    useEffect(() => {
      if (renderLatex && state === 'idle') {
        send({ type: 'RENDER_LATEX' });
        // Simulate render completion (in production, hook into actual renderer)
        const timer = setTimeout(() => send({ type: 'RENDER_COMPLETE' }), 100);
        return () => clearTimeout(timer);
      }
    }, [renderLatex]); // eslint-disable-line react-hooks/exhaustive-deps

    /* -- Keyboard handler ------------------------------------------------- */
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString()) {
          e.preventDefault();
          handleCopy();
        }
        if (e.key === 'Enter' && isLong) {
          e.preventDefault();
          setExpanded((prev) => !prev);
        }
      },
      [handleCopy, isLong],
    );

    const ariaLabel = name
      ? `Formula: ${name} in ${LANGUAGE_LABELS[language]}`
      : `Formula in ${LANGUAGE_LABELS[language]}`;

    const descriptionId = description
      ? `fd-desc-${Math.random().toString(36).slice(2, 9)}`
      : undefined;

    return (
      <div
        ref={ref}
        role="figure"
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
        data-surface-widget=""
        data-widget-name="formula-display"
        data-part="root"
        data-state={state}
        data-language={language}
        data-expanded={expanded ? 'true' : 'false'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {/* Header bar: language badge, optional scope badge, copy button */}
        <div data-part="header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            data-part="lang-badge"
            role="presentation"
            data-language={language}
            style={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              border: '1px solid currentColor',
              opacity: 0.8,
            }}
          >
            {LANGUAGE_LABELS[language]}
          </span>

          {scope && (
            <span
              data-part="scope-badge"
              data-visible="true"
              style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                opacity: 0.7,
              }}
            >
              {scope}
            </span>
          )}

          <button
            type="button"
            data-part="copy-button"
            data-state={state === 'copied' ? 'copied' : 'idle'}
            role="button"
            aria-label="Copy formula to clipboard"
            tabIndex={0}
            onClick={handleCopy}
            style={{
              marginLeft: 'auto',
              cursor: 'pointer',
              background: 'none',
              border: '1px solid currentColor',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              color: 'inherit',
            }}
          >
            {state === 'copied' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Formula name, if provided */}
        {name && (
          <div
            data-part="name"
            style={{
              fontWeight: 600,
              marginTop: '0.375rem',
              marginBottom: '0.25rem',
            }}
          >
            {name}
          </div>
        )}

        {/* Code block with syntax-highlighted formula */}
        <pre
          ref={codeBlockRef}
          data-part="code-block"
          data-language={language}
          data-latex={renderLatex ? 'true' : 'false'}
          role="code"
          aria-label="Formula text"
          tabIndex={-1}
          style={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: '0.5rem 0 0',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            overflow: 'auto',
            lineHeight: 1.5,
          }}
        >
          <code>
            {tokens.map((token, idx) => (
              <span
                key={idx}
                data-token-type={token.type}
                style={
                  token.type === 'keyword'
                    ? { fontWeight: 700, color: 'var(--fd-keyword, #7c3aed)' }
                    : token.type === 'operator'
                      ? { color: 'var(--fd-operator, #d97706)' }
                      : token.type === 'number'
                        ? { color: 'var(--fd-number, #0891b2)' }
                        : token.type === 'string'
                          ? { color: 'var(--fd-string, #16a34a)' }
                          : token.type === 'comment'
                            ? { color: 'var(--fd-comment, #9ca3af)', fontStyle: 'italic' }
                            : token.type === 'paren'
                              ? { color: 'var(--fd-paren, #6b7280)' }
                              : undefined
                }
              >
                {token.value}
              </span>
            ))}
          </code>
        </pre>

        {/* Expand/collapse toggle for long formulas */}
        {isLong && (
          <button
            type="button"
            data-part="expand-toggle"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse formula' : 'Expand formula'}
            tabIndex={0}
            onClick={() => setExpanded((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0.25rem 0',
              color: 'inherit',
              textDecoration: 'underline',
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Collapsible description panel */}
        {description && (
          <div data-part="description-panel">
            <button
              type="button"
              data-part="description-toggle"
              aria-expanded={descriptionOpen}
              aria-controls={descriptionId}
              tabIndex={0}
              onClick={() => setDescriptionOpen((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '0.25rem 0',
                color: 'inherit',
                textDecoration: 'underline',
              }}
            >
              {descriptionOpen ? 'Hide description' : 'Show description'}
            </button>
            {descriptionOpen && (
              <div
                id={descriptionId}
                data-part="description"
                role="note"
                style={{
                  fontSize: '0.875rem',
                  padding: '0.375rem 0',
                  opacity: 0.85,
                  lineHeight: 1.4,
                }}
              >
                {description}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

FormulaDisplay.displayName = 'FormulaDisplay';
export { FormulaDisplay };
export default FormulaDisplay;
