import { uid } from '../shared/uid.js';
export interface KanbanBoardProps { columns?: Array<{ id: string; title: string; items: Array<{ id: string; title: string; description?: string }> }>; onMoveItem?: (itemId: string, fromCol: string, toCol: string) => void; className?: string; }
export interface KanbanBoardInstance { element: HTMLElement; update(props: Partial<KanbanBoardProps>): void; destroy(): void; }
export function createKanbanBoard(options: { target: HTMLElement; props: KanbanBoardProps; }): KanbanBoardInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'kanban-board'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Kanban Board');
  function sync() {
    root.innerHTML = ''; root.style.display = 'flex'; root.style.gap = '16px';
    (currentProps.columns ?? []).forEach(col => {
      const colEl = document.createElement('div'); colEl.setAttribute('data-part', 'column'); colEl.setAttribute('data-column-id', col.id);
      const header = document.createElement('div'); header.setAttribute('data-part', 'column-header');
      const title = document.createElement('h3'); title.textContent = col.title; header.appendChild(title);
      const count = document.createElement('span'); count.setAttribute('data-part', 'count'); count.textContent = String(col.items.length); header.appendChild(count);
      colEl.appendChild(header);
      const itemsEl = document.createElement('div'); itemsEl.setAttribute('data-part', 'items'); itemsEl.setAttribute('role', 'list');
      col.items.forEach(item => {
        const card = document.createElement('div'); card.setAttribute('data-part', 'card'); card.setAttribute('role', 'listitem');
        card.setAttribute('draggable', 'true'); card.setAttribute('data-item-id', item.id);
        const cardTitle = document.createElement('div'); cardTitle.setAttribute('data-part', 'card-title'); cardTitle.textContent = item.title; card.appendChild(cardTitle);
        if (item.description) { const desc = document.createElement('div'); desc.setAttribute('data-part', 'card-description'); desc.textContent = item.description; card.appendChild(desc); }
        card.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', JSON.stringify({ itemId: item.id, fromCol: col.id })); });
        itemsEl.appendChild(card);
      });
      colEl.appendChild(itemsEl);
      colEl.addEventListener('dragover', (e) => e.preventDefault());
      colEl.addEventListener('drop', (e) => {
        e.preventDefault(); try { const data = JSON.parse(e.dataTransfer?.getData('text/plain') ?? '{}');
        if (data.itemId && data.fromCol !== col.id) currentProps.onMoveItem?.(data.itemId, data.fromCol, col.id); } catch {}
      });
      root.appendChild(colEl);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createKanbanBoard;
