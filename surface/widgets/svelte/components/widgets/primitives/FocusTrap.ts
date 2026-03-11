import { uid } from '../shared/uid.js';

export interface FocusTrapProps {
  active?: boolean;
  returnFocus?: boolean;
  children?: HTMLElement;
  className?: string;
}

export interface FocusTrapInstance {
  element: HTMLElement;
  update(props: Partial<FocusTrapProps>): void;
  destroy(): void;
}

export function createFocusTrap(options: {
  target: HTMLElement;
  props: FocusTrapProps;
}): FocusTrapInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let previouslyFocused: Element | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'focus-trap');
  root.setAttribute('data-part', 'root');

  const startSentinel = document.createElement('div');
  startSentinel.setAttribute('tabindex', '0');
  startSentinel.setAttribute('data-part', 'sentinel-start');
  startSentinel.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;';

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');

  const endSentinel = document.createElement('div');
  endSentinel.setAttribute('tabindex', '0');
  endSentinel.setAttribute('data-part', 'sentinel-end');
  endSentinel.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;';

  root.appendChild(startSentinel);
  root.appendChild(contentEl);
  root.appendChild(endSentinel);

  function getFocusableElements(): HTMLElement[] {
    return Array.from(contentEl.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    ));
  }

  function handleSentinelFocus(e: FocusEvent) {
    const f = getFocusableElements();
    if (!f.length) return;
    if (e.target === startSentinel) f[f.length - 1].focus();
    else if (e.target === endSentinel) f[0].focus();
  }
  startSentinel.addEventListener('focus', handleSentinelFocus);
  endSentinel.addEventListener('focus', handleSentinelFocus);
  cleanups.push(
    () => startSentinel.removeEventListener('focus', handleSentinelFocus),
    () => endSentinel.removeEventListener('focus', handleSentinelFocus),
  );

  function handleKeydown(e: KeyboardEvent) {
    if (!currentProps.active || e.key !== 'Tab') return;
    const f = getFocusableElements();
    if (!f.length) { e.preventDefault(); return; }
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  root.addEventListener('keydown', handleKeydown as EventListener);
  cleanups.push(() => root.removeEventListener('keydown', handleKeydown as EventListener));

  function activate() {
    previouslyFocused = document.activeElement;
    const f = getFocusableElements();
    if (f.length) f[0].focus();
  }

  function deactivate() {
    if (currentProps.returnFocus && previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    previouslyFocused = null;
  }

  function sync() {
    root.setAttribute('data-active', currentProps.active ? 'true' : 'false');
    startSentinel.style.display = currentProps.active ? '' : 'none';
    endSentinel.style.display = currentProps.active ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  if (currentProps.children) contentEl.appendChild(currentProps.children);
  target.appendChild(root);
  if (currentProps.active) activate();

  return {
    element: root,
    update(next) {
      const was = currentProps.active;
      Object.assign(currentProps, next);
      sync();
      if (!was && currentProps.active) activate();
      else if (was && !currentProps.active) deactivate();
    },
    destroy() { if (currentProps.active) deactivate(); cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createFocusTrap;
