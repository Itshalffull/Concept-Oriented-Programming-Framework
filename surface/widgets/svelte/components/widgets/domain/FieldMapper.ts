import { uid } from '../shared/uid.js';

export interface SourceField { key: string; label: string; type?: string; }
export interface TargetField { key: string; label: string; type?: string; required?: boolean; }
export interface FieldMapping { sourceKey: string; targetKey: string; transform?: string; }

export interface FieldMapperProps {
  sourceFields: SourceField[];
  targetFields: TargetField[];
  mappings?: FieldMapping[];
  disabled?: boolean;
  readOnly?: boolean;
  showPreview?: boolean;
  onChange?: (mappings: FieldMapping[]) => void;
  children?: string | HTMLElement;
}

export interface FieldMapperInstance {
  element: HTMLElement;
  update(props: Partial<FieldMapperProps>): void;
  destroy(): void;
}

export function createFieldMapper(options: {
  target: HTMLElement;
  props: FieldMapperProps;
}): FieldMapperInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'field-mapper');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Field mapper');
  root.id = id;

  const mappingsEl = document.createElement('div');
  mappingsEl.setAttribute('data-part', 'mappings');
  root.appendChild(mappingsEl);

  const addBtn = document.createElement('button');
  addBtn.setAttribute('data-part', 'add-mapping');
  addBtn.setAttribute('type', 'button');
  addBtn.textContent = '+ Add mapping';
  root.appendChild(addBtn);

  addBtn.addEventListener('click', () => {
    const mappings = [...(currentProps.mappings ?? [])];
    mappings.push({ sourceKey: currentProps.sourceFields[0]?.key ?? '', targetKey: currentProps.targetFields[0]?.key ?? '' });
    currentProps.onChange?.(mappings);
  });
  cleanups.push(() => {});

  function renderMappings() {
    mappingsEl.innerHTML = '';
    (currentProps.mappings ?? []).forEach((m, i) => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'mapping-row');
      row.setAttribute('role', 'group');

      const srcSel = document.createElement('select');
      srcSel.setAttribute('aria-label', 'Source field');
      currentProps.sourceFields.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.key; opt.textContent = f.label;
        if (f.key === m.sourceKey) opt.selected = true;
        srcSel.appendChild(opt);
      });
      row.appendChild(srcSel);

      const arrow = document.createElement('span');
      arrow.textContent = '\u2192';
      arrow.setAttribute('aria-hidden', 'true');
      row.appendChild(arrow);

      const tgtSel = document.createElement('select');
      tgtSel.setAttribute('aria-label', 'Target field');
      currentProps.targetFields.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.key; opt.textContent = f.label;
        if (f.key === m.targetKey) opt.selected = true;
        tgtSel.appendChild(opt);
      });
      row.appendChild(tgtSel);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove mapping');
      removeBtn.textContent = '\u00d7';
      row.appendChild(removeBtn);

      srcSel.addEventListener('change', () => { const ms = [...(currentProps.mappings ?? [])]; ms[i] = { ...ms[i], sourceKey: srcSel.value }; currentProps.onChange?.(ms); });
      tgtSel.addEventListener('change', () => { const ms = [...(currentProps.mappings ?? [])]; ms[i] = { ...ms[i], targetKey: tgtSel.value }; currentProps.onChange?.(ms); });
      removeBtn.addEventListener('click', () => { const ms = (currentProps.mappings ?? []).filter((_, j) => j !== i); currentProps.onChange?.(ms); });

      mappingsEl.appendChild(row);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    addBtn.disabled = currentProps.disabled || currentProps.readOnly || false;
    renderMappings();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createFieldMapper;
