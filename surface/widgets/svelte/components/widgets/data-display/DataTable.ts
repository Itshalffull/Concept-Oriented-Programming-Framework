import { uid } from '../shared/uid.js';
export interface DataTableProps { columns?: Array<{ key: string; label: string; sortable?: boolean; width?: string }>; rows?: Array<Record<string, any>>; sortKey?: string; sortDir?: 'asc'|'desc'; selectable?: boolean; selectedRows?: number[]; onSort?: (key: string, dir: 'asc'|'desc') => void; onRowSelect?: (indices: number[]) => void; className?: string; }
export interface DataTableInstance { element: HTMLElement; update(props: Partial<DataTableProps>): void; destroy(): void; }
export function createDataTable(options: { target: HTMLElement; props: DataTableProps; }): DataTableInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'data-table'); root.setAttribute('data-part', 'root');
  const tableEl = document.createElement('table'); tableEl.setAttribute('data-part', 'table'); tableEl.setAttribute('role', 'grid'); root.appendChild(tableEl);
  function sync() {
    const cols = currentProps.columns ?? []; const rows = currentProps.rows ?? []; const sel = currentProps.selectedRows ?? [];
    tableEl.innerHTML = '';
    const thead = document.createElement('thead'); const hrow = document.createElement('tr');
    if (currentProps.selectable) {
      const th = document.createElement('th'); const cb = document.createElement('input'); cb.type = 'checkbox';
      cb.checked = sel.length === rows.length && rows.length > 0;
      cb.addEventListener('change', () => { currentProps.selectedRows = cb.checked ? rows.map((_, i) => i) : []; currentProps.onRowSelect?.(currentProps.selectedRows); sync(); });
      th.appendChild(cb); hrow.appendChild(th);
    }
    cols.forEach(col => {
      const th = document.createElement('th'); th.setAttribute('data-part', 'column-header');
      th.textContent = col.label; if (col.width) th.style.width = col.width;
      if (col.sortable) {
        th.setAttribute('data-sortable', 'true'); th.style.cursor = 'pointer';
        th.setAttribute('aria-sort', currentProps.sortKey === col.key ? (currentProps.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
        th.addEventListener('click', () => {
          const dir = currentProps.sortKey === col.key && currentProps.sortDir === 'asc' ? 'desc' : 'asc';
          currentProps.sortKey = col.key; currentProps.sortDir = dir; currentProps.onSort?.(col.key, dir); sync();
        });
      }
      hrow.appendChild(th);
    });
    thead.appendChild(hrow); tableEl.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach((row, ri) => {
      const tr = document.createElement('tr'); tr.setAttribute('data-part', 'row');
      tr.setAttribute('data-selected', sel.includes(ri) ? 'true' : 'false');
      if (currentProps.selectable) {
        const td = document.createElement('td'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = sel.includes(ri);
        cb.addEventListener('change', () => {
          const s = [...(currentProps.selectedRows ?? [])]; const idx = s.indexOf(ri);
          if (idx >= 0) s.splice(idx, 1); else s.push(ri);
          currentProps.selectedRows = s; currentProps.onRowSelect?.(s); sync();
        });
        td.appendChild(cb); tr.appendChild(td);
      }
      cols.forEach(col => { const td = document.createElement('td'); td.setAttribute('data-part', 'cell'); td.textContent = String(row[col.key] ?? ''); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createDataTable;
