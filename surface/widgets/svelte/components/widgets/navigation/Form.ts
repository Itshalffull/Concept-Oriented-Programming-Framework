import { uid } from '../shared/uid.js';
export interface FormProps { onSubmit?: (data: Record<string, string>) => void; onReset?: () => void; disabled?: boolean; children?: HTMLElement; className?: string; }
export interface FormInstance { element: HTMLElement; update(props: Partial<FormProps>): void; destroy(): void; }
export function createForm(options: { target: HTMLElement; props: FormProps; }): FormInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('form'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'form'); root.setAttribute('data-part', 'root');
  root.addEventListener('submit', (e) => {
    e.preventDefault(); const fd = new FormData(root); const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = String(v); }); currentProps.onSubmit?.(data);
  });
  root.addEventListener('reset', () => currentProps.onReset?.());
  function sync() {
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    if (currentProps.children && !root.contains(currentProps.children)) { root.innerHTML = ''; root.appendChild(currentProps.children); }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createForm;
