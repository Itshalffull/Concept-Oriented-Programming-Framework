// Clef Surface Widget — SolidJS Provider
// Imperative DOM, factory function returning { element, dispose }

import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  cleanup = fn();
  let lastValues = deps.map(d => d());
  const interval = setInterval(() => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      if (typeof cleanup === 'function') cleanup();
      cleanup = fn();
    }
  }, 16);
  return () => { clearInterval(interval); if (typeof cleanup === 'function') cleanup(); };
}

let _idCounter = 0;
function uid(): string { return 'solid-' + (++_idCounter); }


export interface ChipProps {
  label?: string;
  selected?: boolean;
  deletable?: boolean;
  disabled?: boolean;
  color?: string;
  value?: string;
  onSelect?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
  class?: string;
}

export interface ChipResult { element: HTMLElement; dispose: () => void; }

export function Chip(props: ChipProps): ChipResult {
  const {
    label = '', selected = false, deletable = false, disabled = false,
    color, onSelect, onDeselect, onDelete
  } = props;
  const [isSelected, setIsSelected] = solidCreateSignal(selected);
  const [removed, setRemoved] = solidCreateSignal(false);

  const root = document.createElement('div');
  root.setAttribute('role', 'option');
  root.setAttribute('aria-disabled', String(disabled));
  root.tabIndex = disabled ? -1 : 0;
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'chip');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-disabled', String(disabled));
  if (color) root.setAttribute('data-color', color);
  if (props.class) root.className = props.class;

  const labelSpan = document.createElement('span');
  labelSpan.setAttribute('data-part', 'label');
  labelSpan.textContent = label;
  root.appendChild(labelSpan);

  if (deletable) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.setAttribute('data-part', 'delete-button');
    delBtn.setAttribute('role', 'button');
    delBtn.setAttribute('aria-label', 'Remove');
    delBtn.tabIndex = -1;
    delBtn.setAttribute('data-visible', String(deletable));
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (disabled) return;
      setRemoved(true);
      onDelete?.();
    });
    root.appendChild(delBtn);
  }

  root.addEventListener('click', () => {
    if (disabled) return;
    if (isSelected()) { setIsSelected(false); onDeselect?.(); }
    else { setIsSelected(true); onSelect?.(); }
  });

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); root.click(); }
    if ((e.key === 'Backspace' || e.key === 'Delete') && deletable) {
      e.preventDefault(); setRemoved(true); onDelete?.();
    }
  });

  const dispose = solidCreateEffect([isSelected, removed], () => {
    if (removed()) { root.style.display = 'none'; return; }
    const sel = isSelected();
    root.setAttribute('data-state', sel ? 'selected' : 'idle');
    root.setAttribute('aria-selected', String(sel));
  });

  return { element: root, dispose };
}
export default Chip;
