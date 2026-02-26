// ============================================================
// DesignTokenProvider — Vanilla DOM Component
//
// Creates a container <div> that applies resolved design tokens
// as CSS custom properties. Subscribes to a theme signal for
// live updates when the active theme changes.
// ============================================================

import type {
  Signal,
  ResolvedTheme,
  DesignTokenValue,
  ThemeConfig,
} from '../../shared/types.js';

import { resolveTheme } from '../../shared/surface-bridge.js';

// --- Public Interface ---

export interface DesignTokenProviderProps {
  /** Base design tokens to resolve */
  tokens: DesignTokenValue[];
  /** Theme configurations to layer on top */
  themes: ThemeConfig[];
  /** Optional reactive signal that emits updated themes */
  themeSignal?: Signal<ThemeConfig[]>;
  /** Optional CSS class name for the container */
  className?: string;
  /** Whether to scope tokens to this element or to :root */
  scoped?: boolean;
}

export interface DesignTokenProviderOptions {
  target: HTMLElement;
  props: DesignTokenProviderProps;
}

// --- Component ---

export class DesignTokenProvider {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private currentTokens: DesignTokenValue[];
  private currentThemes: ThemeConfig[];

  constructor(options: DesignTokenProviderOptions) {
    const { target, props } = options;

    this.currentTokens = props.tokens;
    this.currentThemes = props.themes;

    // Create the container element
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-token-provider', '');

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Apply initial token resolution
    this.applyTokens(props.tokens, props.themes, props.scoped);

    // Subscribe to theme signal for live updates
    if (props.themeSignal) {
      const unsub = props.themeSignal.subscribe((updatedThemes) => {
        this.currentThemes = updatedThemes;
        this.applyTokens(this.currentTokens, updatedThemes, props.scoped);
      });
      this.cleanup.push(unsub);
    }

    target.appendChild(this.el);
  }

  /** Returns the provider container element for appending children */
  getElement(): HTMLElement {
    return this.el;
  }

  /** Update props reactively */
  update(props: Partial<DesignTokenProviderProps>): void {
    let needsReapply = false;

    if (props.tokens !== undefined) {
      this.currentTokens = props.tokens;
      needsReapply = true;
    }

    if (props.themes !== undefined) {
      this.currentThemes = props.themes;
      needsReapply = true;
    }

    if (props.className !== undefined) {
      // Clear existing classes and set new one
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (needsReapply || props.scoped !== undefined) {
      this.applyTokens(this.currentTokens, this.currentThemes, props.scoped);
    }
  }

  /** Tear down the component and remove from DOM */
  destroy(): void {
    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;

    // Clear all custom properties we set
    this.clearTokens();

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private applyTokens(
    tokens: DesignTokenValue[],
    themes: ThemeConfig[],
    scoped?: boolean,
  ): void {
    const resolved: ResolvedTheme = resolveTheme(tokens, themes);
    const targetEl = scoped ? this.el : document.documentElement;

    // Set a data attribute with the resolved theme name
    this.el.setAttribute('data-theme', resolved.name);

    // Apply each resolved token as a CSS custom property
    for (const [name, value] of Object.entries(resolved.tokens)) {
      const cssVarName = `--${name.replace(/\./g, '-').replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      targetEl.style.setProperty(cssVarName, value);
    }
  }

  private clearTokens(): void {
    // Remove custom properties from the element
    const style = this.el.style;
    for (let i = style.length - 1; i >= 0; i--) {
      const prop = style[i];
      if (prop.startsWith('--')) {
        style.removeProperty(prop);
      }
    }
  }
}
