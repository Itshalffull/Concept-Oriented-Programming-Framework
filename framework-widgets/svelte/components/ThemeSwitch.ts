// ============================================================
// ThemeSwitch — Svelte-compatible COIF component
//
// Theme toggle UI that renders a button for each available theme.
// Activating a theme updates the parent DesignTokenProvider
// through a callback. Supports on:change event directive style.
// ============================================================

import type {
  ThemeConfig,
  WritableSignal,
} from '../../shared/types.js';

import { createSignal } from '../../shared/coif-bridge.js';

// --- Component types ---

export interface ThemeSwitchProps {
  themes: ThemeConfig[];
  activeTheme?: string;
  /** on:change handler — Svelte event directive pattern */
  'on:change'?: (event: { theme: ThemeConfig }) => void;
  className?: string;
}

export interface ThemeSwitchInstance {
  update(props: Partial<ThemeSwitchProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
}

export interface ThemeSwitchOptions {
  target: HTMLElement;
  props: ThemeSwitchProps;
}

// --- Component factory ---

export function createThemeSwitch(
  options: ThemeSwitchOptions,
): ThemeSwitchInstance {
  const { target } = options;
  let { themes, className } = options.props;
  let onChange = options.props['on:change'];

  // Reactive state — mirrors Svelte $state rune
  const activeTheme$ = createSignal<string>(
    options.props.activeTheme ?? themes.find(t => t.active)?.name ?? '',
  );

  // Create root container
  const container = document.createElement('div');
  container.setAttribute('data-coif-theme-switch', '');
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', 'Theme selector');
  if (className) container.className = className;
  target.appendChild(container);

  // Track button references for cleanup
  let buttonCleanups: Array<() => void> = [];

  function render(): void {
    // Clear existing buttons
    for (const cleanup of buttonCleanups) cleanup();
    buttonCleanups = [];
    container.innerHTML = '';

    const currentActive = activeTheme$.get();

    for (const theme of themes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(theme.name === currentActive));
      button.setAttribute('data-theme-name', theme.name);
      button.textContent = theme.name;

      if (theme.name === currentActive) {
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
      }

      // Style the button with minimal defaults
      button.style.cssText = [
        'cursor: pointer',
        'padding: 0.5em 1em',
        'border: 1px solid currentColor',
        'border-radius: 4px',
        'margin: 0 0.25em',
        'background: transparent',
        'color: inherit',
        'font: inherit',
        theme.name === currentActive ? 'font-weight: bold; opacity: 1' : 'opacity: 0.7',
      ].join('; ');

      const handleClick = () => {
        (activeTheme$ as WritableSignal<string>).set(theme.name);
        onChange?.({ theme });
        render();
      };

      button.addEventListener('click', handleClick);
      buttonCleanups.push(() => button.removeEventListener('click', handleClick));

      container.appendChild(button);
    }
  }

  // Initial render
  render();

  // Subscribe to external changes — mirrors $derived reactivity
  const unsubscribe = activeTheme$.subscribe(() => {
    // Re-render is handled inside click; external updates go through update()
  });

  return {
    element: container,

    update(newProps: Partial<ThemeSwitchProps>): void {
      if (newProps.themes !== undefined) themes = newProps.themes;
      if (newProps['on:change'] !== undefined) onChange = newProps['on:change'];
      if (newProps.className !== undefined) {
        className = newProps.className;
        container.className = className ?? '';
      }
      if (newProps.activeTheme !== undefined) {
        (activeTheme$ as WritableSignal<string>).set(newProps.activeTheme);
      }
      render();
    },

    destroy(): void {
      unsubscribe();
      for (const cleanup of buttonCleanups) cleanup();
      container.remove();
    },
  };
}
