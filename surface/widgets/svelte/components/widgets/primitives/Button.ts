import { uid } from '../shared/uid.js';

export interface ButtonProps {
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  iconPosition?: 'start' | 'end';
  label?: string;
  icon?: string;
  onClick?: () => void;
  children?: string;
  className?: string;
}

export interface ButtonInstance {
  element: HTMLElement;
  update(props: Partial<ButtonProps>): void;
  destroy(): void;
}

export function createButton(options: {
  target: HTMLElement;
  props: ButtonProps;
}): ButtonInstance {
  const { target } = options;
  let currentProps = { ...options.props };
  let interactionState: 'idle' | 'hovered' | 'focused' | 'pressed' = 'idle';
  const cleanups: (() => void)[] = [];

  const root = document.createElement('button');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'button');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'button');

  const spinnerEl = document.createElement('span');
  spinnerEl.setAttribute('data-part', 'spinner');
  spinnerEl.setAttribute('role', 'progressbar');
  spinnerEl.setAttribute('aria-label', 'Loading');

  const iconEl = document.createElement('span');
  iconEl.setAttribute('data-part', 'icon');
  iconEl.setAttribute('aria-hidden', 'true');

  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');

  root.appendChild(spinnerEl);
  root.appendChild(iconEl);
  root.appendChild(labelEl);

  function handleClick() {
    if (currentProps.disabled || currentProps.loading) return;
    currentProps.onClick?.();
  }

  function handleMouseEnter() {
    if (currentProps.disabled || currentProps.loading) return;
    interactionState = 'hovered';
    sync();
  }

  function handleMouseLeave() {
    if (currentProps.disabled || currentProps.loading) return;
    interactionState = 'idle';
    sync();
  }

  function handleFocus() {
    if (currentProps.disabled || currentProps.loading) return;
    interactionState = 'focused';
    sync();
  }

  function handleBlur() {
    if (currentProps.disabled || currentProps.loading) return;
    interactionState = 'idle';
    sync();
  }

  function handlePointerDown() {
    if (currentProps.disabled || currentProps.loading) return;
    interactionState = 'pressed';
    sync();
  }

  function handlePointerUp() {
    if (currentProps.disabled || currentProps.loading) return;
    interactionState = 'hovered';
    sync();
  }

  root.addEventListener('click', handleClick);
  root.addEventListener('mouseenter', handleMouseEnter);
  root.addEventListener('mouseleave', handleMouseLeave);
  root.addEventListener('focus', handleFocus);
  root.addEventListener('blur', handleBlur);
  root.addEventListener('pointerdown', handlePointerDown);
  root.addEventListener('pointerup', handlePointerUp);

  cleanups.push(() => {
    root.removeEventListener('click', handleClick);
    root.removeEventListener('mouseenter', handleMouseEnter);
    root.removeEventListener('mouseleave', handleMouseLeave);
    root.removeEventListener('focus', handleFocus);
    root.removeEventListener('blur', handleBlur);
    root.removeEventListener('pointerdown', handlePointerDown);
    root.removeEventListener('pointerup', handlePointerUp);
  });

  function sync() {
    const dataState = currentProps.loading
      ? 'loading'
      : currentProps.disabled
        ? 'disabled'
        : interactionState;

    root.setAttribute('type', currentProps.type ?? 'button');
    root.setAttribute('data-variant', currentProps.variant ?? 'filled');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-state', dataState);
    root.setAttribute('aria-disabled', String(!!currentProps.disabled || !!currentProps.loading));
    root.setAttribute('aria-busy', String(!!currentProps.loading));
    root.setAttribute('tabindex', currentProps.disabled ? '-1' : '0');

    if (currentProps.disabled || currentProps.loading) {
      root.setAttribute('disabled', '');
    } else {
      root.removeAttribute('disabled');
    }

    if (currentProps.className) root.className = currentProps.className;
    else root.className = '';

    // Spinner
    spinnerEl.style.display = currentProps.loading ? '' : 'none';
    spinnerEl.setAttribute('aria-hidden', currentProps.loading ? 'false' : 'true');
    spinnerEl.setAttribute('data-visible', String(!!currentProps.loading));

    // Icon
    iconEl.setAttribute('data-position', currentProps.iconPosition ?? 'start');
    if (currentProps.icon) {
      iconEl.style.display = '';
      iconEl.textContent = currentProps.icon;
    } else {
      iconEl.style.display = 'none';
    }

    // Label
    labelEl.textContent = currentProps.children ?? currentProps.label ?? '';
    labelEl.setAttribute('data-size', currentProps.size ?? 'md');
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) {
      Object.assign(currentProps, next);
      if (next.loading !== undefined) {
        interactionState = 'idle';
      }
      sync();
    },
    destroy() {
      cleanups.forEach(fn => fn());
      root.remove();
    },
  };
}

export default createButton;
