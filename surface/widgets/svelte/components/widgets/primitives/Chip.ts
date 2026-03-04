import { uid } from '../shared/uid.js';

export interface ChipProps {
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  removable?: boolean;
  variant?: 'filled' | 'outlined' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  onSelect?: () => void;
  onRemove?: () => void;
  className?: string;
}

export interface ChipInstance {
  element: HTMLElement;
  update(props: Partial<ChipProps>): void;
  destroy(): void;
}

export function createChip(options: {
  target: HTMLElement;
  props: ChipProps;
}): ChipInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let state = 'idle';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'chip');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'option');
  root.setAttribute('tabindex', '0');

  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  const deleteBtn = document.createElement('button');
  deleteBtn.setAttribute('data-part', 'delete-trigger');
  deleteBtn.setAttribute('type', 'button');
  deleteBtn.setAttribute('aria-label', 'Remove');
  deleteBtn.textContent = '\u00d7';
  root.appendChild(deleteBtn);

  function handleClick() { if (currentProps.disabled) return; currentProps.onSelect?.(); }
  root.addEventListener('click', handleClick);
  cleanups.push(() => root.removeEventListener('click', handleClick));

  function handleKeydown(e: KeyboardEvent) {
    if (currentProps.disabled) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); currentProps.onSelect?.(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && currentProps.removable) { e.preventDefault(); currentProps.onRemove?.(); }
  }
  root.addEventListener('keydown', handleKeydown as EventListener);
  cleanups.push(() => root.removeEventListener('keydown', handleKeydown as EventListener));

  function handleDeleteClick(e: Event) { e.stopPropagation(); if (currentProps.disabled) return; currentProps.onRemove?.(); }
  deleteBtn.addEventListener('click', handleDeleteClick);
  cleanups.push(() => deleteBtn.removeEventListener('click', handleDeleteClick));

  function handlePointerDown() { if (!currentProps.disabled) { state = 'pressed'; sync(); } }
  function handlePointerUp() { state = 'idle'; sync(); }
  function handleMouseEnter() { if (!currentProps.disabled) { state = 'hovered'; sync(); } }
  function handleMouseLeave() { state = 'idle'; sync(); }
  root.addEventListener('pointerdown', handlePointerDown);
  root.addEventListener('pointerup', handlePointerUp);
  root.addEventListener('mouseenter', handleMouseEnter);
  root.addEventListener('mouseleave', handleMouseLeave);
  cleanups.push(
    () => root.removeEventListener('pointerdown', handlePointerDown),
    () => root.removeEventListener('pointerup', handlePointerUp),
    () => root.removeEventListener('mouseenter', handleMouseEnter),
    () => root.removeEventListener('mouseleave', handleMouseLeave),
  );

  function sync() {
    root.setAttribute('data-state', state);
    root.setAttribute('data-selected', currentProps.selected ? 'true' : 'false');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-variant', currentProps.variant ?? 'filled');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('aria-selected', currentProps.selected ? 'true' : 'false');
    root.setAttribute('aria-disabled', currentProps.disabled ? 'true' : 'false');
    if (currentProps.disabled) root.removeAttribute('tabindex'); else root.setAttribute('tabindex', '0');
    labelEl.textContent = currentProps.label ?? '';
    deleteBtn.style.display = currentProps.removable ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createChip;
