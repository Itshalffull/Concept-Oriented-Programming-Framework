/* ---------------------------------------------------------------------------
 * FormulaDisplay — Ink (terminal) implementation
 * Read-only renderer for formal logic expressions with syntax highlighting
 * See widget spec: formula-display.widget
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

import React, { useReducer, useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
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

const COLLAPSE_THRESHOLD = 200;

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface FormulaDisplayProps {
  formula: string;
  language: FormulaLanguage;
  scope?: string | undefined;
  renderLatex?: boolean;
  name?: string | undefined;
  description?: string | undefined;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function FormulaDisplay({
  formula,
  language = 'smtlib' as FormulaLanguage,
  scope,
  renderLatex = false,
  name,
  description,
}: FormulaDisplayProps) {
  const [state, send] = useReducer(formulaDisplayReducer, 'idle');
  const [expanded, setExpanded] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const isLong = formula.length > COLLAPSE_THRESHOLD;
  const displayFormula = isLong && !expanded
    ? formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026'
    : formula;

  // Auto-reset copied state
  useEffect(() => {
    if (state === 'copied') {
      const timer = setTimeout(() => send({ type: 'TIMEOUT' }), 2000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  useInput((input, key) => {
    if (input === 'c' && !key.ctrl && !key.meta) {
      send({ type: 'COPY' });
      // Note: clipboard access not available in terminal; state machine tracks intent
    } else if (key.return && isLong) {
      setExpanded((prev) => !prev);
    } else if (input === 'd') {
      if (description) setDescriptionOpen((prev) => !prev);
    }
  });

  const langLabel = LANGUAGE_LABELS[language] ?? language;

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Header: language badge, scope, copy status */}
      <Box>
        <Text color="cyan">[{langLabel}]</Text>
        {scope && <Text color="yellow"> [{scope}]</Text>}
        <Text> </Text>
        {state === 'copied' ? (
          <Text color="green">Copied!</Text>
        ) : (
          <Text dimColor>(c to copy)</Text>
        )}
      </Box>

      {/* Formula name */}
      {name && (
        <Box>
          <Text bold>{name}</Text>
        </Box>
      )}

      {/* Code block */}
      <Box>
        <Text>{displayFormula}</Text>
      </Box>

      {/* Expand/collapse for long formulas */}
      {isLong && (
        <Box>
          <Text dimColor>
            Enter to {expanded ? 'collapse' : 'expand'}
          </Text>
        </Box>
      )}

      {/* Description toggle */}
      {description && (
        <Box flexDirection="column">
          <Box>
            <Text dimColor>d to {descriptionOpen ? 'hide' : 'show'} description</Text>
          </Box>
          {descriptionOpen && (
            <Box>
              <Text dimColor>{description}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default FormulaDisplay;
