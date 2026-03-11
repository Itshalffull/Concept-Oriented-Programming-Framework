import { uid } from '../shared/uid.js';
export interface SignaturePadProps { width?: number; height?: number; strokeColor?: string; strokeWidth?: number; disabled?: boolean; label?: string; onClear?: () => void; onChange?: (dataUrl: string) => void; className?: string; }
export interface SignaturePadInstance { element: HTMLElement; update(props: Partial<SignaturePadProps>): void; destroy(): void; clear(): void; }
export function createSignaturePad(options: { target: HTMLElement; props: SignaturePadProps; }): SignaturePadInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  let drawing = false;
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'signature-pad'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('div'); labelEl.setAttribute('data-part', 'label'); root.appendChild(labelEl);
  const canvas = document.createElement('canvas'); canvas.setAttribute('data-part', 'canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Signature pad'); root.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const actionsEl = document.createElement('div'); actionsEl.setAttribute('data-part', 'actions'); root.appendChild(actionsEl);
  const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.setAttribute('data-part', 'clear'); clearBtn.textContent = 'Clear'; actionsEl.appendChild(clearBtn);
  function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); currentProps.onClear?.(); }
  clearBtn.addEventListener('click', clear);
  canvas.addEventListener('mousedown', (e) => { if (currentProps.disabled) return; drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
  canvas.addEventListener('mousemove', (e) => { if (!drawing) return; ctx.strokeStyle = currentProps.strokeColor ?? '#000'; ctx.lineWidth = currentProps.strokeWidth ?? 2; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); });
  canvas.addEventListener('mouseup', () => { drawing = false; currentProps.onChange?.(canvas.toDataURL()); });
  canvas.addEventListener('mouseleave', () => { if (drawing) { drawing = false; currentProps.onChange?.(canvas.toDataURL()); } });
  function sync() {
    canvas.width = currentProps.width ?? 400; canvas.height = currentProps.height ?? 200;
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); }, clear };
}
export default createSignaturePad;
