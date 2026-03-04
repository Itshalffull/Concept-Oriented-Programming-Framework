import { uid } from '../shared/uid.js';
export interface CalendarViewProps { value?: string; month?: number; year?: number; minDate?: string; maxDate?: string; events?: Array<{ date: string; label: string; color?: string }>; onSelect?: (date: string) => void; onMonthChange?: (month: number, year: number) => void; className?: string; }
export interface CalendarViewInstance { element: HTMLElement; update(props: Partial<CalendarViewProps>): void; destroy(): void; }
export function createCalendarView(options: { target: HTMLElement; props: CalendarViewProps; }): CalendarViewInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  const now = new Date(); let viewMonth = currentProps.month ?? now.getMonth(); let viewYear = currentProps.year ?? now.getFullYear();
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'calendar-view'); root.setAttribute('data-part', 'root');
  const headerEl = document.createElement('div'); headerEl.setAttribute('data-part', 'header'); root.appendChild(headerEl);
  const prevBtn = document.createElement('button'); prevBtn.setAttribute('data-part', 'prev-month'); prevBtn.type = 'button'; prevBtn.setAttribute('aria-label','Previous month'); prevBtn.textContent = '\u2039'; headerEl.appendChild(prevBtn);
  const titleEl = document.createElement('span'); titleEl.setAttribute('data-part', 'title'); headerEl.appendChild(titleEl);
  const nextBtn = document.createElement('button'); nextBtn.setAttribute('data-part', 'next-month'); nextBtn.type = 'button'; nextBtn.setAttribute('aria-label','Next month'); nextBtn.textContent = '\u203a'; headerEl.appendChild(nextBtn);
  const gridEl = document.createElement('table'); gridEl.setAttribute('data-part', 'grid'); gridEl.setAttribute('role', 'grid'); root.appendChild(gridEl);
  prevBtn.addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } currentProps.onMonthChange?.(viewMonth, viewYear); sync(); });
  nextBtn.addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } currentProps.onMonthChange?.(viewMonth, viewYear); sync(); });
  function pad(n: number) { return n < 10 ? '0' + n : String(n); }
  function sync() {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    titleEl.textContent = months[viewMonth] + ' ' + viewYear;
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    gridEl.innerHTML = '';
    const thead = document.createElement('thead'); const hrow = document.createElement('tr');
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => { const th = document.createElement('th'); th.textContent = d; th.setAttribute('scope','col'); hrow.appendChild(th); });
    thead.appendChild(hrow); gridEl.appendChild(thead);
    const tbody = document.createElement('tbody'); let row = document.createElement('tr');
    for (let i = 0; i < firstDay; i++) { row.appendChild(document.createElement('td')); }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = viewYear + '-' + pad(viewMonth + 1) + '-' + pad(d);
      const td = document.createElement('td');
      const btn = document.createElement('button'); btn.setAttribute('data-part', 'day'); btn.type = 'button'; btn.textContent = String(d);
      btn.setAttribute('data-selected', currentProps.value === dateStr ? 'true' : 'false');
      btn.setAttribute('aria-selected', currentProps.value === dateStr ? 'true' : 'false');
      const evts = (currentProps.events ?? []).filter(e => e.date === dateStr);
      if (evts.length) btn.setAttribute('data-has-events', 'true');
      btn.addEventListener('click', () => { currentProps.value = dateStr; currentProps.onSelect?.(dateStr); sync(); });
      td.appendChild(btn); row.appendChild(td);
      if ((firstDay + d) % 7 === 0) { tbody.appendChild(row); row = document.createElement('tr'); }
    }
    if (row.children.length) { while (row.children.length < 7) row.appendChild(document.createElement('td')); tbody.appendChild(row); }
    gridEl.appendChild(tbody);
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); if (next.month !== undefined) viewMonth = next.month; if (next.year !== undefined) viewYear = next.year; sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createCalendarView;
