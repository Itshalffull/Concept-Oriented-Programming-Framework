import { uid } from '../shared/uid.js';
export interface FileUploadProps { accept?: string; multiple?: boolean; maxSize?: number; disabled?: boolean; label?: string; description?: string; error?: string; onUpload?: (files: File[]) => void; className?: string; }
export interface FileUploadInstance { element: HTMLElement; update(props: Partial<FileUploadProps>): void; destroy(): void; }
export function createFileUpload(options: { target: HTMLElement; props: FileUploadProps; }): FileUploadInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  let files: File[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'file-upload'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('label'); labelEl.setAttribute('data-part', 'label'); root.appendChild(labelEl);
  const dropzone = document.createElement('div'); dropzone.setAttribute('data-part', 'dropzone'); dropzone.setAttribute('role', 'button'); dropzone.setAttribute('tabindex', '0'); root.appendChild(dropzone);
  const inputEl = document.createElement('input'); inputEl.type = 'file'; inputEl.id = id; inputEl.style.display = 'none'; dropzone.appendChild(inputEl);
  const descEl = document.createElement('div'); descEl.setAttribute('data-part', 'description'); descEl.textContent = 'Drop files here or click to upload'; dropzone.appendChild(descEl);
  const fileListEl = document.createElement('div'); fileListEl.setAttribute('data-part', 'file-list'); root.appendChild(fileListEl);
  const errorEl = document.createElement('span'); errorEl.setAttribute('data-part', 'error'); errorEl.setAttribute('role', 'alert'); root.appendChild(errorEl);
  dropzone.addEventListener('click', () => { if (!currentProps.disabled) inputEl.click(); });
  dropzone.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputEl.click(); } }) as EventListener);
  inputEl.addEventListener('change', () => { if (inputEl.files) { files = Array.from(inputEl.files); currentProps.onUpload?.(files); sync(); } });
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.setAttribute('data-dragging', 'true'); });
  dropzone.addEventListener('dragleave', () => dropzone.removeAttribute('data-dragging'));
  dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.removeAttribute('data-dragging'); if (e.dataTransfer?.files) { files = Array.from(e.dataTransfer.files); currentProps.onUpload?.(files); sync(); } });
  function sync() {
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false'); root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    if (currentProps.accept) inputEl.accept = currentProps.accept; inputEl.multiple = currentProps.multiple ?? false;
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? ''; errorEl.style.display = currentProps.error ? '' : 'none';
    fileListEl.innerHTML = '';
    files.forEach((f, i) => {
      const item = document.createElement('div'); item.setAttribute('data-part', 'file-item'); item.textContent = f.name + ' (' + Math.round(f.size / 1024) + 'KB)';
      const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.textContent = '\u00d7'; removeBtn.setAttribute('aria-label', 'Remove ' + f.name);
      removeBtn.addEventListener('click', () => { files.splice(i, 1); sync(); });
      item.appendChild(removeBtn); fileListEl.appendChild(item);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createFileUpload;
