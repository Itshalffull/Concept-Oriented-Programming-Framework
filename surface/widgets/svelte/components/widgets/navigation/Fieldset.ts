import { uid } from '../shared/uid.js';
export interface FieldsetProps { legend?: string; disabled?: boolean; error?: string; description?: string; children?: HTMLElement; className?: string; }
export interface FieldsetInstance { element: HTMLElement; update(props: Partial<FieldsetProps>): void; destroy(): void; }
export function createFieldset(options: { target: HTMLElement; props: FieldsetProps; }): FieldsetInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('fieldset'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'fieldset'); root.setAttribute('data-part', 'root');
  const legendEl = document.createElement('legend'); legendEl.setAttribute('data-part', 'legend'); root.appendChild(legendEl);
  const descEl = document.createElement('span'); descEl.setAttribute('data-part', 'description'); root.appendChild(descEl);
  const contentEl = document.createElement('div'); contentEl.setAttribute('data-part', 'content'); root.appendChild(contentEl);
  const errorEl = document.createElement('span'); errorEl.setAttribute('data-part', 'error'); errorEl.setAttribute('role', 'alert'); root.appendChild(errorEl);
  function sync() {
    root.disabled = currentProps.disabled ?? false; root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    legendEl.textContent = currentProps.legend ?? ''; legendEl.style.display = currentProps.legend ? '' : 'none';
    descEl.textContent = currentProps.description ?? ''; descEl.style.display = currentProps.description ? '' : 'none';
    errorEl.textContent = currentProps.error ?? ''; errorEl.style.display = currentProps.error ? '' : 'none';
    if (currentProps.children && !contentEl.contains(currentProps.children)) { contentEl.innerHTML = ''; contentEl.appendChild(currentProps.children); }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createFieldset;
