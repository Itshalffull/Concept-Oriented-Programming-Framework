// ============================================================
// LayoutContainer — Svelte-compatible COIF component
//
// Flex/grid layout container driven by COIF LayoutConfig.
// Supports all layout kinds (stack, grid, split, overlay, flow,
// sidebar, center) and responsive overrides keyed by breakpoint.
// Uses the COIF layout engine to compute CSS properties.
// ============================================================

import type {
  LayoutConfig,
  Breakpoint,
  WritableSignal,
} from '../../shared/types.js';

import {
  layoutToCSS,
  createSignal,
} from '../../shared/coif-bridge.js';

// --- Component types ---

export interface LayoutContainerProps {
  config: LayoutConfig;
  currentBreakpoint?: Breakpoint;
  tag?: keyof HTMLElementTagNameMap;
  className?: string;
}

export interface LayoutContainerInstance {
  update(props: Partial<LayoutContainerProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
}

export interface LayoutContainerOptions {
  target: HTMLElement;
  props: LayoutContainerProps;
}

// --- Component factory ---

export function createLayoutContainer(
  options: LayoutContainerOptions,
): LayoutContainerInstance {
  const { target } = options;
  let {
    config,
    currentBreakpoint = 'md',
    tag = 'div',
    className,
  } = options.props;

  // Create container element
  let element = document.createElement(tag);
  element.setAttribute('data-coif-layout', '');
  element.setAttribute('data-layout-kind', config.kind);
  element.setAttribute('data-layout-name', config.name);
  if (className) element.className = className;
  target.appendChild(element);

  // Reactive breakpoint — mirrors $state rune
  const breakpoint$ = createSignal<Breakpoint>(currentBreakpoint);

  // Derived effective config — mirrors $derived rune
  function getEffectiveConfig(): LayoutConfig {
    const bp = breakpoint$.get();
    if (config.responsive && config.responsive[bp]) {
      return { ...config, ...config.responsive[bp] };
    }
    return config;
  }

  function applyLayout(): void {
    const effective = getEffectiveConfig();
    const cssProps = layoutToCSS(effective);

    // Clear previous layout styles
    element.style.cssText = '';

    // Apply computed layout CSS
    for (const [prop, value] of Object.entries(cssProps)) {
      element.style.setProperty(prop, value);
    }

    // Update data attributes
    element.setAttribute('data-layout-kind', effective.kind);
    element.setAttribute('data-layout-name', config.name);
    element.setAttribute('data-breakpoint', breakpoint$.get());
  }

  // Subscribe to breakpoint changes
  const unsubscribe = breakpoint$.subscribe(() => {
    applyLayout();
  });

  // Initial render
  applyLayout();

  // Recursively create child layout containers if present
  let childInstances: LayoutContainerInstance[] = [];

  function renderChildren(): void {
    // Destroy previous children
    for (const child of childInstances) child.destroy();
    childInstances = [];

    if (!config.children) return;

    for (const childConfig of config.children) {
      const childInstance = createLayoutContainer({
        target: element,
        props: {
          config: childConfig,
          currentBreakpoint: breakpoint$.get(),
        },
      });
      childInstances.push(childInstance);
    }
  }

  renderChildren();

  return {
    get element() { return element; },

    update(newProps: Partial<LayoutContainerProps>): void {
      let needsLayout = false;
      let needsChildRender = false;

      if (newProps.config !== undefined) {
        const configChanged = newProps.config !== config;
        config = newProps.config;
        needsLayout = true;
        if (configChanged) needsChildRender = true;
      }

      if (newProps.currentBreakpoint !== undefined) {
        currentBreakpoint = newProps.currentBreakpoint;
        (breakpoint$ as WritableSignal<Breakpoint>).set(currentBreakpoint);
        // Layout update is handled by subscription
        // Also update children
        for (const child of childInstances) {
          child.update({ currentBreakpoint });
        }
        return; // subscription handles applyLayout
      }

      if (newProps.className !== undefined) {
        className = newProps.className;
        element.className = className ?? '';
      }

      // Handle tag change
      if (newProps.tag !== undefined && newProps.tag !== tag) {
        tag = newProps.tag;
        const newElement = document.createElement(tag);
        newElement.setAttribute('data-coif-layout', '');
        if (className) newElement.className = className;
        while (element.firstChild) {
          newElement.appendChild(element.firstChild);
        }
        element.replaceWith(newElement);
        element = newElement;
        needsLayout = true;
      }

      if (needsLayout) applyLayout();
      if (needsChildRender) renderChildren();
    },

    destroy(): void {
      unsubscribe();
      for (const child of childInstances) child.destroy();
      element.remove();
    },
  };
}
