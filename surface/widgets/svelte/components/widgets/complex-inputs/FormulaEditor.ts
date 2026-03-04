import { uid } from '../shared/uid.js';
export interface FormulaEditorProps { value?: string; variables?: Array<{ name: string; type: string }>; functions?: Array<{ name: string; signature: string }>; error?: string; label?: string; onChange?: (value: string) => void; className?: string; }
export interface FormulaEditorInstance { element: HTMLElement; update(props: Partial<FormulaEditorProps>): void; destroy(): void; }
export function createFormulaEditor(options: { target: HTMLElement; props: FormulaEditorProps; }): FormulaEditorInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'formula-editor'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('label'); labelEl.setAttribute('data-part', 'label'); labelEl.setAttribute('for', id); root.appendChild(labelEl);
  const inputEl = document.createElement('textarea'); inputEl.setAttribute('data-part', 'input'); inputEl.id = id; inputEl.setAttribute('role', 'textbox'); inputEl.setAttribute('aria-multiline', 'true'); root.appendChild(inputEl);
  const toolbarEl = document.createElement('div'); toolbarEl.setAttribute('data-part', 'toolbar'); toolbarEl.setAttribute('role', 'toolbar'); root.appendChild(toolbarEl);
  const errorEl = document.createElement('span'); errorEl.setAttribute('data-part', 'error'); errorEl.setAttribute('role', 'alert'); root.appendChild(errorEl);
  inputEl.addEventListener('input', () => { currentProps.value = inputEl.value; currentProps.onChange?.(inputEl.value); sync(); });
  function sync() {
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    inputEl.value = currentProps.value ?? '';
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? ''; errorEl.style.display = currentProps.error ? '' : 'none';
    toolbarEl.innerHTML = '';
    (currentProps.variables ?? []).forEach(v => { const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'variable'); btn.textContent = v.name;
      btn.addEventListener('click', () => { inputEl.value += v.name; currentProps.value = inputEl.value; currentProps.onChange?.(inputEl.value); }); toolbarEl.appendChild(btn); });
    (currentProps.functions ?? []).forEach(f => { const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'function'); btn.textContent = f.name;
      btn.addEventListener('click', () => { inputEl.value += f.name + '()'; currentProps.value = inputEl.value; currentProps.onChange?.(inputEl.value); }); toolbarEl.appendChild(btn); });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createFormulaEditor;
