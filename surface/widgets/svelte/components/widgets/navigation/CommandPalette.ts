import { uid } from '../shared/uid.js';
export interface CommandPaletteProps { open?: boolean; items?: Array<{ id: string; label: string; group?: string; shortcut?: string; icon?: string; disabled?: boolean }>; placeholder?: string; onSelect?: (id: string) => void; onOpenChange?: (open: boolean) => void; className?: string; }
export interface CommandPaletteInstance { element: HTMLElement; update(props: Partial<CommandPaletteProps>): void; destroy(): void; }
export function createCommandPalette(options: { target: HTMLElement; props: CommandPaletteProps; }): CommandPaletteInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  let query = ''; let highlightIdx = 0;
  const backdrop = document.createElement('div'); backdrop.setAttribute('data-surface-widget', ''); backdrop.setAttribute('data-widget-name', 'command-palette'); backdrop.setAttribute('data-part', 'backdrop');
  const root = document.createElement('div'); root.setAttribute('data-part', 'root'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); backdrop.appendChild(root);
  const inputEl = document.createElement('input'); inputEl.setAttribute('data-part', 'input'); inputEl.type = 'text'; inputEl.setAttribute('role', 'combobox'); inputEl.setAttribute('aria-autocomplete', 'list'); root.appendChild(inputEl);
  const listEl = document.createElement('div'); listEl.setAttribute('data-part', 'list'); listEl.setAttribute('role', 'listbox'); root.appendChild(listEl);
  const emptyEl = document.createElement('div'); emptyEl.setAttribute('data-part', 'empty'); emptyEl.textContent = 'No results found'; root.appendChild(emptyEl);
  function getFiltered() { const items = currentProps.items ?? []; if (!query) return items; const q = query.toLowerCase(); return items.filter(i => i.label.toLowerCase().includes(q)); }
  inputEl.addEventListener('input', () => { query = inputEl.value; highlightIdx = 0; sync(); });
  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    const f = getFiltered();
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, f.length - 1); sync(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); sync(); }
    if (e.key === 'Enter' && f[highlightIdx]) { currentProps.onSelect?.(f[highlightIdx].id); currentProps.onOpenChange?.(false); }
    if (e.key === 'Escape') { currentProps.onOpenChange?.(false); }
  }) as EventListener);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) currentProps.onOpenChange?.(false); });
  function sync() {
    const filtered = getFiltered();
    backdrop.setAttribute('data-state', currentProps.open ? 'open' : 'closed'); backdrop.style.display = currentProps.open ? '' : 'none';
    inputEl.placeholder = currentProps.placeholder ?? 'Type a command...';
    listEl.innerHTML = '';
    emptyEl.style.display = filtered.length === 0 ? '' : 'none';
    let currentGroup = '';
    filtered.forEach((item, i) => {
      if (item.group && item.group !== currentGroup) {
        currentGroup = item.group;
        const groupEl = document.createElement('div'); groupEl.setAttribute('data-part', 'group-label'); groupEl.textContent = item.group; listEl.appendChild(groupEl);
      }
      const el = document.createElement('div'); el.setAttribute('data-part', 'item'); el.setAttribute('role', 'option');
      el.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false');
      el.setAttribute('data-disabled', item.disabled ? 'true' : 'false');
      el.textContent = item.label;
      if (item.shortcut) { const kbd = document.createElement('kbd'); kbd.textContent = item.shortcut; el.appendChild(kbd); }
      if (!item.disabled) el.addEventListener('click', () => { currentProps.onSelect?.(item.id); currentProps.onOpenChange?.(false); });
      el.addEventListener('mouseenter', () => { highlightIdx = i; sync(); });
      listEl.appendChild(el);
    });
    if (currentProps.open) { inputEl.value = query; inputEl.focus(); }
    if (currentProps.className) backdrop.className = currentProps.className; else backdrop.className = '';
  }
  sync(); target.appendChild(backdrop);
  return { element: backdrop, update(next) { const wasOpen = currentProps.open; Object.assign(currentProps, next); if (!wasOpen && currentProps.open) { query = ''; highlightIdx = 0; } sync(); }, destroy() { cleanups.forEach(fn => fn()); backdrop.remove(); } };
}
export default createCommandPalette;
