import { uid } from '../shared/uid.js';
export interface FloatingToolbarProps { visible?: boolean; items?: Array<{ id: string; label: string; icon?: string; disabled?: boolean; active?: boolean }>; onAction?: (id: string) => void; className?: string; }
export interface FloatingToolbarInstance { element: HTMLElement; update(props: Partial<FloatingToolbarProps>): void; destroy(): void; }
export function createFloatingToolbar(options: { target: HTMLElement; props: FloatingToolbarProps; }): FloatingToolbarInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'floating-toolbar'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'toolbar'); root.setAttribute('aria-label', 'Floating toolbar');
  function sync() {
    root.setAttribute('data-visible', currentProps.visible ? 'true' : 'false'); root.style.display = currentProps.visible ? '' : 'none';
    root.innerHTML = ''; cleanups.length = 0;
    (currentProps.items ?? []).forEach(item => {
      const btn = document.createElement('button'); btn.setAttribute('data-part', 'item'); btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', item.label); btn.setAttribute('data-active', item.active ? 'true' : 'false');
      btn.disabled = item.disabled ?? false; btn.textContent = item.label;
      const handler = () => currentProps.onAction?.(item.id);
      btn.addEventListener('click', handler); cleanups.push(() => btn.removeEventListener('click', handler));
      root.appendChild(btn);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createFloatingToolbar;
