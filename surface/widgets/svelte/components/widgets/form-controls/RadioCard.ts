import { uid } from '../shared/uid.js';

export interface RadioCardProps {
  value?: string;
  options?: Array<{ label: string; value: string; description?: string; icon?: string; disabled?: boolean }>;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: string) => void;
  className?: string;
}

export interface RadioCardInstance {
  element: HTMLElement;
  update(props: Partial<RadioCardProps>): void;
  destroy(): void;
}

export function createRadioCard(options: {
  target: HTMLElement;
  props: RadioCardProps;
}): RadioCardInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'radio-card');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'radiogroup');

  const labelEl = document.createElement('div');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'list');
  root.appendChild(listEl);

  function selectValue(v: string) {
    currentProps.value = v;
    currentProps.onChange?.(v);
    sync();
  }

  function sync() {
    const opts = currentProps.options ?? [];
    root.setAttribute('data-orientation', currentProps.orientation ?? 'vertical');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    if (currentProps.label) root.setAttribute('aria-label', currentProps.label);

    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';

    listEl.innerHTML = '';
    cleanups.length = 0;
    opts.forEach((opt, i) => {
      const card = document.createElement('div');
      card.setAttribute('data-part', 'card');
      card.setAttribute('role', 'radio');
      card.setAttribute('tabindex', i === 0 || currentProps.value === opt.value ? '0' : '-1');
      card.setAttribute('aria-checked', currentProps.value === opt.value ? 'true' : 'false');
      card.setAttribute('data-selected', currentProps.value === opt.value ? 'true' : 'false');
      card.setAttribute('data-disabled', (opt.disabled || currentProps.disabled) ? 'true' : 'false');

      const title = document.createElement('div');
      title.setAttribute('data-part', 'card-title');
      title.textContent = opt.label;
      card.appendChild(title);

      if (opt.description) {
        const desc = document.createElement('div');
        desc.setAttribute('data-part', 'card-description');
        desc.textContent = opt.description;
        card.appendChild(desc);
      }

      const handler = () => { if (!opt.disabled && !currentProps.disabled) selectValue(opt.value); };
      card.addEventListener('click', handler);
      cleanups.push(() => card.removeEventListener('click', handler));

      const kd = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          const next = listEl.children[(i + 1) % opts.length] as HTMLElement;
          next?.focus();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = listEl.children[(i - 1 + opts.length) % opts.length] as HTMLElement;
          prev?.focus();
        }
      };
      card.addEventListener('keydown', kd as EventListener);
      cleanups.push(() => card.removeEventListener('keydown', kd as EventListener));

      listEl.appendChild(card);
    });

    if (currentProps.className) root.className = currentProps.className;
    else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createRadioCard;
