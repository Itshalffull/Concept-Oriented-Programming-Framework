import { uid } from '../shared/uid.js';
export interface RichTextEditorProps { value?: string; placeholder?: string; toolbar?: Array<'bold'|'italic'|'underline'|'link'|'heading'|'list'|'quote'>; disabled?: boolean; label?: string; onChange?: (value: string) => void; className?: string; }
export interface RichTextEditorInstance { element: HTMLElement; update(props: Partial<RichTextEditorProps>): void; destroy(): void; }
export function createRichTextEditor(options: { target: HTMLElement; props: RichTextEditorProps; }): RichTextEditorInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'rich-text-editor'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('label'); labelEl.setAttribute('data-part', 'label'); root.appendChild(labelEl);
  const toolbarEl = document.createElement('div'); toolbarEl.setAttribute('data-part', 'toolbar'); toolbarEl.setAttribute('role', 'toolbar'); root.appendChild(toolbarEl);
  const editorEl = document.createElement('div'); editorEl.setAttribute('data-part', 'editor'); editorEl.setAttribute('contenteditable', 'true');
  editorEl.setAttribute('role', 'textbox'); editorEl.setAttribute('aria-multiline', 'true'); editorEl.id = id; root.appendChild(editorEl);
  const commands: Record<string, string> = { bold: 'bold', italic: 'italic', underline: 'underline', heading: 'formatBlock', list: 'insertUnorderedList', quote: 'formatBlock' };
  function execCmd(cmd: string) { if (cmd === 'heading') document.execCommand('formatBlock', false, 'h2'); else if (cmd === 'quote') document.execCommand('formatBlock', false, 'blockquote'); else document.execCommand(commands[cmd] || cmd); }
  editorEl.addEventListener('input', () => { currentProps.value = editorEl.innerHTML; currentProps.onChange?.(editorEl.innerHTML); });
  function sync() {
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    editorEl.contentEditable = currentProps.disabled ? 'false' : 'true';
    if (editorEl.innerHTML !== (currentProps.value ?? '')) editorEl.innerHTML = currentProps.value ?? '';
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    toolbarEl.innerHTML = ''; cleanups.length = 0;
    (currentProps.toolbar ?? ['bold', 'italic', 'underline']).forEach(cmd => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'toolbar-button');
      btn.setAttribute('aria-label', cmd); btn.textContent = cmd[0].toUpperCase(); btn.disabled = currentProps.disabled ?? false;
      btn.addEventListener('click', () => execCmd(cmd)); toolbarEl.appendChild(btn);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createRichTextEditor;
