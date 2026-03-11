import { uid } from '../shared/uid.js';

export interface MarkdownPreviewProps {
  source: string;
  renderMarkdown?: (source: string) => string;
  sanitize?: boolean;
  ariaLabel?: string;
  className?: string;
}

export interface MarkdownPreviewInstance {
  element: HTMLElement;
  update(props: Partial<MarkdownPreviewProps>): void;
  destroy(): void;
}

export function createMarkdownPreview(options: {
  target: HTMLElement;
  props: MarkdownPreviewProps;
}): MarkdownPreviewInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'markdown-preview');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'document');
  root.id = id;

  function sync() {
    root.setAttribute('data-state', 'idle');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    if (currentProps.className) root.className = currentProps.className;
    if (currentProps.renderMarkdown) {
      root.innerHTML = currentProps.renderMarkdown(currentProps.source);
    } else {
      root.textContent = currentProps.source;
    }
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createMarkdownPreview;
