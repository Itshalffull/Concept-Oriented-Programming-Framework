import { uid } from '../shared/uid.js';
export interface DateRangePickerProps { startDate?: string; endDate?: string; placeholder?: string; disabled?: boolean; label?: string; error?: string; onChange?: (start: string, end: string) => void; className?: string; }
export interface DateRangePickerInstance { element: HTMLElement; update(props: Partial<DateRangePickerProps>): void; destroy(): void; }
export function createDateRangePicker(options: { target: HTMLElement; props: DateRangePickerProps; }): DateRangePickerInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = []; let open = false; let selectingEnd = false;
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'date-range-picker'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('label'); labelEl.setAttribute('data-part', 'label'); root.appendChild(labelEl);
  const inputEl = document.createElement('input'); inputEl.type = 'text'; inputEl.setAttribute('data-part', 'input'); inputEl.readOnly = true; root.appendChild(inputEl);
  const panelEl = document.createElement('div'); panelEl.setAttribute('data-part', 'panel'); root.appendChild(panelEl);
  const errorEl = document.createElement('span'); errorEl.setAttribute('data-part', 'error'); errorEl.setAttribute('role', 'alert'); root.appendChild(errorEl);
  inputEl.addEventListener('click', () => { if (!currentProps.disabled) { open = !open; selectingEnd = false; sync(); } });
  document.addEventListener('click', (e) => { if (open && !root.contains(e.target as Node)) { open = false; sync(); } });
  function sync() {
    root.setAttribute('data-state', open ? 'open' : 'closed'); root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    const start = currentProps.startDate ?? ''; const end = currentProps.endDate ?? '';
    inputEl.value = start && end ? start + ' - ' + end : start || (currentProps.placeholder ?? 'Select range');
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? ''; errorEl.style.display = currentProps.error ? '' : 'none';
    panelEl.style.display = open ? '' : 'none';
    panelEl.innerHTML = '';
    if (open) {
      const msg = document.createElement('div'); msg.setAttribute('data-part', 'message');
      msg.textContent = selectingEnd ? 'Select end date' : 'Select start date'; panelEl.appendChild(msg);
      const now = new Date(); const month = now.getMonth(); const year = now.getFullYear();
      const days = new Date(year, month + 1, 0).getDate();
      const grid = document.createElement('div'); grid.setAttribute('data-part', 'grid');
      function pad(n: number) { return n < 10 ? '0' + n : String(n); }
      for (let d = 1; d <= days; d++) {
        const dateStr = year + '-' + pad(month + 1) + '-' + pad(d);
        const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'day'); btn.textContent = String(d);
        const inRange = start && end && dateStr >= start && dateStr <= end;
        btn.setAttribute('data-in-range', inRange ? 'true' : 'false');
        btn.setAttribute('data-selected', dateStr === start || dateStr === end ? 'true' : 'false');
        btn.addEventListener('click', () => {
          if (!selectingEnd) { currentProps.startDate = dateStr; currentProps.endDate = ''; selectingEnd = true; }
          else { if (dateStr >= (currentProps.startDate ?? '')) currentProps.endDate = dateStr; else { currentProps.endDate = currentProps.startDate; currentProps.startDate = dateStr; }
            selectingEnd = false; open = false; currentProps.onChange?.(currentProps.startDate!, currentProps.endDate!); }
          sync();
        });
        grid.appendChild(btn);
      }
      panelEl.appendChild(grid);
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createDateRangePicker;
