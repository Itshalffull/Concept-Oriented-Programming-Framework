import { uid } from '../shared/uid.js';

export interface MasterDetailItem {
  id: string;
  title: string;
  meta?: string;
  [key: string]: unknown;
}

export interface MasterDetailProps {
  items?: MasterDetailItem[];
  selectedId?: string;
  orientation?: 'horizontal' | 'vertical';
  masterWidth?: string;
  minMasterWidth?: string;
  maxMasterWidth?: string;
  collapsible?: boolean;
  collapseBreakpoint?: number;
  showSearch?: boolean;
  resizable?: boolean;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
  renderDetail?: (item: MasterDetailItem) => string | HTMLElement;
  renderListItem?: (item: MasterDetailItem) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface MasterDetailInstance {
  element: HTMLElement;
  update(props: Partial<MasterDetailProps>): void;
  destroy(): void;
}

export function createMasterDetail(options: {
  target: HTMLElement;
  props: MasterDetailProps;
}): MasterDetailInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let searchQuery = '';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'master-detail');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Master detail view');
  root.id = id;

  const masterEl = document.createElement('div');
  masterEl.setAttribute('data-part', 'master');
  masterEl.setAttribute('role', 'navigation');
  root.appendChild(masterEl);

  const searchEl = document.createElement('input');
  searchEl.setAttribute('data-part', 'search');
  searchEl.setAttribute('type', 'search');
  searchEl.setAttribute('aria-label', 'Filter items');
  masterEl.appendChild(searchEl);

  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'list');
  listEl.setAttribute('role', 'listbox');
  masterEl.appendChild(listEl);

  const detailEl = document.createElement('div');
  detailEl.setAttribute('data-part', 'detail');
  detailEl.setAttribute('role', 'region');
  detailEl.setAttribute('aria-label', 'Item details');
  root.appendChild(detailEl);

  const emptyEl = document.createElement('div');
  emptyEl.setAttribute('data-part', 'empty');
  detailEl.appendChild(emptyEl);

  searchEl.addEventListener('input', () => { searchQuery = searchEl.value; sync(); });
  cleanups.push(() => {});

  function renderList() {
    listEl.innerHTML = '';
    const items = (currentProps.items ?? []).filter(it =>
      !searchQuery || it.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    items.forEach(it => {
      const option = document.createElement('div');
      option.setAttribute('data-part', 'list-item');
      option.setAttribute('role', 'option');
      option.setAttribute('tabindex', '0');
      option.setAttribute('aria-selected', it.id === currentProps.selectedId ? 'true' : 'false');
      if (currentProps.renderListItem) {
        const rendered = currentProps.renderListItem(it);
        if (typeof rendered === 'string') option.innerHTML = rendered;
        else option.appendChild(rendered);
      } else {
        const titleSpan = document.createElement('span');
        titleSpan.textContent = it.title;
        option.appendChild(titleSpan);
        if (it.meta) { const metaSpan = document.createElement('span'); metaSpan.textContent = it.meta; option.appendChild(metaSpan); }
      }
      option.addEventListener('click', () => currentProps.onSelect?.(it.id));
      option.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') currentProps.onSelect?.(it.id); });
      listEl.appendChild(option);
    });
  }

  function renderDetail() {
    detailEl.innerHTML = '';
    const selected = (currentProps.items ?? []).find(it => it.id === currentProps.selectedId);
    if (!selected) {
      const empty = document.createElement('div');
      empty.setAttribute('data-part', 'empty');
      const title = document.createElement('p');
      title.textContent = currentProps.emptyTitle ?? 'No item selected';
      empty.appendChild(title);
      if (currentProps.emptyDescription) {
        const desc = document.createElement('p');
        desc.textContent = currentProps.emptyDescription;
        empty.appendChild(desc);
      }
      detailEl.appendChild(empty);
      return;
    }
    if (currentProps.renderDetail) {
      const rendered = currentProps.renderDetail(selected);
      if (typeof rendered === 'string') detailEl.innerHTML = rendered;
      else detailEl.appendChild(rendered);
    } else {
      const h = document.createElement('h2');
      h.textContent = selected.title;
      detailEl.appendChild(h);
    }
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    masterEl.style.width = currentProps.masterWidth ?? '';
    searchEl.style.display = currentProps.showSearch ? '' : 'none';
    renderList();
    renderDetail();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createMasterDetail;
