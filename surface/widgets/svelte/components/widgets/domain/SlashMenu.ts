import { uid } from '../shared/uid.js';

export interface SlashMenuItem {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  group?: string;
}

export interface SlashMenuProps {
  open?: boolean;
  items: SlashMenuItem[];
  query?: string;
  selectedIndex?: number;
  position?: { x: number; y: number };
  onSelect?: (key: string) => void;
  onClose?: () => void;
  onQueryChange?: (query: string) => void;
  children?: string | HTMLElement;
}

export interface SlashMenuInstance {
  element: HTMLElement;
  update(props: Partial<SlashMenuProps>): void;
  destroy(): void;
}

export function createSlashMenu(options: {
  target: HTMLElement;
  props: SlashMenuProps;
}): SlashMenuInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'slash-menu');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'listbox');
  root.setAttribute('aria-label', 'Block type menu');
  root.id = id;

  const searchEl = document.createElement('input');
  searchEl.setAttribute('data-part', 'search');
  searchEl.setAttribute('type', 'search');
  searchEl.setAttribute('aria-label', 'Filter block types');
  root.appendChild(searchEl);

  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'list');
  root.appendChild(listEl);

  searchEl.addEventListener('input', () => currentProps.onQueryChange?.(searchEl.value));
  cleanups.push(() => {});

  root.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'Escape') currentProps.onClose?.();
    if (e.key === 'ArrowDown') {
      const max = filteredItems().length - 1;
      const next = Math.min((currentProps.selectedIndex ?? -1) + 1, max);
      currentProps.selectedIndex = next;
      sync();
    }
    if (e.key === 'ArrowUp') {
      const next = Math.max((currentProps.selectedIndex ?? 0) - 1, 0);
      currentProps.selectedIndex = next;
      sync();
    }
    if (e.key === 'Enter') {
      const items = filteredItems();
      const sel = items[currentProps.selectedIndex ?? 0];
      if (sel) currentProps.onSelect?.(sel.key);
    }
  }) as EventListener);

  function filteredItems(): SlashMenuItem[] {
    const q = (currentProps.query ?? '').toLowerCase();
    return currentProps.items.filter(it => !q || it.label.toLowerCase().includes(q));
  }

  function renderList() {
    listEl.innerHTML = '';
    const items = filteredItems();
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.setAttribute('data-part', 'menu-item');
      el.setAttribute('role', 'option');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-selected', i === (currentProps.selectedIndex ?? 0) ? 'true' : 'false');
      const label = document.createElement('span');
      label.setAttribute('data-part', 'item-label');
      label.textContent = item.label;
      el.appendChild(label);
      if (item.description) {
        const desc = document.createElement('span');
        desc.setAttribute('data-part', 'item-description');
        desc.textContent = item.description;
        el.appendChild(desc);
      }
      el.addEventListener('click', () => currentProps.onSelect?.(item.key));
      listEl.appendChild(el);
    });
  }

  function sync() {
    const open = currentProps.open ?? false;
    root.setAttribute('data-state', open ? 'open' : 'closed');
    root.style.display = open ? '' : 'none';
    if (currentProps.position) {
      root.style.position = 'absolute';
      root.style.left = currentProps.position.x + 'px';
      root.style.top = currentProps.position.y + 'px';
    }
    searchEl.value = currentProps.query ?? '';
    renderList();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createSlashMenu;
