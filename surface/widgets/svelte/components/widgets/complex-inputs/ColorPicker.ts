import { uid } from '../shared/uid.js';
export interface ColorPickerProps { value?: string; format?: 'hex'|'rgb'|'hsl'; showAlpha?: boolean; presets?: string[]; label?: string; onChange?: (value: string) => void; className?: string; }
export interface ColorPickerInstance { element: HTMLElement; update(props: Partial<ColorPickerProps>): void; destroy(): void; }
export function createColorPicker(options: { target: HTMLElement; props: ColorPickerProps; }): ColorPickerInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = []; let open = false;
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'color-picker'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('label'); labelEl.setAttribute('data-part', 'label'); labelEl.setAttribute('for', id); root.appendChild(labelEl);
  const triggerEl = document.createElement('button'); triggerEl.setAttribute('data-part', 'trigger'); triggerEl.type = 'button'; triggerEl.id = id; root.appendChild(triggerEl);
  const swatchEl = document.createElement('span'); swatchEl.setAttribute('data-part', 'swatch'); triggerEl.appendChild(swatchEl);
  const valueEl = document.createElement('span'); valueEl.setAttribute('data-part', 'value-text'); triggerEl.appendChild(valueEl);
  const panelEl = document.createElement('div'); panelEl.setAttribute('data-part', 'panel'); root.appendChild(panelEl);
  const gradientEl = document.createElement('div'); gradientEl.setAttribute('data-part', 'gradient'); gradientEl.setAttribute('role', 'slider'); panelEl.appendChild(gradientEl);
  const hueEl = document.createElement('input'); hueEl.type = 'range'; hueEl.min = '0'; hueEl.max = '360'; hueEl.setAttribute('data-part', 'hue-slider'); hueEl.setAttribute('aria-label', 'Hue'); panelEl.appendChild(hueEl);
  const inputEl = document.createElement('input'); inputEl.type = 'text'; inputEl.setAttribute('data-part', 'input'); inputEl.setAttribute('aria-label', 'Color value'); panelEl.appendChild(inputEl);
  const presetsEl = document.createElement('div'); presetsEl.setAttribute('data-part', 'presets'); panelEl.appendChild(presetsEl);
  triggerEl.addEventListener('click', () => { open = !open; sync(); });
  inputEl.addEventListener('change', () => { currentProps.value = inputEl.value; currentProps.onChange?.(inputEl.value); sync(); });
  document.addEventListener('click', (e) => { if (open && !root.contains(e.target as Node)) { open = false; sync(); } });
  function sync() {
    const v = currentProps.value ?? '#000000';
    root.setAttribute('data-state', open ? 'open' : 'closed');
    swatchEl.style.backgroundColor = v; valueEl.textContent = v; inputEl.value = v;
    panelEl.style.display = open ? '' : 'none';
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    presetsEl.innerHTML = '';
    (currentProps.presets ?? []).forEach(c => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'preset'); btn.style.backgroundColor = c;
      btn.setAttribute('aria-label', c);
      btn.addEventListener('click', () => { currentProps.value = c; currentProps.onChange?.(c); sync(); });
      presetsEl.appendChild(btn);
    });
    presetsEl.style.display = (currentProps.presets?.length ?? 0) > 0 ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createColorPicker;
