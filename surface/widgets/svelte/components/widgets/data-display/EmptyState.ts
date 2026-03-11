import { uid } from '../shared/uid.js';
export interface EmptyStateProps { title?: string; description?: string; icon?: string|HTMLElement; action?: { label: string; onClick: () => void }; className?: string; }
export interface EmptyStateInstance { element: HTMLElement; update(props: Partial<EmptyStateProps>): void; destroy(): void; }
export function createEmptyState(options: { target: HTMLElement; props: EmptyStateProps; }): EmptyStateInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'empty-state'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'status');
  const iconEl = document.createElement('div'); iconEl.setAttribute('data-part', 'icon'); root.appendChild(iconEl);
  const titleEl = document.createElement('h3'); titleEl.setAttribute('data-part', 'title'); root.appendChild(titleEl);
  const descEl = document.createElement('p'); descEl.setAttribute('data-part', 'description'); root.appendChild(descEl);
  const actionEl = document.createElement('div'); actionEl.setAttribute('data-part', 'action'); root.appendChild(actionEl);
  function sync() {
    iconEl.innerHTML = ''; if (typeof currentProps.icon === 'string') iconEl.textContent = currentProps.icon; else if (currentProps.icon instanceof HTMLElement) iconEl.appendChild(currentProps.icon);
    iconEl.style.display = currentProps.icon ? '' : 'none';
    titleEl.textContent = currentProps.title ?? ''; descEl.textContent = currentProps.description ?? '';
    actionEl.innerHTML = '';
    if (currentProps.action) { const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = currentProps.action.label; btn.addEventListener('click', currentProps.action.onClick); actionEl.appendChild(btn); }
    actionEl.style.display = currentProps.action ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createEmptyState;
