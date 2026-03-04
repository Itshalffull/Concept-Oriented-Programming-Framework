import { uid } from '../shared/uid.js';
export interface MentionInputProps { value?: string; trigger?: string; suggestions?: Array<{ id: string; label: string; avatar?: string }>; placeholder?: string; onChange?: (value: string) => void; onMention?: (id: string) => void; className?: string; }
export interface MentionInputInstance { element: HTMLElement; update(props: Partial<MentionInputProps>): void; destroy(): void; }
export function createMentionInput(options: { target: HTMLElement; props: MentionInputProps; }): MentionInputInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  let showSuggestions = false; let query = ''; let highlightIdx = 0;
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'mention-input'); root.setAttribute('data-part', 'root');
  const inputEl = document.createElement('div'); inputEl.setAttribute('data-part', 'input'); inputEl.setAttribute('contenteditable', 'true'); inputEl.setAttribute('role', 'textbox'); inputEl.id = id; root.appendChild(inputEl);
  const listEl = document.createElement('ul'); listEl.setAttribute('data-part', 'suggestions'); listEl.setAttribute('role', 'listbox'); root.appendChild(listEl);
  inputEl.addEventListener('input', () => {
    const text = inputEl.textContent ?? ''; currentProps.value = text; currentProps.onChange?.(text);
    const trigger = currentProps.trigger ?? '@'; const lastAt = text.lastIndexOf(trigger);
    if (lastAt >= 0) { query = text.slice(lastAt + 1).toLowerCase(); showSuggestions = true; highlightIdx = 0; } else { showSuggestions = false; }
    sync();
  });
  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (!showSuggestions) return; const filtered = getFiltered();
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, filtered.length - 1); sync(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); sync(); }
    if (e.key === 'Enter' && filtered[highlightIdx]) { e.preventDefault(); selectSuggestion(filtered[highlightIdx]); }
    if (e.key === 'Escape') { showSuggestions = false; sync(); }
  }) as EventListener);
  function getFiltered() { return (currentProps.suggestions ?? []).filter(s => s.label.toLowerCase().includes(query)); }
  function selectSuggestion(s: { id: string; label: string }) {
    const trigger = currentProps.trigger ?? '@'; const text = inputEl.textContent ?? ''; const lastAt = text.lastIndexOf(trigger);
    inputEl.textContent = text.slice(0, lastAt) + trigger + s.label + ' '; currentProps.value = inputEl.textContent;
    currentProps.onMention?.(s.id); showSuggestions = false; currentProps.onChange?.(currentProps.value); sync();
  }
  function sync() {
    const filtered = getFiltered();
    inputEl.setAttribute('data-placeholder', currentProps.placeholder ?? '');
    listEl.innerHTML = ''; listEl.style.display = showSuggestions && filtered.length ? '' : 'none';
    filtered.forEach((s, i) => {
      const li = document.createElement('li'); li.setAttribute('role', 'option'); li.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false');
      li.textContent = s.label; li.addEventListener('mousedown', (e) => { e.preventDefault(); selectSuggestion(s); }); listEl.appendChild(li);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createMentionInput;
