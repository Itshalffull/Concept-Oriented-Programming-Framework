import { uid } from '../shared/uid.js';
export interface MenuProps { items?: Array<{ label: string; value: string; disabled?: boolean; icon?: string; shortcut?: string; separator?: boolean; children?: MenuProps['items'] }>; trigger?: HTMLElement; onSelect?: (value: string) => void; className?: string; }
export interface MenuInstance { element: HTMLElement; update(props: Partial<MenuProps>): void; destroy(): void; }
export function createMenu(options: { target: HTMLElement; props: MenuProps; }): MenuInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  let open = false; let highlightIdx = -1;
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'menu'); root.setAttribute('data-part', 'root');
  const triggerEl = document.createElement('div'); triggerEl.setAttribute('data-part', 'trigger'); root.appendChild(triggerEl);
  const menuEl = document.createElement('div'); menuEl.setAttribute('data-part', 'menu'); menuEl.setAttribute('role', 'menu'); menuEl.id = id; root.appendChild(menuEl);
  triggerEl.addEventListener('click', () => { open = !open; highlightIdx = -1; sync(); });
  document.addEventListener('click', (e) => { if (open && !root.contains(e.target as Node)) { open = false; sync(); } });
  menuEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    const items = (currentProps.items ?? []).filter(i => !i.separator && !i.disabled);
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, items.length - 1); sync(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); sync(); }
    if (e.key === 'Enter' && items[highlightIdx]) { currentProps.onSelect?.(items[highlightIdx].value); open = false; sync(); }
    if (e.key === 'Escape') { open = false; sync(); triggerEl.focus(); }
  }) as EventListener);
  function sync() {
    root.setAttribute('data-state', open ? 'open' : 'closed');
    menuEl.style.display = open ? '' : 'none';
    if (currentProps.trigger && !triggerEl.contains(currentProps.trigger)) { triggerEl.innerHTML = ''; triggerEl.appendChild(currentProps.trigger); }
    menuEl.innerHTML = ''; cleanups.length = 0;
    (currentProps.items ?? []).forEach((item, i) => {
      if (item.separator) { const sep = document.createElement('div'); sep.setAttribute('role', 'separator'); sep.setAttribute('data-part', 'separator'); menuEl.appendChild(sep); return; }
      const el = document.createElement('div'); el.setAttribute('data-part', 'item'); el.setAttribute('role', 'menuitem'); el.setAttribute('tabindex', '-1');
      el.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false'); el.setAttribute('data-disabled', item.disabled ? 'true' : 'false');
      el.textContent = item.label;
      if (item.shortcut) { const kbd = document.createElement('kbd'); kbd.textContent = item.shortcut; el.appendChild(kbd); }
      if (!item.disabled) el.addEventListener('click', () => { currentProps.onSelect?.(item.value); open = false; sync(); });
      menuEl.appendChild(el);
    });
    if (open) { menuEl.setAttribute('tabindex', '-1'); menuEl.focus(); }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createMenu;
