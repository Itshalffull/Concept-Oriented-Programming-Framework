// ============================================================
// ThemeSwitch — Vanilla DOM Component
//
// Creates button elements for switching between themes.
// Uses addEventListener for click handlers and updates
// a WritableSignal<ThemeConfig[]> when a theme is selected.
// ============================================================

import type {
  WritableSignal,
  ThemeConfig,
} from '../../shared/types.js';

// --- Public Interface ---

export interface ThemeSwitchProps {
  /** Available themes the user can switch between */
  themes: ThemeConfig[];
  /** Writable signal that holds the current theme list (with active flags) */
  themeSignal: WritableSignal<ThemeConfig[]>;
  /** Visual variant for the switch buttons */
  variant?: 'buttons' | 'dropdown';
  /** Optional CSS class name for the container */
  className?: string;
}

export interface ThemeSwitchOptions {
  target: HTMLElement;
  props: ThemeSwitchProps;
}

// --- Component ---

export class ThemeSwitch {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: ThemeSwitchProps;

  constructor(options: ThemeSwitchOptions) {
    const { target, props } = options;
    this.props = props;

    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-theme-switch', '');
    this.el.setAttribute('role', 'radiogroup');
    this.el.setAttribute('aria-label', 'Theme switcher');

    if (props.className) {
      this.el.classList.add(props.className);
    }

    this.render();

    // Subscribe to signal changes so we re-render when theme changes externally
    const unsub = props.themeSignal.subscribe((updatedThemes) => {
      this.props = { ...this.props, themes: updatedThemes };
      this.render();
    });
    this.cleanup.push(unsub);

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<ThemeSwitchProps>): void {
    if (props.themes !== undefined) {
      this.props.themes = props.themes;
    }
    if (props.variant !== undefined) {
      this.props.variant = props.variant;
    }
    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }
    this.render();
  }

  destroy(): void {
    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private render(): void {
    const { themes, variant } = this.props;

    // Clear previous content and listeners
    this.clearDynamicCleanup();

    if (variant === 'dropdown') {
      this.renderDropdown(themes);
    } else {
      this.renderButtons(themes);
    }
  }

  private renderButtons(themes: ThemeConfig[]): void {
    // Remove all children
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    for (const theme of themes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = theme.name;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', theme.active ? 'true' : 'false');
      btn.setAttribute('data-theme-name', theme.name);

      if (theme.active) {
        btn.classList.add('coif-theme-switch--active');
      }

      btn.style.cursor = 'pointer';

      const handler = () => this.selectTheme(theme.name);
      btn.addEventListener('click', handler);
      this.cleanup.push(() => btn.removeEventListener('click', handler));

      this.el.appendChild(btn);
    }
  }

  private renderDropdown(themes: ThemeConfig[]): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    const label = document.createElement('label');
    label.textContent = 'Theme';
    label.setAttribute('for', 'coif-theme-select');
    this.el.appendChild(label);

    const select = document.createElement('select');
    select.id = 'coif-theme-select';
    select.setAttribute('aria-label', 'Select theme');

    for (const theme of themes) {
      const option = document.createElement('option');
      option.value = theme.name;
      option.textContent = theme.name;
      option.selected = theme.active;
      select.appendChild(option);
    }

    const handler = () => this.selectTheme(select.value);
    select.addEventListener('change', handler);
    this.cleanup.push(() => select.removeEventListener('change', handler));

    this.el.appendChild(select);
  }

  private selectTheme(themeName: string): void {
    const updatedThemes = this.props.themes.map((t) => ({
      ...t,
      active: t.name === themeName,
    }));
    this.props.themeSignal.set(updatedThemes);
  }

  private clearDynamicCleanup(): void {
    // Keep only the initial signal subscription (first item)
    // Remove event listener cleanups from previous renders
    while (this.cleanup.length > 1) {
      const fn = this.cleanup.pop();
      if (fn) fn();
    }
  }
}
