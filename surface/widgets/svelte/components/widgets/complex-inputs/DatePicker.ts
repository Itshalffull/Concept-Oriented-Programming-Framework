import { uid } from '../shared/uid.js';
export interface DatePickerProps { value?: string; placeholder?: string; minDate?: string; maxDate?: string; disabled?: boolean; label?: string; error?: string; format?: string; onChange?: (value: string) => void; className?: string; }
export interface DatePickerInstance { element: HTMLElement; update(props: Partial<DatePickerProps>): void; destroy(): void; }
export function createDatePicker(options: { target: HTMLElement; props: DatePickerProps; }): DatePickerInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = []; let open = false;
  const now = new Date(); let viewMonth = now.getMonth(); let viewYear = now.getFullYear();
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'date-picker'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('label'); labelEl.setAttribute('data-part', 'label'); labelEl.setAttribute('for', id); root.appendChild(labelEl);
  const inputEl = document.createElement('input'); inputEl.type = 'text'; inputEl.setAttribute('data-part', 'input'); inputEl.id = id; inputEl.readOnly = true; root.appendChild(inputEl);
  const calendarEl = document.createElement('div'); calendarEl.setAttribute('data-part', 'calendar'); calendarEl.setAttribute('role', 'dialog'); root.appendChild(calendarEl);
  const errorEl = document.createElement('span'); errorEl.setAttribute('data-part', 'error'); errorEl.setAttribute('role', 'alert'); root.appendChild(errorEl);
  inputEl.addEventListener('click', () => { if (!currentProps.disabled) { open = !open; sync(); } });
  document.addEventListener('click', (e) => { if (open && !root.contains(e.target as Node)) { open = false; sync(); } });
  function pad(n: number) { return n < 10 ? '0' + n : String(n); }
  function buildCalendar() {
    calendarEl.innerHTML = '';
    const header = document.createElement('div'); header.setAttribute('data-part', 'calendar-header');
    const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '\u2039'; prev.addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } sync(); }); header.appendChild(prev);
    const title = document.createElement('span'); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; title.textContent = months[viewMonth] + ' ' + viewYear; header.appendChild(title);
    const next = document.createElement('button'); next.type = 'button'; next.textContent = '\u203a'; next.addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } sync(); }); header.appendChild(next);
    calendarEl.appendChild(header);
    const grid = document.createElement('div'); grid.setAttribute('data-part', 'grid'); grid.setAttribute('role', 'grid');
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { const empty = document.createElement('span'); grid.appendChild(empty); }
    for (let d = 1; d <= days; d++) {
      const dateStr = viewYear + '-' + pad(viewMonth + 1) + '-' + pad(d);
      const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'day'); btn.textContent = String(d);
      btn.setAttribute('data-selected', currentProps.value === dateStr ? 'true' : 'false');
      btn.addEventListener('click', () => { currentProps.value = dateStr; open = false; currentProps.onChange?.(dateStr); sync(); });
      grid.appendChild(btn);
    }
    calendarEl.appendChild(grid);
  }
  function sync() {
    root.setAttribute('data-state', open ? 'open' : 'closed'); root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    inputEl.value = currentProps.value ?? ''; inputEl.placeholder = currentProps.placeholder ?? 'Select date'; inputEl.disabled = currentProps.disabled ?? false;
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? ''; errorEl.style.display = currentProps.error ? '' : 'none';
    calendarEl.style.display = open ? '' : 'none'; if (open) buildCalendar();
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createDatePicker;
