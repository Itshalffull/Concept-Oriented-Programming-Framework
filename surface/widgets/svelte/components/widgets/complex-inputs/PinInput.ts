import { uid } from '../shared/uid.js';
export interface PinInputProps { length?: number; value?: string; mask?: boolean; disabled?: boolean; error?: string; onComplete?: (value: string) => void; onChange?: (value: string) => void; className?: string; }
export interface PinInputInstance { element: HTMLElement; update(props: Partial<PinInputProps>): void; destroy(): void; }
export function createPinInput(options: { target: HTMLElement; props: PinInputProps; }): PinInputInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'pin-input'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'PIN input');
  const errorEl = document.createElement('span'); errorEl.setAttribute('data-part', 'error'); errorEl.setAttribute('role', 'alert');
  let inputs: HTMLInputElement[] = [];
  function sync() {
    const len = currentProps.length ?? 4; const val = currentProps.value ?? '';
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    root.innerHTML = ''; inputs = []; cleanups.length = 0;
    for (let i = 0; i < len; i++) {
      const inp = document.createElement('input'); inp.type = currentProps.mask ? 'password' : 'text'; inp.setAttribute('data-part', 'input');
      inp.maxLength = 1; inp.value = val[i] ?? ''; inp.disabled = currentProps.disabled ?? false; inp.setAttribute('aria-label', 'Digit ' + (i + 1));
      inp.inputMode = 'numeric'; inp.pattern = '[0-9]';
      inp.addEventListener('input', () => {
        let v = ''; inputs.forEach(x => v += x.value); currentProps.value = v; currentProps.onChange?.(v);
        if (inp.value && i < len - 1) inputs[i + 1]?.focus();
        if (v.length === len) currentProps.onComplete?.(v);
      });
      inp.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1]?.focus(); }) as EventListener);
      inputs.push(inp); root.appendChild(inp);
    }
    root.appendChild(errorEl); errorEl.textContent = currentProps.error ?? ''; errorEl.style.display = currentProps.error ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createPinInput;
