import { uid } from '../shared/uid.js';
export interface PaginationProps { page?: number; totalPages?: number; siblingCount?: number; onChange?: (page: number) => void; className?: string; }
export interface PaginationInstance { element: HTMLElement; update(props: Partial<PaginationProps>): void; destroy(): void; }
export function createPagination(options: { target: HTMLElement; props: PaginationProps; }): PaginationInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('nav'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'pagination'); root.setAttribute('data-part', 'root');
  root.setAttribute('aria-label', 'Pagination');
  const listEl = document.createElement('ul'); listEl.setAttribute('data-part', 'list'); root.appendChild(listEl);
  function getPages(): (number | '...')[] {
    const total = currentProps.totalPages ?? 1; const page = currentProps.page ?? 1; const sibs = currentProps.siblingCount ?? 1;
    const pages: (number | '...')[] = []; const start = Math.max(2, page - sibs); const end = Math.min(total - 1, page + sibs);
    pages.push(1); if (start > 2) pages.push('...'); for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push('...'); if (total > 1) pages.push(total); return pages;
  }
  function goTo(p: number) { const total = currentProps.totalPages ?? 1; p = Math.max(1, Math.min(p, total)); currentProps.page = p; currentProps.onChange?.(p); sync(); }
  function sync() {
    const page = currentProps.page ?? 1; const total = currentProps.totalPages ?? 1;
    listEl.innerHTML = ''; cleanups.length = 0;
    const prevLi = document.createElement('li'); const prevBtn = document.createElement('button'); prevBtn.setAttribute('data-part', 'prev'); prevBtn.setAttribute('type', 'button');
    prevBtn.setAttribute('aria-label', 'Previous page'); prevBtn.textContent = '\u2039'; prevBtn.disabled = page <= 1;
    prevBtn.addEventListener('click', () => goTo(page - 1)); prevLi.appendChild(prevBtn); listEl.appendChild(prevLi);
    getPages().forEach(p => {
      const li = document.createElement('li');
      if (p === '...') { const span = document.createElement('span'); span.setAttribute('data-part', 'ellipsis'); span.textContent = '...'; li.appendChild(span); }
      else { const btn = document.createElement('button'); btn.setAttribute('data-part', 'page'); btn.setAttribute('type', 'button');
        btn.setAttribute('aria-current', p === page ? 'page' : 'false'); btn.setAttribute('data-selected', p === page ? 'true' : 'false');
        btn.textContent = String(p); btn.addEventListener('click', () => goTo(p as number)); li.appendChild(btn); }
      listEl.appendChild(li);
    });
    const nextLi = document.createElement('li'); const nextBtn = document.createElement('button'); nextBtn.setAttribute('data-part', 'next'); nextBtn.setAttribute('type', 'button');
    nextBtn.setAttribute('aria-label', 'Next page'); nextBtn.textContent = '\u203a'; nextBtn.disabled = page >= total;
    nextBtn.addEventListener('click', () => goTo(page + 1)); nextLi.appendChild(nextBtn); listEl.appendChild(nextLi);
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createPagination;
