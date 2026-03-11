import { uid } from '../shared/uid.js';

export interface CronEditorProps {
  value?: string;
  mode?: 'simple' | 'advanced';
  presets?: { label: string; value: string }[];
  disabled?: boolean;
  readOnly?: boolean;
  showPreview?: boolean;
  maxOccurrences?: number;
  onChange?: (value: string) => void;
  children?: string | HTMLElement;
}

export interface CronEditorInstance {
  element: HTMLElement;
  update(props: Partial<CronEditorProps>): void;
  destroy(): void;
}

export function createCronEditor(options: {
  target: HTMLElement;
  props: CronEditorProps;
}): CronEditorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'cron-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Cron expression editor');
  root.id = id;

  const modeToggle = document.createElement('button');
  modeToggle.setAttribute('data-part', 'mode-toggle');
  modeToggle.setAttribute('type', 'button');
  root.appendChild(modeToggle);

  const simpleEl = document.createElement('div');
  simpleEl.setAttribute('data-part', 'simple-editor');
  root.appendChild(simpleEl);

  const advancedEl = document.createElement('div');
  advancedEl.setAttribute('data-part', 'advanced-editor');
  root.appendChild(advancedEl);

  const cronInput = document.createElement('input');
  cronInput.setAttribute('data-part', 'cron-input');
  cronInput.setAttribute('aria-label', 'Cron expression');
  advancedEl.appendChild(cronInput);

  const presetsEl = document.createElement('div');
  presetsEl.setAttribute('data-part', 'presets');
  presetsEl.setAttribute('role', 'list');
  root.appendChild(presetsEl);

  const previewEl = document.createElement('div');
  previewEl.setAttribute('data-part', 'preview');
  previewEl.setAttribute('aria-live', 'polite');
  root.appendChild(previewEl);

  modeToggle.addEventListener('click', () => {
    currentProps.mode = currentProps.mode === 'simple' ? 'advanced' : 'simple';
    sync();
  });
  cleanups.push(() => {});
  cronInput.addEventListener('input', () => currentProps.onChange?.(cronInput.value));

  function renderPresets() {
    presetsEl.innerHTML = '';
    (currentProps.presets ?? []).forEach(p => {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.setAttribute('role', 'listitem');
      btn.textContent = p.label;
      btn.addEventListener('click', () => currentProps.onChange?.(p.value));
      presetsEl.appendChild(btn);
    });
  }

  function sync() {
    const mode = currentProps.mode ?? 'simple';
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-mode', mode);
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    modeToggle.textContent = mode === 'simple' ? 'Advanced' : 'Simple';
    modeToggle.disabled = currentProps.disabled ?? false;
    simpleEl.style.display = mode === 'simple' ? '' : 'none';
    advancedEl.style.display = mode === 'advanced' ? '' : 'none';
    cronInput.value = currentProps.value ?? '';
    cronInput.disabled = currentProps.disabled || currentProps.readOnly || false;
    previewEl.style.display = currentProps.showPreview ? '' : 'none';
    previewEl.textContent = currentProps.value ? 'Expression: ' + currentProps.value : '';
    renderPresets();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createCronEditor;
