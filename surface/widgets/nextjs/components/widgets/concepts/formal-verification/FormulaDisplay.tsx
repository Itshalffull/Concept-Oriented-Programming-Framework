import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Language configuration
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
  smtlib: new Set(['assert', 'check-sat', 'declare-fun', 'declare-const', 'define-fun', 'forall', 'exists', 'let', 'and', 'or', 'not', 'ite', 'true', 'false', 'Int', 'Bool', 'Real', 'Array', 'set-logic', 'push', 'pop']),
  tlaplus: new Set(['VARIABLE', 'VARIABLES', 'CONSTANT', 'CONSTANTS', 'ASSUME', 'THEOREM', 'MODULE', 'EXTENDS', 'INSTANCE', 'LOCAL', 'LET', 'IN', 'IF', 'THEN', 'ELSE', 'CHOOSE', 'CASE', 'OTHER', 'ENABLED', 'UNCHANGED', 'EXCEPT', 'DOMAIN', 'SUBSET', 'UNION', 'TRUE', 'FALSE']),
  alloy: new Set(['sig', 'abstract', 'extends', 'fact', 'fun', 'pred', 'assert', 'check', 'run', 'open', 'module', 'lone', 'one', 'some', 'no', 'all', 'disj', 'set', 'seq', 'let', 'in', 'and', 'or', 'not', 'implies', 'iff', 'else', 'none', 'univ', 'iden']),
  lean: new Set(['theorem', 'lemma', 'def', 'axiom', 'constant', 'variable', 'example', 'inductive', 'structure', 'class', 'instance', 'where', 'let', 'in', 'have', 'show', 'assume', 'match', 'with', 'if', 'then', 'else', 'forall', 'fun', 'by', 'sorry', 'Prop', 'Type', 'Sort', 'true', 'false']),
  dafny: new Set(['method', 'function', 'predicate', 'lemma', 'class', 'module', 'import', 'requires', 'ensures', 'invariant', 'decreases', 'modifies', 'reads', 'var', 'ghost', 'forall', 'exists', 'if', 'then', 'else', 'while', 'assert', 'assume', 'return', 'returns', 'true', 'false', 'old', 'fresh', 'nat', 'int', 'bool', 'seq', 'set', 'map', 'multiset']),
  cvl: new Set(['rule', 'invariant', 'ghost', 'hook', 'definition', 'methods', 'filtered', 'require', 'assert', 'satisfy', 'env', 'calldataarg', 'storage', 'forall', 'exists', 'sinvoke', 'invoke', 'if', 'else', 'return', 'true', 'false', 'uint256', 'address', 'bool', 'bytes32', 'mathint']),
};

const OPERATOR_PATTERN = /^(=>|->|<->|<=|>=|!=|==|&&|\|\||\\\/|\/\\|!|~|\+|-|\*|\/|%|::|:=|:|\|)/;
const NUMBER_PATTERN = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/;

/* ---------------------------------------------------------------------------
 * Tokenizer
 * ------------------------------------------------------------------------- */

type TokenType = 'keyword' | 'operator' | 'number' | 'string' | 'comment' | 'paren' | 'text';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(formula: string, language: FormulaLanguage): Token[] {
  const keywords = LANGUAGE_KEYWORDS[language];
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const rest = formula.slice(i);

    const wsMatch = rest.match(/^(\s+)/);
    if (wsMatch) { tokens.push({ type: 'text', value: wsMatch[1] }); i += wsMatch[1].length; continue; }

    const commentMatch = rest.match(/^(--|;;|\/\/)(.*)$/m);
    if (commentMatch) { tokens.push({ type: 'comment', value: commentMatch[0] }); i += commentMatch[0].length; continue; }

    if (rest[0] === '"') {
      const endIdx = rest.indexOf('"', 1);
      const str = endIdx === -1 ? rest : rest.slice(0, endIdx + 1);
      tokens.push({ type: 'string', value: str }); i += str.length; continue;
    }

    if ('()[]{}⟨⟩'.includes(rest[0])) { tokens.push({ type: 'paren', value: rest[0] }); i += 1; continue; }

    const opMatch = rest.match(OPERATOR_PATTERN);
    if (opMatch) { tokens.push({ type: 'operator', value: opMatch[1] }); i += opMatch[1].length; continue; }

    const numMatch = rest.match(NUMBER_PATTERN);
    if (numMatch) { tokens.push({ type: 'number', value: numMatch[1] }); i += numMatch[1].length; continue; }

    const wordMatch = rest.match(/^[a-zA-Z_$?'][a-zA-Z0-9_$?'-]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      tokens.push({ type: keywords.has(word) ? 'keyword' : 'text', value: word });
      i += word.length; continue;
    }

    tokens.push({ type: 'text', value: rest[0] }); i += 1;
  }
  return tokens;
}

const COLLAPSE_THRESHOLD = 200;

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface FormulaDisplayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  formula: string;
  language: FormulaLanguage;
  scope?: string | undefined;
  renderLatex?: boolean;
  name?: string | undefined;
  description?: string | undefined;
  /** Whether long formulas are shown expanded (default: false). */
  expanded?: boolean;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function FormulaDisplay({
  formula,
  language = 'smtlib' as FormulaLanguage,
  scope,
  renderLatex = false,
  name,
  description,
  expanded = false,
  children: _children,
  ...rest
}: FormulaDisplayProps) {
  const isLong = formula.length > COLLAPSE_THRESHOLD;
  const displayFormula = isLong && !expanded ? formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026' : formula;
  const tokens = tokenize(displayFormula, language);

  const ariaLabel = name
    ? `Formula: ${name} in ${LANGUAGE_LABELS[language]}`
    : `Formula in ${LANGUAGE_LABELS[language]}`;

  return (
    <div
      role="figure"
      aria-label={ariaLabel}
      data-surface-widget=""
      data-widget-name="formula-display"
      data-part="root"
      data-state="idle"
      data-language={language}
      data-expanded={expanded ? 'true' : 'false'}
      tabIndex={0}
      {...rest}
    >
      {/* Header bar */}
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
          data-state="idle"
          role="button"
          aria-label="Copy formula to clipboard"
          tabIndex={0}
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
          Copy
        </button>
      </div>

      {/* Formula name */}
      {name && (
        <div
          data-part="name"
          style={{ fontWeight: 600, marginTop: '0.375rem', marginBottom: '0.25rem' }}
        >
          {name}
        </div>
      )}

      {/* Code block with syntax-highlighted formula */}
      <pre
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

      {/* Description panel */}
      {description && (
        <div data-part="description-panel">
          <div
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
        </div>
      )}
    </div>
  );
}

export { FormulaDisplay };
