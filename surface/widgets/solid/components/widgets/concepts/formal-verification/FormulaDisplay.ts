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

export interface FormulaDisplayProps { [key: string]: unknown; class?: string; }
export interface FormulaDisplayResult { element: HTMLElement; dispose: () => void; }

export function FormulaDisplay(props: FormulaDisplayProps): FormulaDisplayResult {
  const sig = surfaceCreateSignal<FormulaDisplayState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(formulaDisplayReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'formula-display');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'figure');
  root.setAttribute('data-state', state());
  root.setAttribute('data-expanded', 'false');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Header bar */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.style.display = 'flex';
  headerEl.style.alignItems = 'center';
  headerEl.style.gap = '0.5rem';

  /* Language badge */
  const langBadgeEl = document.createElement('span');
  langBadgeEl.setAttribute('data-part', 'lang-badge');
  langBadgeEl.setAttribute('role', 'presentation');
  langBadgeEl.style.fontFamily = 'monospace';
  langBadgeEl.style.fontSize = '0.75rem';
  langBadgeEl.style.padding = '0.125rem 0.375rem';
  langBadgeEl.style.borderRadius = '0.25rem';
  langBadgeEl.style.border = '1px solid currentColor';
  langBadgeEl.style.opacity = '0.8';
  headerEl.appendChild(langBadgeEl);

  /* Scope badge */
  const scopeBadgeEl = document.createElement('span');
  scopeBadgeEl.setAttribute('data-part', 'scope-badge');
  scopeBadgeEl.setAttribute('data-visible', 'true');
  scopeBadgeEl.style.fontSize = '0.75rem';
  scopeBadgeEl.style.padding = '0.125rem 0.375rem';
  scopeBadgeEl.style.borderRadius = '0.25rem';
  scopeBadgeEl.style.opacity = '0.7';
  headerEl.appendChild(scopeBadgeEl);

  /* Copy button */
  const copyButtonEl = document.createElement('button');
  copyButtonEl.type = 'button';
  copyButtonEl.setAttribute('data-part', 'copy-button');
  copyButtonEl.setAttribute('data-state', 'idle');
  copyButtonEl.setAttribute('role', 'button');
  copyButtonEl.setAttribute('aria-label', 'Copy formula to clipboard');
  copyButtonEl.setAttribute('tabindex', '0');
  copyButtonEl.textContent = 'Copy';
  copyButtonEl.style.marginLeft = 'auto';
  copyButtonEl.style.cursor = 'pointer';
  copyButtonEl.style.background = 'none';
  copyButtonEl.style.border = '1px solid currentColor';
  copyButtonEl.style.borderRadius = '0.25rem';
  copyButtonEl.style.padding = '0.25rem 0.5rem';
  copyButtonEl.style.fontSize = '0.75rem';
  copyButtonEl.style.color = 'inherit';
  copyButtonEl.addEventListener('click', () => {
    send('COPY');
  });
  headerEl.appendChild(copyButtonEl);
  root.appendChild(headerEl);

  /* Name */
  const nameEl = document.createElement('div');
  nameEl.setAttribute('data-part', 'name');
  nameEl.style.fontWeight = '600';
  nameEl.style.marginTop = '0.375rem';
  nameEl.style.marginBottom = '0.25rem';
  root.appendChild(nameEl);

  /* Code block */
  const codeBlockEl = document.createElement('pre');
  codeBlockEl.setAttribute('data-part', 'code-block');
  codeBlockEl.setAttribute('data-latex', 'false');
  codeBlockEl.setAttribute('role', 'code');
  codeBlockEl.setAttribute('aria-label', 'Formula text');
  codeBlockEl.setAttribute('tabindex', '-1');
  codeBlockEl.style.fontFamily = 'monospace';
  codeBlockEl.style.whiteSpace = 'pre-wrap';
  codeBlockEl.style.wordBreak = 'break-word';
  codeBlockEl.style.margin = '0.5rem 0 0';
  codeBlockEl.style.padding = '0.5rem';
  codeBlockEl.style.borderRadius = '0.25rem';
  codeBlockEl.style.overflow = 'auto';
  codeBlockEl.style.lineHeight = '1.5';
  const codeEl = document.createElement('code');
  codeBlockEl.appendChild(codeEl);
  root.appendChild(codeBlockEl);

  /* Expand toggle */
  const expandToggleEl = document.createElement('button');
  expandToggleEl.type = 'button';
  expandToggleEl.setAttribute('data-part', 'expand-toggle');
  expandToggleEl.setAttribute('aria-expanded', 'false');
  expandToggleEl.setAttribute('tabindex', '0');
  expandToggleEl.textContent = 'Show more';
  expandToggleEl.style.background = 'none';
  expandToggleEl.style.border = 'none';
  expandToggleEl.style.cursor = 'pointer';
  expandToggleEl.style.fontSize = '0.75rem';
  expandToggleEl.style.padding = '0.25rem 0';
  expandToggleEl.style.color = 'inherit';
  expandToggleEl.style.textDecoration = 'underline';
  expandToggleEl.addEventListener('click', () => {
    const expanded = root.getAttribute('data-expanded') === 'true';
    root.setAttribute('data-expanded', expanded ? 'false' : 'true');
    expandToggleEl.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    expandToggleEl.textContent = expanded ? 'Show more' : 'Show less';
  });
  root.appendChild(expandToggleEl);

  /* Description panel */
  const descriptionPanelEl = document.createElement('div');
  descriptionPanelEl.setAttribute('data-part', 'description-panel');

  const descriptionToggleEl = document.createElement('button');
  descriptionToggleEl.type = 'button';
  descriptionToggleEl.setAttribute('data-part', 'description-toggle');
  descriptionToggleEl.setAttribute('aria-expanded', 'false');
  descriptionToggleEl.setAttribute('tabindex', '0');
  descriptionToggleEl.textContent = 'Show description';
  descriptionToggleEl.style.background = 'none';
  descriptionToggleEl.style.border = 'none';
  descriptionToggleEl.style.cursor = 'pointer';
  descriptionToggleEl.style.fontSize = '0.75rem';
  descriptionToggleEl.style.padding = '0.25rem 0';
  descriptionToggleEl.style.color = 'inherit';
  descriptionToggleEl.style.textDecoration = 'underline';
  descriptionPanelEl.appendChild(descriptionToggleEl);

  const descriptionEl = document.createElement('div');
  descriptionEl.setAttribute('data-part', 'description');
  descriptionEl.setAttribute('role', 'note');
  descriptionEl.style.fontSize = '0.875rem';
  descriptionEl.style.padding = '0.375rem 0';
  descriptionEl.style.opacity = '0.85';
  descriptionEl.style.lineHeight = '1.4';
  descriptionEl.style.display = 'none';
  descriptionPanelEl.appendChild(descriptionEl);

  descriptionToggleEl.addEventListener('click', () => {
    const open = descriptionEl.style.display !== 'none';
    descriptionEl.style.display = open ? 'none' : 'block';
    descriptionToggleEl.setAttribute('aria-expanded', open ? 'false' : 'true');
    descriptionToggleEl.textContent = open ? 'Show description' : 'Hide description';
  });

  root.appendChild(descriptionPanelEl);

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString()) {
      e.preventDefault();
      send('COPY');
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const expanded = root.getAttribute('data-expanded') === 'true';
      root.setAttribute('data-expanded', expanded ? 'false' : 'true');
      expandToggleEl.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      expandToggleEl.textContent = expanded ? 'Show more' : 'Show less';
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    copyButtonEl.setAttribute('data-state', s === 'copied' ? 'copied' : 'idle');
    copyButtonEl.textContent = s === 'copied' ? 'Copied!' : 'Copy';
    if (s === 'copied') {
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => send('TIMEOUT'), 2000);
    }
  }));

  return {
    element: root,
    dispose() {
      unsubs.forEach((u) => u());
      if (copyTimer) clearTimeout(copyTimer);
      root.remove();
    },
  };
}

export default FormulaDisplay;
