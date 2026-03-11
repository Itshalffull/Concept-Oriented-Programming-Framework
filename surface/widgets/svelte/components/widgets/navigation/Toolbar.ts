import { uid } from '../shared/uid.js';
export interface ToolbarProps { items?: Array<{ id: string; label: string; icon?: string; disabled?: boolean; active?: boolean; type?: 'button' | 'toggle' | 'separator' }>; orientation?: 'horizontal' | 'vertical'; onAction?: (id: string) => void; className?: string; }
export interface ToolbarInstance { element: HTMLElement; update(props: Partial<ToolbarProps>): void; destroy(): void; }
export function createToolbar(options: { target: HTMLElement; props: ToolbarProps; }): ToolbarInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'toolbar'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'toolbar');
  function sync() {
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    root.innerHTML = ''; cleanups.length = 0;
    (currentProps.items ?? []).forEach((item, i) => {
      if (item.type === 'separator') { const sep = document.createElement('div'); sep.setAttribute('data-part', 'separator'); sep.setAttribute('role', 'separator'); root.appendChild(sep); return; }
      const btn = document.createElement('button'); btn.setAttribute('data-part', 'item'); btn.setAttribute('type', 'button'); btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', item.label); btn.setAttribute('data-active', item.active ? 'true' : 'false');
      btn.setAttribute('aria-pressed', item.active ? 'true' : 'false'); btn.disabled = item.disabled ?? false;
      btn.textContent = item.label;
      btn.addEventListener('click', () => currentProps.onAction?.(item.id));
      btn.addEventListener('keydown', ((e: KeyboardEvent) => {
        const btns = Array.from(root.querySelectorAll('[data-part="item"]')) as HTMLElement[];
        const ci = btns.indexOf(btn);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); btns[(ci + 1) % btns.length]?.focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); btns[(ci - 1 + btns.length) % btns.length]?.focus(); }
      }) as EventListener);
      root.appendChild(btn);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createToolbar;
