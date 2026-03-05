import { defineComponent, h, ref, computed, watch, onUnmounted } from 'vue';

/* ---------------------------------------------------------------------------
 * FormulaDisplay state machine
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

/* ---------------------------------------------------------------------------
 * Syntax highlighting
 * ------------------------------------------------------------------------- */

export type FormulaLanguage = 'smtlib' | 'tlaplus' | 'alloy' | 'lean' | 'dafny' | 'cvl';

const LANGUAGE_LABELS: Record<FormulaLanguage, string> = {
  smtlib: 'SMT-LIB', tlaplus: 'TLA+', alloy: 'Alloy', lean: 'Lean', dafny: 'Dafny', cvl: 'CVL',
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

type TokenType = 'keyword' | 'operator' | 'number' | 'string' | 'comment' | 'paren' | 'text';
interface Token { type: TokenType; value: string; }

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
    if (rest[0] === '"') { const endIdx = rest.indexOf('"', 1); const str = endIdx === -1 ? rest : rest.slice(0, endIdx + 1); tokens.push({ type: 'string', value: str }); i += str.length; continue; }
    if ('()[]{}⟨⟩'.includes(rest[0])) { tokens.push({ type: 'paren', value: rest[0] }); i += 1; continue; }
    const opMatch = rest.match(OPERATOR_PATTERN);
    if (opMatch) { tokens.push({ type: 'operator', value: opMatch[1] }); i += opMatch[1].length; continue; }
    const numMatch = rest.match(NUMBER_PATTERN);
    if (numMatch) { tokens.push({ type: 'number', value: numMatch[1] }); i += numMatch[1].length; continue; }
    const wordMatch = rest.match(/^[a-zA-Z_$?'][a-zA-Z0-9_$?'-]*/);
    if (wordMatch) { const word = wordMatch[0]; tokens.push({ type: keywords.has(word) ? 'keyword' : 'text', value: word }); i += word.length; continue; }
    tokens.push({ type: 'text', value: rest[0] }); i += 1;
  }
  return tokens;
}

const TOKEN_STYLES: Record<TokenType, Record<string, string> | undefined> = {
  keyword: { fontWeight: '700', color: 'var(--fd-keyword, #7c3aed)' },
  operator: { color: 'var(--fd-operator, #d97706)' },
  number: { color: 'var(--fd-number, #0891b2)' },
  string: { color: 'var(--fd-string, #16a34a)' },
  comment: { color: 'var(--fd-comment, #9ca3af)', fontStyle: 'italic' },
  paren: { color: 'var(--fd-paren, #6b7280)' },
  text: undefined,
};

const COLLAPSE_THRESHOLD = 200;

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const FormulaDisplay = defineComponent({
  name: 'FormulaDisplay',
  props: {
    formula: { type: String, required: true },
    language: { type: String as () => FormulaLanguage, default: 'smtlib' },
    scope: { type: String, default: undefined },
    renderLatex: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    description: { type: String, default: undefined },
  },
  setup(props) {
    const state = ref<FormulaDisplayState>('idle');
    const send = (event: FormulaDisplayEvent) => { state.value = formulaDisplayReducer(state.value, event); };

    const expanded = ref(false);
    const descriptionOpen = ref(false);
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    const isLong = computed(() => props.formula.length > COLLAPSE_THRESHOLD);
    const displayFormula = computed(() => isLong.value && !expanded.value ? props.formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026' : props.formula);
    const tokens = computed(() => tokenize(displayFormula.value, props.language));

    const ariaLabel = computed(() => props.name
      ? `Formula: ${props.name} in ${LANGUAGE_LABELS[props.language]}`
      : `Formula in ${LANGUAGE_LABELS[props.language]}`);

    const descriptionId = computed(() => props.description ? `fd-desc-${Math.random().toString(36).slice(2, 9)}` : undefined);

    /* -- Copy to clipboard ------------------------------------------------ */
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(props.formula);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = props.formula;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      send({ type: 'COPY' });
    };

    /* -- Auto-reset copied state ------------------------------------------ */
    watch(state, (s) => {
      if (s === 'copied') {
        copyTimer = setTimeout(() => send({ type: 'TIMEOUT' }), 2000);
      }
    });

    /* -- LaTeX rendering trigger ------------------------------------------ */
    watch(() => props.renderLatex, (val) => {
      if (val && state.value === 'idle') {
        send({ type: 'RENDER_LATEX' });
        setTimeout(() => send({ type: 'RENDER_COMPLETE' }), 100);
      }
    });

    onUnmounted(() => { if (copyTimer) clearTimeout(copyTimer); });

    /* -- Keyboard --------------------------------------------------------- */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString()) {
        e.preventDefault();
        handleCopy();
      }
      if (e.key === 'Enter' && isLong.value) {
        e.preventDefault();
        expanded.value = !expanded.value;
      }
    };

    return () => h('div', {
      role: 'figure', 'aria-label': ariaLabel.value,
      'aria-describedby': descriptionId.value,
      'data-surface-widget': '', 'data-widget-name': 'formula-display',
      'data-part': 'root', 'data-state': state.value,
      'data-language': props.language, 'data-expanded': expanded.value ? 'true' : 'false',
      tabindex: 0, onKeydown: handleKeyDown,
    }, [
      // Header bar
      h('div', { 'data-part': 'header', style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } }, [
        h('span', {
          'data-part': 'lang-badge', role: 'presentation', 'data-language': props.language,
          style: { fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', border: '1px solid currentColor', opacity: '0.8' },
        }, LANGUAGE_LABELS[props.language]),
        props.scope
          ? h('span', {
              'data-part': 'scope-badge', 'data-visible': 'true',
              style: { fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', opacity: '0.7' },
            }, props.scope)
          : null,
        h('button', {
          type: 'button', 'data-part': 'copy-button',
          'data-state': state.value === 'copied' ? 'copied' : 'idle',
          'aria-label': 'Copy formula to clipboard', tabindex: 0,
          onClick: handleCopy,
          style: { marginLeft: 'auto', cursor: 'pointer', background: 'none', border: '1px solid currentColor', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'inherit' },
        }, state.value === 'copied' ? 'Copied!' : 'Copy'),
      ]),
      // Name
      props.name
        ? h('div', { 'data-part': 'name', style: { fontWeight: '600', marginTop: '0.375rem', marginBottom: '0.25rem' } }, props.name)
        : null,
      // Code block
      h('pre', {
        'data-part': 'code-block', 'data-language': props.language,
        'data-latex': props.renderLatex ? 'true' : 'false',
        role: 'code', 'aria-label': 'Formula text', tabindex: -1,
        style: { fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0.5rem 0 0', padding: '0.5rem', borderRadius: '0.25rem', overflow: 'auto', lineHeight: '1.5' },
      }, [
        h('code', null, tokens.value.map((token, idx) =>
          h('span', { key: idx, 'data-token-type': token.type, style: TOKEN_STYLES[token.type] }, token.value),
        )),
      ]),
      // Expand/collapse toggle
      isLong.value
        ? h('button', {
            type: 'button', 'data-part': 'expand-toggle',
            'aria-expanded': expanded.value, 'aria-label': expanded.value ? 'Collapse formula' : 'Expand formula',
            tabindex: 0, onClick: () => { expanded.value = !expanded.value; },
            style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '0.25rem 0', color: 'inherit', textDecoration: 'underline' },
          }, expanded.value ? 'Show less' : 'Show more')
        : null,
      // Description panel
      props.description
        ? h('div', { 'data-part': 'description-panel' }, [
            h('button', {
              type: 'button', 'data-part': 'description-toggle',
              'aria-expanded': descriptionOpen.value,
              'aria-controls': descriptionId.value,
              tabindex: 0,
              onClick: () => { descriptionOpen.value = !descriptionOpen.value; },
              style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '0.25rem 0', color: 'inherit', textDecoration: 'underline' },
            }, descriptionOpen.value ? 'Hide description' : 'Show description'),
            descriptionOpen.value
              ? h('div', {
                  id: descriptionId.value, 'data-part': 'description', role: 'note',
                  style: { fontSize: '0.875rem', padding: '0.375rem 0', opacity: '0.85', lineHeight: '1.4' },
                }, props.description)
              : null,
          ])
        : null,
    ]);
  },
});

export default FormulaDisplay;
