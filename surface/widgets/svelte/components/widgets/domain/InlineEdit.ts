import { uid } from '../shared/uid.js';

export interface InlineEditProps {
  value: string;
  editing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputType?: 'text' | 'number' | 'url' | 'email';
  selectOnFocus?: boolean;
  submitOnBlur?: boolean;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  children?: string | HTMLElement;
}

export interface InlineEditInstance {
  element: HTMLElement;
  update(props: Partial<InlineEditProps>): void;
  destroy(): void;
}

export function createInlineEdit(options: {
  target: HTMLElement;
  props: InlineEditProps;
}): InlineEditInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let isEditing = currentProps.editing ?? false;
  let draft = currentProps.value;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'inline-edit');
  root.setAttribute('data-part', 'root');
  root.id = id;

  const displayEl = document.createElement('span');
  displayEl.setAttribute('data-part', 'display');
  displayEl.setAttribute('tabindex', '0');
  displayEl.setAttribute('role', 'button');
  displayEl.setAttribute('aria-label', 'Click to edit');
  root.appendChild(displayEl);

  const inputEl = document.createElement('input');
  inputEl.setAttribute('data-part', 'input');
  root.appendChild(inputEl);

  const actionsEl = document.createElement('div');
  actionsEl.setAttribute('data-part', 'actions');
  root.appendChild(actionsEl);

  const submitBtn = document.createElement('button');
  submitBtn.setAttribute('type', 'button');
  submitBtn.setAttribute('aria-label', 'Save');
  submitBtn.textContent = '\u2713';
  actionsEl.appendChild(submitBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.setAttribute('type', 'button');
  cancelBtn.setAttribute('aria-label', 'Cancel');
  cancelBtn.textContent = '\u00d7';
  actionsEl.appendChild(cancelBtn);

  displayEl.addEventListener('click', () => {
    if (currentProps.disabled) return;
    isEditing = true;
    draft = currentProps.value;
    sync();
    inputEl.focus();
    if (currentProps.selectOnFocus) inputEl.select();
  });
  displayEl.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter') displayEl.click(); }) as EventListener);
  cleanups.push(() => {});

  inputEl.addEventListener('input', () => {
    draft = inputEl.value;
    currentProps.onChange?.(draft);
  });
  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'Enter') { isEditing = false; currentProps.onSubmit?.(draft); sync(); }
    if (e.key === 'Escape') { isEditing = false; draft = currentProps.value; currentProps.onCancel?.(); sync(); }
  }) as EventListener);
  inputEl.addEventListener('blur', () => {
    if (currentProps.submitOnBlur !== false) { isEditing = false; currentProps.onSubmit?.(draft); sync(); }
  });

  submitBtn.addEventListener('click', () => { isEditing = false; currentProps.onSubmit?.(draft); sync(); });
  cancelBtn.addEventListener('click', () => { isEditing = false; draft = currentProps.value; currentProps.onCancel?.(); sync(); });

  function sync() {
    root.setAttribute('data-state', isEditing ? 'editing' : 'display');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    displayEl.textContent = currentProps.value || currentProps.placeholder || '';
    displayEl.style.display = isEditing ? 'none' : '';
    inputEl.style.display = isEditing ? '' : 'none';
    inputEl.type = currentProps.inputType ?? 'text';
    inputEl.value = draft;
    inputEl.placeholder = currentProps.placeholder ?? '';
    actionsEl.style.display = isEditing ? '' : 'none';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); if (next.value !== undefined && !isEditing) draft = next.value; sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createInlineEdit;
