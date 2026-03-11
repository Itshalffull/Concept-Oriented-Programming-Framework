// Clef Surface Widget — SolidJS Provider
// Imperative DOM, factory function returning { element, dispose }

import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  cleanup = fn();
  let lastValues = deps.map(d => d());
  const interval = setInterval(() => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      if (typeof cleanup === 'function') cleanup();
      cleanup = fn();
    }
  }, 16);
  return () => { clearInterval(interval); if (typeof cleanup === 'function') cleanup(); };
}

let _idCounter = 0;
function uid(): string { return 'solid-' + (++_idCounter); }


export interface CodeBlockProps {
  [key: string]: unknown;
  class?: string;
  children?: HTMLElement[];
}

export interface CodeBlockResult { element: HTMLElement; dispose: () => void; }

export function CodeBlock(props: CodeBlockProps): CodeBlockResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'code-block');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  if (props.class) root.className = props.class as string;

  if (props.children) {
    (props.children as HTMLElement[]).forEach(c => root.appendChild(c));
  }

  
  const language = (props.language as string) || 'plaintext';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', (props.ariaLabel as string) || language + ' code block');
  root.setAttribute('aria-roledescription', 'code block');
  root.setAttribute('data-language', language);
  if (props.showHeader !== false) {
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.setAttribute('data-visible', 'true');
    const langSpan = document.createElement('span');
    langSpan.setAttribute('data-part', 'language');
    langSpan.textContent = language;
    header.appendChild(langSpan);
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.setAttribute('data-part', 'copy-button');
    copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
    copyBtn.setAttribute('aria-live', 'polite');
    copyBtn.tabIndex = 0;
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(String(props.code || '')); } catch {}
      copyBtn.textContent = 'Copied!';
      copyBtn.setAttribute('data-state', 'copied');
      setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.setAttribute('data-state', 'idle'); }, 2000);
    });
    header.appendChild(copyBtn);
    root.appendChild(header);
  }
  const pre = document.createElement('pre');
  pre.setAttribute('data-part', 'pre');
  const code = document.createElement('code');
  code.setAttribute('role', 'code');
  code.setAttribute('data-part', 'code');
  code.setAttribute('aria-label', language + ' source code');
  code.setAttribute('aria-readonly', 'true');
  code.setAttribute('data-language', language);
  code.tabIndex = 0;
  code.textContent = String(props.code || '');
  pre.appendChild(code);
  root.appendChild(pre);

  disposers.push(solidCreateEffect([state], () => {
    root.setAttribute('data-state', state());
  }));

  function dispose() {
    disposers.forEach(d => d());
    root.remove();
  }

  return { element: root, dispose };
}
export default CodeBlock;
