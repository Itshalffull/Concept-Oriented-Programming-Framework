import { uid } from '../shared/uid.js';

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  showHeader?: boolean;
  wrapLines?: boolean;
  maxHeight?: string;
  ariaLabel?: string;
  highlightSyntax?: (code: string, language: string) => string;
  copyIcon?: string | HTMLElement;
}

export interface CodeBlockInstance {
  element: HTMLElement;
  update(props: Partial<CodeBlockProps>): void;
  destroy(): void;
}

export function createCodeBlock(options: {
  target: HTMLElement;
  props: CodeBlockProps;
}): CodeBlockInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let copied = false;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'code-block');
  root.setAttribute('data-part', 'code-block');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'code block');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const languageEl = document.createElement('span');
  languageEl.setAttribute('data-part', 'language');
  headerEl.appendChild(languageEl);

  const copyBtn = document.createElement('button');
  copyBtn.setAttribute('data-part', 'copy-button');
  copyBtn.setAttribute('type', 'button');
  copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
  copyBtn.setAttribute('aria-live', 'polite');
  headerEl.appendChild(copyBtn);

  const codeContainerEl = document.createElement('div');
  codeContainerEl.setAttribute('data-part', 'code-container');
  root.appendChild(codeContainerEl);

  const lineNumbersEl = document.createElement('div');
  lineNumbersEl.setAttribute('data-part', 'line-numbers');
  lineNumbersEl.setAttribute('aria-hidden', 'true');
  codeContainerEl.appendChild(lineNumbersEl);

  const preEl = document.createElement('pre');
  preEl.setAttribute('data-part', 'pre');
  codeContainerEl.appendChild(preEl);

  const codeEl = document.createElement('code');
  codeEl.setAttribute('data-part', 'code');
  preEl.appendChild(codeEl);

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentProps.code);
      copied = true;
      copyBtn.textContent = 'Copied!';
      copyBtn.setAttribute('aria-label', 'Copied to clipboard');
      setTimeout(() => { copied = false; copyBtn.textContent = 'Copy'; copyBtn.setAttribute('aria-label', 'Copy code to clipboard'); }, 2000);
    } catch { /* noop */ }
  });
  cleanups.push(() => {});

  function sync() {
    root.setAttribute('data-state', 'idle');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    headerEl.style.display = currentProps.showHeader !== false ? '' : 'none';
    languageEl.textContent = currentProps.language ?? '';
    copyBtn.textContent = copied ? 'Copied!' : 'Copy';
    if (currentProps.maxHeight) codeContainerEl.style.maxHeight = currentProps.maxHeight;
    codeContainerEl.style.overflow = currentProps.maxHeight ? 'auto' : '';

    const lines = currentProps.code.split('\n');
    lineNumbersEl.innerHTML = '';
    lineNumbersEl.style.display = currentProps.showLineNumbers ? '' : 'none';
    if (currentProps.showLineNumbers) {
      lines.forEach((_, i) => {
        const ln = document.createElement('span');
        ln.setAttribute('data-part', 'line-number');
        ln.textContent = String(i + 1);
        lineNumbersEl.appendChild(ln);
      });
    }

    if (currentProps.highlightSyntax) {
      codeEl.innerHTML = currentProps.highlightSyntax(currentProps.code, currentProps.language ?? '');
    } else {
      codeEl.innerHTML = '';
      lines.forEach((line, i) => {
        const lineEl = document.createElement('span');
        lineEl.setAttribute('data-part', 'code-line');
        lineEl.textContent = line;
        if (currentProps.highlightLines?.includes(i + 1)) lineEl.setAttribute('data-highlighted', 'true');
        codeEl.appendChild(lineEl);
        if (i < lines.length - 1) codeEl.appendChild(document.createTextNode('\n'));
      });
    }
    preEl.style.whiteSpace = currentProps.wrapLines ? 'pre-wrap' : 'pre';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createCodeBlock;
