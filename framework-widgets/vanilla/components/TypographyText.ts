// ============================================================
// TypographyText — Vanilla DOM Component
//
// Creates a <span> or <p> element with computed inline styles
// derived from a TextStyle configuration, TypeScale, and
// FontStack definitions via the COIF bridge.
// ============================================================

import type {
  TextStyle,
  TypeScale,
  FontStack,
} from '../../shared/types.js';

import { textStyleToCSS } from '../../shared/coif-bridge.js';

// --- Public Interface ---

export interface TypographyTextProps {
  /** The text content to render */
  text: string;
  /** Text style configuration (name, scale step, weight, etc.) */
  textStyle: TextStyle;
  /** The full type scale for size resolution */
  typeScale: TypeScale;
  /** Available font stacks */
  fontStacks: FontStack[];
  /** HTML tag to use: 'span' or 'p' */
  tag?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /** Optional CSS class name */
  className?: string;
  /** Optional color override */
  color?: string;
  /** Whether to truncate with ellipsis */
  truncate?: boolean;
  /** Max number of lines (uses -webkit-line-clamp) */
  maxLines?: number;
}

export interface TypographyTextOptions {
  target: HTMLElement;
  props: TypographyTextProps;
}

// --- Component ---

export class TypographyText {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];

  constructor(options: TypographyTextOptions) {
    const { target, props } = options;

    const tag = props.tag || 'span';
    this.el = document.createElement(tag);
    this.el.setAttribute('data-coif-typography', '');
    this.el.setAttribute('data-text-style', props.textStyle.name);

    this.applyStyles(props);
    this.el.textContent = props.text;

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<TypographyTextProps>): void {
    if (props.text !== undefined) {
      this.el.textContent = props.text;
    }

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (props.textStyle !== undefined) {
      this.el.setAttribute('data-text-style', props.textStyle.name);
    }

    // Re-apply styles if any style-related prop changed
    if (
      props.textStyle !== undefined ||
      props.typeScale !== undefined ||
      props.fontStacks !== undefined ||
      props.color !== undefined ||
      props.truncate !== undefined ||
      props.maxLines !== undefined
    ) {
      // We need the full props set to recompute styles; merge with defaults
      // The caller should pass all needed props for a full recalculation
      this.applyStyles(props as TypographyTextProps);
    }
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

  private applyStyles(props: Partial<TypographyTextProps>): void {
    // Reset inline styles
    this.el.removeAttribute('style');

    if (props.textStyle && props.typeScale && props.fontStacks) {
      const cssProps = textStyleToCSS(
        props.textStyle,
        props.typeScale,
        props.fontStacks,
      );

      for (const [property, value] of Object.entries(cssProps)) {
        this.el.style.setProperty(property, value);
      }
    }

    if (props.color) {
      this.el.style.color = props.color;
    }

    if (props.truncate) {
      this.el.style.overflow = 'hidden';
      this.el.style.textOverflow = 'ellipsis';
      this.el.style.whiteSpace = 'nowrap';
    }

    if (props.maxLines && props.maxLines > 1) {
      this.el.style.display = '-webkit-box';
      this.el.style.setProperty('-webkit-line-clamp', String(props.maxLines));
      this.el.style.setProperty('-webkit-box-orient', 'vertical');
      this.el.style.overflow = 'hidden';
    }

    if (props.className) {
      this.el.classList.add(props.className);
    }
  }
}
