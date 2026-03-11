import { uid } from '../shared/uid.js';
export interface DisclosureProps { open?: boolean; title?: string; children?: HTMLElement | string; disabled?: boolean; onToggle?: (open: boolean) => void; className?: string; }
export interface DisclosureInstance { element: HTMLElement; update(props: Partial<DisclosureProps>): void; destroy(): void; }
export function createDisclosure(options: { target: HTMLElement; props: DisclosureProps; }): DisclosureInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'disclosure'); root.setAttribute('data-part', 'root');
  const trigger = document.createElement('button'); trigger.setAttribute('data-part', 'trigger'); trigger.setAttribute('type', 'button');
  trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', id + '-panel'); root.appendChild(trigger);
  const panel = document.createElement('div'); panel.setAttribute('data-part', 'panel'); panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', id + '-trigger'); panel.id = id + '-panel'; root.appendChild(panel);
  trigger.id = id + '-trigger';
  trigger.addEventListener('click', () => { if (!currentProps.disabled) { currentProps.open = !currentProps.open; currentProps.onToggle?.(currentProps.open); sync(); } });
  function sync() {
    root.setAttribute('data-state', currentProps.open ? 'open' : 'closed'); root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    trigger.setAttribute('aria-expanded', currentProps.open ? 'true' : 'false'); trigger.disabled = currentProps.disabled ?? false;
    trigger.textContent = currentProps.title ?? '';
    panel.style.display = currentProps.open ? '' : 'none';
    if (currentProps.children) { panel.innerHTML = ''; if (typeof currentProps.children === 'string') panel.textContent = currentProps.children; else panel.appendChild(currentProps.children); }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createDisclosure;
