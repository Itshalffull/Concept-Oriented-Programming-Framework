import { uid } from '../shared/uid.js';

export interface ContextMenuProps {
  items?: Array<{ label: string; value: string; disabled?: boolean; icon?: string; shortcut?: string; separator?: boolean }>;
  onSelect?: (value: string) => void;
  className?: string;
}

export interface ContextMenuInstance {
  element: HTMLElement;
  update(props: Partial<ContextMenuProps>): void;
  destroy(): void;
}

export function createContextMenu(options: {
  target: HTMLElement;
  props: ContextMenuProps;
}): ContextMenuInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;
  let highlightIdx = -1;

  const triggerEl = document.createElement('div');
  triggerEl.setAttribute('data-surface-widget', '');
  triggerEl.setAttribute('data-widget-name', 'context-menu');
  triggerEl.setAttribute('data-part', 'trigger');

  const menuEl = document.createElement('div');
  menuEl.setAttribute('data-part', 'menu');
  menuEl.setAttribute('role', 'menu');
  menuEl.id = id;
  triggerEl.appendChild(menuEl);

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    open = true;
    menuEl.style.left = e.clientX + 'px';
    menuEl.style.top = e.clientY + 'px';
    sync();
  }
  triggerEl.addEventListener('contextmenu', handleContextMenu as EventListener);
  cleanups.push(() => triggerEl.removeEventListener('contextmenu', handleContextMenu as EventListener));

  document.addEventListener('click', (e) => { if (open && !menuEl.contains(e.target as Node)) { open = false; sync(); } });
  menuEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    const items = (currentProps.items ?? []).filter(i => !i.separator && !i.disabled);
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, items.length - 1); sync(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); sync(); }
    if (e.key === 'Enter' && items[highlightIdx]) { currentProps.onSelect?.(items[highlightIdx].value); open = false; sync(); }
    if (e.key === 'Escape') { open = false; sync(); }
  }) as EventListener);

  function sync() {
    const items = currentProps.items ?? [];
    triggerEl.setAttribute('data-state', open ? 'open' : 'closed');
    menuEl.style.display = open ? '' : 'none';
    menuEl.style.position = 'fixed';
    menuEl.innerHTML = '';
    items.forEach((item, i) => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.setAttribute('data-part', 'separator');
        sep.setAttribute('role', 'separator');
        menuEl.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.setAttribute('data-part', 'item');
      el.setAttribute('role', 'menuitem');
      el.setAttribute('data-disabled', item.disabled ? 'true' : 'false');
      el.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false');
      el.textContent = item.label;
      if (item.shortcut) {
        const kbd = document.createElement('kbd');
        kbd.textContent = item.shortcut;
        el.appendChild(kbd);
      }
      if (!item.disabled) el.addEventListener('click', () => { currentProps.onSelect?.(item.value); open = false; sync(); });
      menuEl.appendChild(el);
    });
    if (currentProps.className) triggerEl.className = currentProps.className; else triggerEl.className = '';
  }

  sync();
  target.appendChild(triggerEl);

  return {
    element: triggerEl,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); triggerEl.remove(); },
  };
}

export default createContextMenu;
