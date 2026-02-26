// ============================================================
// TypographyText — Svelte-compatible Clef Surface component
//
// Renders text with a named style. Applies computed font styles
// derived from TypeScale, FontStack, and TextStyle definitions
// using the Clef Surface typography concept.
// ============================================================

import type {
  TextStyle,
  TypeScale,
  FontStack,
} from '../../shared/types.js';

import { textStyleToCSS } from '../../shared/surface-bridge.js';

// --- Component types ---

export interface TypographyTextProps {
  text: string;
  style: TextStyle;
  scale: TypeScale;
  fontStacks: FontStack[];
  tag?: keyof HTMLElementTagNameMap;
  className?: string;
  'on:click'?: (event: MouseEvent) => void;
}

export interface TypographyTextInstance {
  update(props: Partial<TypographyTextProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
}

export interface TypographyTextOptions {
  target: HTMLElement;
  props: TypographyTextProps;
}

// --- Component factory ---

export function createTypographyText(
  options: TypographyTextOptions,
): TypographyTextInstance {
  const { target } = options;
  let {
    text,
    style,
    scale,
    fontStacks,
    tag = 'span',
    className,
  } = options.props;
  let onClick = options.props['on:click'];

  // Create the text element
  let element = document.createElement(tag);
  element.setAttribute('data-surface-typography', '');
  element.setAttribute('data-style-name', style.name);
  if (className) element.className = className;
  target.appendChild(element);

  // Derived styles — mirrors Svelte $derived rune
  function computeAndApply(): void {
    const cssProps = textStyleToCSS(style, scale, fontStacks);
    for (const [prop, value] of Object.entries(cssProps)) {
      element.style.setProperty(prop, value);
    }
    element.textContent = text;
    element.setAttribute('data-style-name', style.name);
  }

  // Bind event — on:click directive pattern
  let clickCleanup: (() => void) | null = null;

  function bindClick(): void {
    if (clickCleanup) clickCleanup();
    if (onClick) {
      element.addEventListener('click', onClick);
      clickCleanup = () => {
        element.removeEventListener('click', onClick!);
      };
    }
  }

  // Initial render
  computeAndApply();
  bindClick();

  return {
    get element() { return element; },

    update(newProps: Partial<TypographyTextProps>): void {
      let needsRecompute = false;

      if (newProps.text !== undefined) { text = newProps.text; needsRecompute = true; }
      if (newProps.style !== undefined) { style = newProps.style; needsRecompute = true; }
      if (newProps.scale !== undefined) { scale = newProps.scale; needsRecompute = true; }
      if (newProps.fontStacks !== undefined) { fontStacks = newProps.fontStacks; needsRecompute = true; }
      if (newProps.className !== undefined) {
        className = newProps.className;
        element.className = className ?? '';
      }
      if (newProps['on:click'] !== undefined) {
        onClick = newProps['on:click'];
        bindClick();
      }

      // Handle tag change — requires element replacement
      if (newProps.tag !== undefined && newProps.tag !== tag) {
        tag = newProps.tag;
        const newElement = document.createElement(tag);
        newElement.setAttribute('data-surface-typography', '');
        if (className) newElement.className = className;
        element.replaceWith(newElement);
        element = newElement;
        bindClick();
        needsRecompute = true;
      }

      if (needsRecompute) {
        computeAndApply();
      }
    },

    destroy(): void {
      if (clickCleanup) clickCleanup();
      element.remove();
    },
  };
}
