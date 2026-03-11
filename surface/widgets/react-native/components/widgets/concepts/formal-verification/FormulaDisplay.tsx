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

import React, { forwardRef, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Clipboard } from 'react-native';

type FormulaLanguage = 'smtlib' | 'tlaplus' | 'alloy' | 'lean' | 'dafny' | 'cvl';

const LANGUAGE_LABELS: Record<FormulaLanguage, string> = {
  smtlib: 'SMT-LIB', tlaplus: 'TLA+', alloy: 'Alloy', lean: 'Lean', dafny: 'Dafny', cvl: 'CVL',
};

const LANGUAGE_KEYWORDS: Record<FormulaLanguage, Set<string>> = {
  smtlib: new Set(['assert', 'check-sat', 'declare-fun', 'declare-const', 'define-fun', 'forall', 'exists', 'let', 'and', 'or', 'not', 'ite', 'true', 'false', 'Int', 'Bool', 'Real']),
  tlaplus: new Set(['VARIABLE', 'VARIABLES', 'CONSTANT', 'CONSTANTS', 'ASSUME', 'THEOREM', 'MODULE', 'EXTENDS', 'INSTANCE', 'LET', 'IN', 'IF', 'THEN', 'ELSE', 'CHOOSE', 'TRUE', 'FALSE']),
  alloy: new Set(['sig', 'abstract', 'extends', 'fact', 'fun', 'pred', 'assert', 'check', 'run', 'open', 'module', 'lone', 'one', 'some', 'no', 'all', 'disj', 'set']),
  lean: new Set(['theorem', 'lemma', 'def', 'axiom', 'constant', 'variable', 'example', 'inductive', 'structure', 'class', 'instance', 'where', 'let', 'in', 'have', 'show', 'forall', 'by', 'Prop', 'Type']),
  dafny: new Set(['method', 'function', 'predicate', 'lemma', 'class', 'module', 'import', 'requires', 'ensures', 'invariant', 'decreases', 'modifies', 'var', 'ghost', 'forall', 'exists', 'assert', 'assume']),
  cvl: new Set(['rule', 'invariant', 'ghost', 'hook', 'definition', 'methods', 'filtered', 'require', 'assert', 'satisfy', 'env', 'calldataarg', 'storage', 'forall', 'exists']),
};

type TokenType = 'keyword' | 'operator' | 'number' | 'string' | 'comment' | 'paren' | 'text';
interface Token { type: TokenType; value: string; }

function tokenize(formula: string, language: FormulaLanguage): Token[] {
  const keywords = LANGUAGE_KEYWORDS[language];
  const tokens: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const rest = formula.slice(i);
    const ws = rest.match(/^(\s+)/);
    if (ws) { tokens.push({ type: 'text', value: ws[1] }); i += ws[1].length; continue; }
    const cm = rest.match(/^(--|;;|\/\/)(.*)$/m);
    if (cm) { tokens.push({ type: 'comment', value: cm[0] }); i += cm[0].length; continue; }
    if (rest[0] === '"') { const end = rest.indexOf('"', 1); const s = end === -1 ? rest : rest.slice(0, end + 1); tokens.push({ type: 'string', value: s }); i += s.length; continue; }
    if ('()[]{}' .includes(rest[0])) { tokens.push({ type: 'paren', value: rest[0] }); i += 1; continue; }
    const op = rest.match(/^(=>|->|<->|<=|>=|!=|==|&&|\|\||!|~|\+|-|\*|\/|%|::|:=|:|\|)/);
    if (op) { tokens.push({ type: 'operator', value: op[1] }); i += op[1].length; continue; }
    const nm = rest.match(/^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/);
    if (nm) { tokens.push({ type: 'number', value: nm[1] }); i += nm[1].length; continue; }
    const wd = rest.match(/^[a-zA-Z_$?'][a-zA-Z0-9_$?'-]*/);
    if (wd) { tokens.push({ type: keywords.has(wd[0]) ? 'keyword' : 'text', value: wd[0] }); i += wd[0].length; continue; }
    tokens.push({ type: 'text', value: rest[0] }); i += 1;
  }
  return tokens;
}

const COLLAPSE_THRESHOLD = 200;

const TOKEN_COLORS: Record<TokenType, string | undefined> = {
  keyword: '#7c3aed', operator: '#d97706', number: '#0891b2', string: '#16a34a', comment: '#9ca3af', paren: '#6b7280', text: undefined,
};

export interface FormulaDisplayProps {
  formula: string;
  language: FormulaLanguage;
  scope?: string | undefined;
  renderLatex?: boolean;
  name?: string | undefined;
  description?: string | undefined;
}

const FormulaDisplay = forwardRef<View, FormulaDisplayProps>(function FormulaDisplay(
  { formula, language = 'smtlib' as FormulaLanguage, scope, renderLatex = false, name, description },
  ref,
) {
  const [state, send] = useReducer(formulaDisplayReducer, 'idle');
  const [expanded, setExpanded] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isLong = formula.length > COLLAPSE_THRESHOLD;
  const displayFormula = isLong && !expanded ? formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026' : formula;
  const tokens = tokenize(displayFormula, language);

  const handleCopy = useCallback(async () => {
    try { await Clipboard.setString(formula); } catch {}
    send({ type: 'COPY' });
  }, [formula]);

  useEffect(() => {
    if (state === 'copied') {
      copyTimerRef.current = setTimeout(() => send({ type: 'TIMEOUT' }), 2000);
      return () => clearTimeout(copyTimerRef.current);
    }
  }, [state]);

  useEffect(() => {
    if (renderLatex && state === 'idle') {
      send({ type: 'RENDER_LATEX' });
      const t = setTimeout(() => send({ type: 'RENDER_COMPLETE' }), 100);
      return () => clearTimeout(t);
    }
  }, [renderLatex]);

  return (
    <View ref={ref} testID="formula-display" accessibilityRole="none"
      accessibilityLabel={name ? `Formula: ${name} in ${LANGUAGE_LABELS[language]}` : `Formula in ${LANGUAGE_LABELS[language]}`}
      style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.langBadge}>{LANGUAGE_LABELS[language]}</Text>
        {scope && <Text style={st.scopeBadge}>{scope}</Text>}
        <Pressable onPress={handleCopy} accessibilityRole="button" accessibilityLabel="Copy formula to clipboard" style={st.copyBtn}>
          <Text style={st.copyBtnText}>{state === 'copied' ? 'Copied!' : 'Copy'}</Text>
        </Pressable>
      </View>

      {name && <Text style={st.name}>{name}</Text>}

      {/* Code block */}
      <ScrollView horizontal style={st.codeBlock}>
        <Text style={st.code}>
          {tokens.map((token, idx) => (
            <Text key={idx} style={[
              token.type === 'keyword' && { fontWeight: '700', color: TOKEN_COLORS.keyword },
              token.type === 'operator' && { color: TOKEN_COLORS.operator },
              token.type === 'number' && { color: TOKEN_COLORS.number },
              token.type === 'string' && { color: TOKEN_COLORS.string },
              token.type === 'comment' && { color: TOKEN_COLORS.comment, fontStyle: 'italic' },
              token.type === 'paren' && { color: TOKEN_COLORS.paren },
            ]}>{token.value}</Text>
          ))}
        </Text>
      </ScrollView>

      {isLong && (
        <Pressable onPress={() => setExpanded((p) => !p)} accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse formula' : 'Expand formula'}>
          <Text style={st.toggleText}>{expanded ? 'Show less' : 'Show more'}</Text>
        </Pressable>
      )}

      {description && (
        <View>
          <Pressable onPress={() => setDescriptionOpen((p) => !p)} accessibilityRole="button"
            accessibilityState={{ expanded: descriptionOpen }}>
            <Text style={st.toggleText}>{descriptionOpen ? 'Hide description' : 'Show description'}</Text>
          </Pressable>
          {descriptionOpen && <Text style={st.description}>{description}</Text>}
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  root: { padding: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langBadge: { fontFamily: 'monospace', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 4, opacity: 0.8 },
  scopeBadge: { fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, opacity: 0.7 },
  copyBtn: { marginLeft: 'auto', borderWidth: 1, borderColor: '#9ca3af', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  copyBtnText: { fontSize: 12 },
  name: { fontWeight: '600', marginTop: 6, marginBottom: 4 },
  codeBlock: { marginTop: 8, padding: 8, borderRadius: 4, backgroundColor: '#f8fafc' },
  code: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
  toggleText: { fontSize: 12, textDecorationLine: 'underline', paddingVertical: 4 },
  description: { fontSize: 14, opacity: 0.85, lineHeight: 20, paddingVertical: 6 },
});

FormulaDisplay.displayName = 'FormulaDisplay';
export { FormulaDisplay };
export default FormulaDisplay;
