import { uid } from '../shared/uid.js';
export interface ViewToggleProps { value?: string; options?: Array<{ id: string; label: string; icon?: string }>; onChange?: (value: string) => void; className?: string; }
export interface ViewToggleInstance { element: HTMLElement; update(props: Partial<ViewToggleProps>): void; destroy(): void; }
export function createViewToggle(options: { target: HTMLElement; props: ViewToggleProps; }): ViewToggleInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'view-toggle'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'radiogroup'); root.setAttribute('aria-label', 'View toggle');
  function sync() {
    root.innerHTML = ''; cleanups.length = 0;
    (currentProps.options ?? []).forEach(opt => {
      const btn = document.createElement('button'); btn.setAttribute('data-part', 'option'); btn.type = 'button'; btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', currentProps.value === opt.id ? 'true' : 'false');
      btn.setAttribute('data-selected', currentProps.value === opt.id ? 'true' : 'false');
      btn.setAttribute('aria-label', opt.label); btn.textContent = opt.label;
      btn.addEventListener('click', () => { currentProps.value = opt.id; currentProps.onChange?.(opt.id); sync(); });
      root.appendChild(btn);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createViewToggle;
