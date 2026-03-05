/* ---------------------------------------------------------------------------
 * FormulaDisplay — Vanilla widget
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

type FormulaLanguage = 'smtlib' | 'tlaplus' | 'alloy' | 'lean' | 'dafny' | 'cvl';

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

const TOKEN_COLORS: Record<TokenType, string | null> = {
  keyword: 'var(--fd-keyword, #7c3aed)', operator: 'var(--fd-operator, #d97706)', number: 'var(--fd-number, #0891b2)',
  string: 'var(--fd-string, #16a34a)', comment: 'var(--fd-comment, #9ca3af)', paren: 'var(--fd-paren, #6b7280)', text: null,
};

function tokenize(formula: string, language: FormulaLanguage): Token[] {
  const keywords = LANGUAGE_KEYWORDS[language]; const tokens: Token[] = []; let i = 0;
  while (i < formula.length) {
    const rest = formula.slice(i);
    const wsMatch = rest.match(/^(\s+)/);
    if (wsMatch) { tokens.push({ type: 'text', value: wsMatch[1] }); i += wsMatch[1].length; continue; }
    const commentMatch = rest.match(/^(--|;;|\/\/)(.*)$/m);
    if (commentMatch) { tokens.push({ type: 'comment', value: commentMatch[0] }); i += commentMatch[0].length; continue; }
    if (rest[0] === '"') { const endIdx = rest.indexOf('"', 1); const str = endIdx === -1 ? rest : rest.slice(0, endIdx + 1); tokens.push({ type: 'string', value: str }); i += str.length; continue; }
    if ('()[]{}' .includes(rest[0])) { tokens.push({ type: 'paren', value: rest[0] }); i += 1; continue; }
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

const COLLAPSE_THRESHOLD = 200;

export interface FormulaDisplayProps {
  formula: string; language: FormulaLanguage; scope?: string; renderLatex?: boolean;
  name?: string; description?: string; className?: string; [key: string]: unknown;
}
export interface FormulaDisplayOptions { target: HTMLElement; props: FormulaDisplayProps; }
let _uid = 0;

export class FormulaDisplay {
  private el: HTMLElement;
  private props: FormulaDisplayProps;
  private state: FormulaDisplayState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private expanded = false;
  private descriptionOpen = false;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private options: FormulaDisplayOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'formula-display');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'figure');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'formula-display-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    if (this.props.renderLatex) { this.sm({ type: 'RENDER_LATEX' }); setTimeout(() => this.sm({ type: 'RENDER_COMPLETE' }), 100); }
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: FormulaDisplayEvent): void {
    this.state = formulaDisplayReducer(this.state, ev); this.el.setAttribute('data-state', this.state);
    if (this.state === 'copied') {
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => { this.sm({ type: 'TIMEOUT' }); this.render(); }, 2000);
    }
  }
  update(props: Partial<FormulaDisplayProps>): void { Object.assign(this.props, props); this.render(); }
  destroy(): void { if (this.copyTimer) clearTimeout(this.copyTimer); this.disposers.forEach(d => d()); this.el.remove(); }

  private handleCopy(): void {
    try { navigator.clipboard.writeText(this.props.formula); } catch {
      const ta = document.createElement('textarea'); ta.value = this.props.formula; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    this.sm({ type: 'COPY' }); this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString()) { e.preventDefault(); this.handleCopy(); }
    if (e.key === 'Enter' && this.props.formula.length > COLLAPSE_THRESHOLD) { e.preventDefault(); this.expanded = !this.expanded; this.render(); }
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props; const language = p.language ?? 'smtlib' as FormulaLanguage;
    const isLong = p.formula.length > COLLAPSE_THRESHOLD;
    const displayFormula = isLong && !this.expanded ? p.formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026' : p.formula;
    const tokens = tokenize(displayFormula, language);
    const ariaLabel = p.name ? `Formula: ${p.name} in ${LANGUAGE_LABELS[language]}` : `Formula in ${LANGUAGE_LABELS[language]}`;

    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-language', language);
    this.el.setAttribute('data-expanded', this.expanded ? 'true' : 'false');
    this.el.setAttribute('aria-label', ariaLabel);
    if (p.className) this.el.className = p.className;

    // Header
    const hd = document.createElement('div'); hd.setAttribute('data-part', 'header'); hd.style.cssText = 'display:flex;align-items:center;gap:0.5rem';
    const lb = document.createElement('span'); lb.setAttribute('data-part', 'lang-badge'); lb.setAttribute('role', 'presentation'); lb.setAttribute('data-language', language);
    lb.style.cssText = 'font-family:monospace;font-size:0.75rem;padding:0.125rem 0.375rem;border-radius:0.25rem;border:1px solid currentColor;opacity:0.8';
    lb.textContent = LANGUAGE_LABELS[language]; hd.appendChild(lb);

    if (p.scope) {
      const sb = document.createElement('span'); sb.setAttribute('data-part', 'scope-badge'); sb.setAttribute('data-visible', 'true');
      sb.style.cssText = 'font-size:0.75rem;padding:0.125rem 0.375rem;border-radius:0.25rem;opacity:0.7';
      sb.textContent = p.scope; hd.appendChild(sb);
    }

    const cpb = document.createElement('button'); cpb.type = 'button'; cpb.setAttribute('data-part', 'copy-button');
    cpb.setAttribute('data-state', this.state === 'copied' ? 'copied' : 'idle');
    cpb.setAttribute('aria-label', 'Copy formula to clipboard'); cpb.tabIndex = 0;
    cpb.style.cssText = 'margin-left:auto;cursor:pointer;background:none;border:1px solid currentColor;border-radius:0.25rem;padding:0.25rem 0.5rem;font-size:0.75rem;color:inherit';
    cpb.textContent = this.state === 'copied' ? 'Copied!' : 'Copy';
    cpb.addEventListener('click', () => this.handleCopy());
    hd.appendChild(cpb); this.el.appendChild(hd);

    // Name
    if (p.name) {
      const nm = document.createElement('div'); nm.setAttribute('data-part', 'name');
      nm.style.cssText = 'font-weight:600;margin-top:0.375rem;margin-bottom:0.25rem'; nm.textContent = p.name; this.el.appendChild(nm);
    }

    // Code block
    const pre = document.createElement('pre'); pre.setAttribute('data-part', 'code-block'); pre.setAttribute('data-language', language);
    pre.setAttribute('data-latex', p.renderLatex ? 'true' : 'false'); pre.setAttribute('role', 'code');
    pre.setAttribute('aria-label', 'Formula text'); pre.tabIndex = -1;
    pre.style.cssText = 'font-family:monospace;white-space:pre-wrap;word-break:break-word;margin:0.5rem 0 0;padding:0.5rem;border-radius:0.25rem;overflow:auto;line-height:1.5';
    const code = document.createElement('code');
    tokens.forEach(token => {
      const s = document.createElement('span'); s.setAttribute('data-token-type', token.type);
      const color = TOKEN_COLORS[token.type];
      if (token.type === 'keyword') s.style.cssText = `font-weight:700;color:${color}`;
      else if (token.type === 'comment') s.style.cssText = `color:${color};font-style:italic`;
      else if (color) s.style.cssText = `color:${color}`;
      s.textContent = token.value; code.appendChild(s);
    });
    pre.appendChild(code); this.el.appendChild(pre);

    // Expand toggle
    if (isLong) {
      const et = document.createElement('button'); et.type = 'button'; et.setAttribute('data-part', 'expand-toggle');
      et.setAttribute('aria-expanded', String(this.expanded));
      et.setAttribute('aria-label', this.expanded ? 'Collapse formula' : 'Expand formula'); et.tabIndex = 0;
      et.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.75rem;padding:0.25rem 0;color:inherit;text-decoration:underline';
      et.textContent = this.expanded ? 'Show less' : 'Show more';
      et.addEventListener('click', () => { this.expanded = !this.expanded; this.render(); });
      this.el.appendChild(et);
    }

    // Description panel
    if (p.description) {
      const dp = document.createElement('div'); dp.setAttribute('data-part', 'description-panel');
      const dt = document.createElement('button'); dt.type = 'button'; dt.setAttribute('data-part', 'description-toggle');
      dt.setAttribute('aria-expanded', String(this.descriptionOpen)); dt.tabIndex = 0;
      dt.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.75rem;padding:0.25rem 0;color:inherit;text-decoration:underline';
      dt.textContent = this.descriptionOpen ? 'Hide description' : 'Show description';
      dt.addEventListener('click', () => { this.descriptionOpen = !this.descriptionOpen; this.render(); });
      dp.appendChild(dt);
      if (this.descriptionOpen) {
        const dd = document.createElement('div'); dd.setAttribute('data-part', 'description'); dd.setAttribute('role', 'note');
        dd.style.cssText = 'font-size:0.875rem;padding:0.375rem 0;opacity:0.85;line-height:1.4';
        dd.textContent = p.description; dp.appendChild(dd);
      }
      this.el.appendChild(dp);
    }
  }
}

export default FormulaDisplay;
