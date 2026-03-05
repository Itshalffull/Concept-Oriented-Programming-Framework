import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

    if (rest[0] === '"') {
      const endIdx = rest.indexOf('"', 1);
      const str = endIdx === -1 ? rest : rest.slice(0, endIdx + 1);
      tokens.push({ type: 'string', value: str }); i += str.length; continue;
    }

    if ('()[]{}' .includes(rest[0])) { tokens.push({ type: 'paren', value: rest[0] }); i += 1; continue; }

    const opMatch = rest.match(OPERATOR_PATTERN);
    if (opMatch) { tokens.push({ type: 'operator', value: opMatch[1] }); i += opMatch[1].length; continue; }

    const numMatch = rest.match(NUMBER_PATTERN);
    if (numMatch) { tokens.push({ type: 'number', value: numMatch[1] }); i += numMatch[1].length; continue; }

    const wordMatch = rest.match(/^[a-zA-Z_$?'][a-zA-Z0-9_$?'-]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const type: TokenType = keywords.has(word) ? 'keyword' : 'text';
      tokens.push({ type, value: word }); i += word.length; continue;
    }

    tokens.push({ type: 'text', value: rest[0] }); i += 1;
  }

  return tokens;
}

const TOKEN_STYLES: Record<TokenType, string> = {
  keyword: 'font-weight:700;color:var(--fd-keyword,#7c3aed)',
  operator: 'color:var(--fd-operator,#d97706)',
  number: 'color:var(--fd-number,#0891b2)',
  string: 'color:var(--fd-string,#16a34a)',
  comment: 'color:var(--fd-comment,#9ca3af);font-style:italic',
  paren: 'color:var(--fd-paren,#6b7280)',
  text: '',
};

const COLLAPSE_THRESHOLD = 200;

export interface FormulaDisplayProps { [key: string]: unknown; class?: string; }
export interface FormulaDisplayResult { element: HTMLElement; dispose: () => void; }

export function FormulaDisplay(props: FormulaDisplayProps): FormulaDisplayResult {
  const sig = surfaceCreateSignal<FormulaDisplayState>('idle');
  const send = (type: string) => sig.set(formulaDisplayReducer(sig.get(), { type } as any));

  const formula = String(props.formula ?? '');
  const language = (props.language as FormulaLanguage) ?? 'smtlib';
  const scope = props.scope != null ? String(props.scope) : undefined;
  const renderLatex = props.renderLatex === true;
  const name = props.name != null ? String(props.name) : undefined;
  const description = props.description != null ? String(props.description) : undefined;

  let expanded = false;
  let descriptionOpen = false;
  let copyTimerId: ReturnType<typeof setTimeout> | undefined;

  const isLong = formula.length > COLLAPSE_THRESHOLD;

  const ariaLabel = name
    ? `Formula: ${name} in ${LANGUAGE_LABELS[language]}`
    : `Formula in ${LANGUAGE_LABELS[language]}`;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'formula-display');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'figure');
  root.setAttribute('aria-label', ariaLabel);
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-language', language);
  root.setAttribute('data-expanded', 'false');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Header bar */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.style.display = 'flex';
  headerEl.style.alignItems = 'center';
  headerEl.style.gap = '0.5rem';

  const langBadge = document.createElement('span');
  langBadge.setAttribute('data-part', 'lang-badge');
  langBadge.setAttribute('role', 'presentation');
  langBadge.setAttribute('data-language', language);
  langBadge.style.fontFamily = 'monospace';
  langBadge.style.fontSize = '0.75rem';
  langBadge.style.padding = '0.125rem 0.375rem';
  langBadge.style.borderRadius = '0.25rem';
  langBadge.style.border = '1px solid currentColor';
  langBadge.style.opacity = '0.8';
  langBadge.textContent = LANGUAGE_LABELS[language];
  headerEl.appendChild(langBadge);

  if (scope) {
    const scopeBadge = document.createElement('span');
    scopeBadge.setAttribute('data-part', 'scope-badge');
    scopeBadge.setAttribute('data-visible', 'true');
    scopeBadge.style.fontSize = '0.75rem';
    scopeBadge.style.padding = '0.125rem 0.375rem';
    scopeBadge.style.borderRadius = '0.25rem';
    scopeBadge.style.opacity = '0.7';
    scopeBadge.textContent = scope;
    headerEl.appendChild(scopeBadge);
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.setAttribute('data-part', 'copy-button');
  copyBtn.setAttribute('data-state', 'idle');
  copyBtn.setAttribute('role', 'button');
  copyBtn.setAttribute('aria-label', 'Copy formula to clipboard');
  copyBtn.setAttribute('tabindex', '0');
  copyBtn.style.marginLeft = 'auto';
  copyBtn.style.cursor = 'pointer';
  copyBtn.style.background = 'none';
  copyBtn.style.border = '1px solid currentColor';
  copyBtn.style.borderRadius = '0.25rem';
  copyBtn.style.padding = '0.25rem 0.5rem';
  copyBtn.style.fontSize = '0.75rem';
  copyBtn.style.color = 'inherit';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', handleCopy);
  headerEl.appendChild(copyBtn);

  root.appendChild(headerEl);

  /* Name */
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.setAttribute('data-part', 'name');
    nameEl.style.fontWeight = '600';
    nameEl.style.marginTop = '0.375rem';
    nameEl.style.marginBottom = '0.25rem';
    nameEl.textContent = name;
    root.appendChild(nameEl);
  }

  /* Code block */
  const preEl = document.createElement('pre');
  preEl.setAttribute('data-part', 'code-block');
  preEl.setAttribute('data-language', language);
  preEl.setAttribute('data-latex', renderLatex ? 'true' : 'false');
  preEl.setAttribute('role', 'code');
  preEl.setAttribute('aria-label', 'Formula text');
  preEl.setAttribute('tabindex', '-1');
  preEl.style.fontFamily = 'monospace';
  preEl.style.whiteSpace = 'pre-wrap';
  preEl.style.wordBreak = 'break-word';
  preEl.style.margin = '0.5rem 0 0';
  preEl.style.padding = '0.5rem';
  preEl.style.borderRadius = '0.25rem';
  preEl.style.overflow = 'auto';
  preEl.style.lineHeight = '1.5';
  root.appendChild(preEl);

  const codeEl = document.createElement('code');
  preEl.appendChild(codeEl);

  /* Expand/collapse toggle for long formulas */
  let expandToggle: HTMLButtonElement | null = null;
  if (isLong) {
    expandToggle = document.createElement('button');
    expandToggle.type = 'button';
    expandToggle.setAttribute('data-part', 'expand-toggle');
    expandToggle.setAttribute('aria-expanded', 'false');
    expandToggle.setAttribute('aria-label', 'Expand formula');
    expandToggle.setAttribute('tabindex', '0');
    expandToggle.style.background = 'none';
    expandToggle.style.border = 'none';
    expandToggle.style.cursor = 'pointer';
    expandToggle.style.fontSize = '0.75rem';
    expandToggle.style.padding = '0.25rem 0';
    expandToggle.style.color = 'inherit';
    expandToggle.style.textDecoration = 'underline';
    expandToggle.textContent = 'Show more';
    expandToggle.addEventListener('click', () => {
      expanded = !expanded;
      root.setAttribute('data-expanded', expanded ? 'true' : 'false');
      expandToggle!.setAttribute('aria-expanded', String(expanded));
      expandToggle!.setAttribute('aria-label', expanded ? 'Collapse formula' : 'Expand formula');
      expandToggle!.textContent = expanded ? 'Show less' : 'Show more';
      renderTokens();
    });
    root.appendChild(expandToggle);
  }

  /* Description panel */
  let descriptionPanel: HTMLDivElement | null = null;
  let descriptionContentEl: HTMLDivElement | null = null;
  let descriptionToggle: HTMLButtonElement | null = null;
  if (description) {
    descriptionPanel = document.createElement('div');
    descriptionPanel.setAttribute('data-part', 'description-panel');

    descriptionToggle = document.createElement('button');
    descriptionToggle.type = 'button';
    descriptionToggle.setAttribute('data-part', 'description-toggle');
    descriptionToggle.setAttribute('aria-expanded', 'false');
    descriptionToggle.setAttribute('tabindex', '0');
    descriptionToggle.style.background = 'none';
    descriptionToggle.style.border = 'none';
    descriptionToggle.style.cursor = 'pointer';
    descriptionToggle.style.fontSize = '0.75rem';
    descriptionToggle.style.padding = '0.25rem 0';
    descriptionToggle.style.color = 'inherit';
    descriptionToggle.style.textDecoration = 'underline';
    descriptionToggle.textContent = 'Show description';

    descriptionContentEl = document.createElement('div');
    descriptionContentEl.setAttribute('data-part', 'description');
    descriptionContentEl.setAttribute('role', 'note');
    descriptionContentEl.style.fontSize = '0.875rem';
    descriptionContentEl.style.padding = '0.375rem 0';
    descriptionContentEl.style.opacity = '0.85';
    descriptionContentEl.style.lineHeight = '1.4';
    descriptionContentEl.textContent = description;
    descriptionContentEl.style.display = 'none';

    descriptionToggle.addEventListener('click', () => {
      descriptionOpen = !descriptionOpen;
      descriptionToggle!.setAttribute('aria-expanded', String(descriptionOpen));
      descriptionToggle!.textContent = descriptionOpen ? 'Hide description' : 'Show description';
      descriptionContentEl!.style.display = descriptionOpen ? '' : 'none';
    });

    descriptionPanel.appendChild(descriptionToggle);
    descriptionPanel.appendChild(descriptionContentEl);
    root.appendChild(descriptionPanel);
  }

  function renderTokens(): void {
    codeEl.innerHTML = '';
    const displayFormula = isLong && !expanded ? formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026' : formula;
    const tokens = tokenize(displayFormula, language);
    for (const token of tokens) {
      const span = document.createElement('span');
      span.setAttribute('data-token-type', token.type);
      if (TOKEN_STYLES[token.type]) span.style.cssText = TOKEN_STYLES[token.type];
      span.textContent = token.value;
      codeEl.appendChild(span);
    }
  }

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(formula);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = formula;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    send('COPY');
  }

  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString()) {
      e.preventDefault();
      handleCopy();
    }
    if (e.key === 'Enter' && isLong) {
      e.preventDefault();
      expanded = !expanded;
      root.setAttribute('data-expanded', expanded ? 'true' : 'false');
      if (expandToggle) {
        expandToggle.setAttribute('aria-expanded', String(expanded));
        expandToggle.setAttribute('aria-label', expanded ? 'Collapse formula' : 'Expand formula');
        expandToggle.textContent = expanded ? 'Show less' : 'Show more';
      }
      renderTokens();
    }
  });

  renderTokens();

  /* LaTeX rendering trigger */
  if (renderLatex) {
    send('RENDER_LATEX');
    setTimeout(() => send('RENDER_COMPLETE'), 100);
  }

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    copyBtn.setAttribute('data-state', s === 'copied' ? 'copied' : 'idle');
    copyBtn.textContent = s === 'copied' ? 'Copied!' : 'Copy';
    if (s === 'copied') {
      if (copyTimerId) clearTimeout(copyTimerId);
      copyTimerId = setTimeout(() => send('TIMEOUT'), 2000);
    }
  });

  return {
    element: root,
    dispose() {
      unsub();
      if (copyTimerId) clearTimeout(copyTimerId);
      root.remove();
    },
  };
}

export default FormulaDisplay;
