// ============================================================
// ThemeSwitch — Solid.js Component
//
// Theme toggle with Solid's native event delegation (on:click).
// Cycles through available themes or toggles between light/dark.
// Uses fine-grained signals for reactive theme state display.
// ============================================================

import type {
  ThemeConfig,
} from '../../shared/types.js';

import { createSignal as surfaceCreateSignal } from '../../shared/surface-bridge.js';
import { getTokenContext } from './DesignTokenProvider.js';

// --- Solid-style reactive primitives ---

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

  return () => {
    clearInterval(interval);
    if (typeof cleanup === 'function') cleanup();
  };
}

// --- Component Props ---

export interface ThemeSwitchProps {
  themes: ThemeConfig[];
  initialIndex?: number;
  label?: string;
  class?: string;
  onThemeChange?: (theme: ThemeConfig) => void;
}

// --- Component Result ---

export interface ThemeSwitchResult {
  element: HTMLElement;
  dispose: () => void;
  currentTheme: () => ThemeConfig;
  currentIndex: () => number;
}

// --- Component ---

export function ThemeSwitch(props: ThemeSwitchProps): ThemeSwitchResult {
  const [activeIndex, setActiveIndex] = solidCreateSignal<number>(props.initialIndex ?? 0);
  const currentTheme = (): ThemeConfig => props.themes[activeIndex()] ?? props.themes[0];

  // Create the button element
  const button = document.createElement('button');
  button.setAttribute('type', 'button');
  button.setAttribute('role', 'switch');
  button.setAttribute('data-surface-widget', 'theme-switch');
  if (props.class) {
    button.setAttribute('class', props.class);
  }

  // Label span
  const labelSpan = document.createElement('span');
  labelSpan.setAttribute('class', 'surface-theme-switch__label');

  // Indicator span
  const indicatorSpan = document.createElement('span');
  indicatorSpan.setAttribute('class', 'surface-theme-switch__indicator');
  indicatorSpan.setAttribute('aria-hidden', 'true');

  button.appendChild(labelSpan);
  button.appendChild(indicatorSpan);

  // Native event delegation (Solid on:click pattern)
  button.addEventListener('click', () => {
    const nextIndex = (activeIndex() + 1) % props.themes.length;
    setActiveIndex(nextIndex);

    // Propagate to token context if available
    const ctx = getTokenContext(button);
    if (ctx) {
      const updatedThemes = props.themes.map((t, i) => ({
        ...t,
        active: i === nextIndex,
      }));
      ctx.updateThemes(updatedThemes);
    }

    // Callback
    if (props.onThemeChange) {
      props.onThemeChange(currentTheme());
    }

    // Dispatch native DOM event
    button.dispatchEvent(
      new CustomEvent('surface:theme-switch', {
        bubbles: true,
        detail: { theme: currentTheme().name, index: nextIndex },
      })
    );
  });

  // Keyboard support
  button.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      button.click();
    }
  });

  // Reactive effect: update DOM when active index changes
  const disposeEffect = solidCreateEffect([activeIndex], () => {
    const theme = currentTheme();
    const isLight = theme.name.toLowerCase().includes('light');
    const isDark = theme.name.toLowerCase().includes('dark');

    labelSpan.textContent = props.label ?? `Theme: ${theme.name}`;
    button.setAttribute('aria-checked', isDark ? 'true' : 'false');
    button.setAttribute('aria-label', `Switch theme. Current: ${theme.name}`);
    button.setAttribute('data-theme', theme.name);

    // Visual indicator
    indicatorSpan.textContent = isDark ? '\u25CF' : '\u25CB'; // filled vs hollow circle
  });

  function dispose() {
    disposeEffect();
    button.remove();
  }

  return {
    element: button,
    dispose,
    currentTheme,
    currentIndex: activeIndex,
  };
}
