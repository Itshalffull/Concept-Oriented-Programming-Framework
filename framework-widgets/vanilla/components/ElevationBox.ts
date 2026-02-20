// ============================================================
// ElevationBox — Vanilla DOM Component
//
// Creates a <div> with box-shadow style derived from an
// ElevationLevel (0-5). Supports both preset levels and
// custom ShadowLayer arrays via the COIF bridge.
// ============================================================

import type {
  ElevationLevel,
  ShadowLayer,
} from '../../shared/types.js';

import {
  elevationToCSS,
  shadowLayersToCSS,
} from '../../shared/coif-bridge.js';

// --- Public Interface ---

export interface ElevationBoxProps {
  /** Elevation level (0-5) for preset shadow */
  level?: ElevationLevel;
  /** Custom shadow layers (overrides level if provided) */
  layers?: ShadowLayer[];
  /** Background color of the box */
  backgroundColor?: string;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Padding in pixels or CSS string */
  padding?: string | number;
  /** Whether to animate shadow transitions */
  animate?: boolean;
  /** Optional CSS class name */
  className?: string;
}

export interface ElevationBoxOptions {
  target: HTMLElement;
  props: ElevationBoxProps;
}

// --- Component ---

export class ElevationBox {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: ElevationBoxProps;

  constructor(options: ElevationBoxOptions) {
    const { target, props } = options;
    this.props = props;

    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-elevation', '');

    this.applyStyles(props);

    if (props.className) {
      this.el.classList.add(props.className);
    }

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<ElevationBoxProps>): void {
    if (props.level !== undefined) this.props.level = props.level;
    if (props.layers !== undefined) this.props.layers = props.layers;
    if (props.backgroundColor !== undefined) this.props.backgroundColor = props.backgroundColor;
    if (props.borderRadius !== undefined) this.props.borderRadius = props.borderRadius;
    if (props.padding !== undefined) this.props.padding = props.padding;
    if (props.animate !== undefined) this.props.animate = props.animate;

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    this.applyStyles(this.props);
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

  private applyStyles(props: ElevationBoxProps): void {
    // Compute box-shadow
    let shadow: string;
    if (props.layers && props.layers.length > 0) {
      shadow = shadowLayersToCSS(props.layers);
    } else {
      const level: ElevationLevel = props.level ?? 0;
      shadow = elevationToCSS(level);
    }
    this.el.style.boxShadow = shadow;

    // Store the level as a data attribute for styling hooks
    if (props.level !== undefined) {
      this.el.setAttribute('data-elevation', String(props.level));
    }

    // Background color
    this.el.style.backgroundColor = props.backgroundColor ?? '#ffffff';

    // Border radius
    if (props.borderRadius !== undefined) {
      this.el.style.borderRadius = `${props.borderRadius}px`;
    }

    // Padding
    if (props.padding !== undefined) {
      this.el.style.padding =
        typeof props.padding === 'number' ? `${props.padding}px` : props.padding;
    }

    // Animate shadow transitions
    if (props.animate) {
      this.el.style.transition = 'box-shadow 200ms ease';
    } else {
      this.el.style.transition = '';
    }
  }
}
