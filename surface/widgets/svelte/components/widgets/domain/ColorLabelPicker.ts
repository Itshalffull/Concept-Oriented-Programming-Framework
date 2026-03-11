import { uid } from '../shared/uid.js';

export interface ColorLabel {
  id: string;
  name: string;
  color: string;
}

export interface ColorLabelPickerProps {
  labels: ColorLabel[];
  selectedIds?: string[];
  multiple?: boolean;
  allowCreate?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onSelect?: (ids: string[]) => void;
  onCreate?: (name: string, color: string) => void;
  children?: string | HTMLElement;
}

export interface ColorLabelPickerInstance {
  element: HTMLElement;
  update(props: Partial<ColorLabelPickerProps>): void;
  destroy(): void;
}

export function createColorLabelPicker(options: {
  target: HTMLElement;
  props: ColorLabelPickerProps;
}): ColorLabelPickerInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'color-label-picker');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'listbox');
  root.setAttribute('aria-multiselectable', 'true');
  root.id = id;

  const triggerEl = document.createElement('button');
  triggerEl.setAttribute('data-part', 'trigger');
  triggerEl.setAttribute('type', 'button');
  triggerEl.setAttribute('aria-haspopup', 'listbox');
  root.appendChild(triggerEl);

  const selectedEl = document.createElement('div');
  selectedEl.setAttribute('data-part', 'selected-labels');
  triggerEl.appendChild(selectedEl);

  const dropdownEl = document.createElement('div');
  dropdownEl.setAttribute('data-part', 'dropdown');
  dropdownEl.setAttribute('role', 'listbox');
  root.appendChild(dropdownEl);

  triggerEl.addEventListener('click', () => { open = !open; sync(); });
  cleanups.push(() => {});

  function renderDropdown() {
    dropdownEl.innerHTML = '';
    const selected = new Set(currentProps.selectedIds ?? []);
    currentProps.labels.forEach(label => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'label-option');
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-selected', selected.has(label.id) ? 'true' : 'false');
      const swatch = document.createElement('span');
      swatch.setAttribute('data-part', 'color-swatch');
      swatch.style.backgroundColor = label.color;
      item.appendChild(swatch);
      const nameSpan = document.createElement('span');
      nameSpan.textContent = label.name;
      item.appendChild(nameSpan);
      item.addEventListener('click', () => {
        const ids = new Set(currentProps.selectedIds ?? []);
        if (ids.has(label.id)) ids.delete(label.id);
        else { if (!currentProps.multiple) ids.clear(); ids.add(label.id); }
        currentProps.onSelect?.([...ids]);
      });
      item.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') item.click(); });
      dropdownEl.appendChild(item);
    });
  }

  function sync() {
    root.setAttribute('data-state', open ? 'open' : 'closed');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    triggerEl.disabled = currentProps.disabled ?? false;
    triggerEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    dropdownEl.style.display = open ? '' : 'none';
    selectedEl.innerHTML = '';
    const selected = new Set(currentProps.selectedIds ?? []);
    currentProps.labels.filter(l => selected.has(l.id)).forEach(l => {
      const chip = document.createElement('span');
      chip.setAttribute('data-part', 'selected-chip');
      chip.style.backgroundColor = l.color;
      chip.textContent = l.name;
      selectedEl.appendChild(chip);
    });
    if (!selected.size) triggerEl.setAttribute('aria-label', currentProps.placeholder ?? 'Select labels');
    renderDropdown();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createColorLabelPicker;
