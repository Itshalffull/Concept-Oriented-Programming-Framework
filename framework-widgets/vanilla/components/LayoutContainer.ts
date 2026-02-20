// ============================================================
// LayoutContainer — Vanilla DOM Component
//
// Creates a <div> with flex/grid styles computed from a
// LayoutConfig via the COIF bridge layout engine. Uses
// ResizeObserver to apply responsive overrides when the
// container crosses breakpoint thresholds.
// ============================================================

import type {
  LayoutConfig,
} from '../../shared/types.js';

import { layoutToCSS } from '../../shared/coif-bridge.js';

// --- Public Interface ---

export interface LayoutContainerProps {
  /** Layout configuration from the COIF Layout concept */
  layout: LayoutConfig;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline style overrides */
  style?: Record<string, string>;
}

export interface LayoutContainerOptions {
  target: HTMLElement;
  props: LayoutContainerProps;
}

// Default responsive breakpoints (width-based, applied to container)
const CONTAINER_BREAKPOINTS: Record<string, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// --- Component ---

export class LayoutContainer {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: LayoutContainerProps;
  private resizeObserver: ResizeObserver | null = null;
  private currentBreakpoint: string = 'xs';

  constructor(options: LayoutContainerOptions) {
    const { target, props } = options;
    this.props = props;

    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-layout', props.layout.kind);
    this.el.setAttribute('data-layout-name', props.layout.name);

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Apply base layout styles
    this.applyLayout(props.layout);

    // Apply any inline style overrides
    if (props.style) {
      for (const [k, v] of Object.entries(props.style)) {
        this.el.style.setProperty(k, v);
      }
    }

    // Set up ResizeObserver for responsive layout changes
    if (props.layout.responsive && typeof ResizeObserver !== 'undefined') {
      this.setupResizeObserver(props.layout);
    }

    // Recursively render child layout configs
    if (props.layout.children) {
      for (const child of props.layout.children) {
        new LayoutContainer({
          target: this.el,
          props: { layout: child },
        });
      }
    }

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<LayoutContainerProps>): void {
    if (props.layout !== undefined) {
      this.props.layout = props.layout;
      this.el.setAttribute('data-coif-layout', props.layout.kind);
      this.el.setAttribute('data-layout-name', props.layout.name);
      this.applyLayout(props.layout);

      // Re-setup responsive observer if needed
      this.teardownResizeObserver();
      if (props.layout.responsive && typeof ResizeObserver !== 'undefined') {
        this.setupResizeObserver(props.layout);
      }
    }

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (props.style !== undefined) {
      for (const [k, v] of Object.entries(props.style)) {
        this.el.style.setProperty(k, v);
      }
    }
  }

  destroy(): void {
    this.teardownResizeObserver();

    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private applyLayout(config: LayoutConfig): void {
    const css = layoutToCSS(config);
    for (const [property, value] of Object.entries(css)) {
      this.el.style.setProperty(property, value);
    }
  }

  private setupResizeObserver(config: LayoutConfig): void {
    if (!config.responsive) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const breakpoint = this.getContainerBreakpoint(width);

        if (breakpoint !== this.currentBreakpoint) {
          this.currentBreakpoint = breakpoint;
          this.el.setAttribute('data-container-breakpoint', breakpoint);

          // Re-apply base layout
          this.applyLayout(config);

          // Apply responsive overrides for the current breakpoint
          const override = config.responsive![breakpoint];
          if (override) {
            const mergedConfig: LayoutConfig = {
              ...config,
              ...override,
              name: config.name,
              kind: override.kind ?? config.kind,
            };
            const responsiveCSS = layoutToCSS(mergedConfig);
            for (const [property, value] of Object.entries(responsiveCSS)) {
              this.el.style.setProperty(property, value);
            }
          }
        }
      }
    });

    this.resizeObserver.observe(this.el);
    this.cleanup.push(() => this.teardownResizeObserver());
  }

  private teardownResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private getContainerBreakpoint(width: number): string {
    const sorted = Object.entries(CONTAINER_BREAKPOINTS)
      .sort(([, a], [, b]) => b - a);

    for (const [name, minWidth] of sorted) {
      if (width >= minWidth) return name;
    }
    return 'xs';
  }
}
