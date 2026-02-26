// ============================================================
// ElevationBox — Svelte-compatible Clef Surface component
//
// Container with elevation-based box-shadow. Maps Clef Surface
// ElevationLevel (0-5) to CSS box-shadow values. Supports
// custom ShadowLayer overrides and smooth transition between
// elevation levels.
// ============================================================

import type {
  ElevationLevel,
  ShadowLayer,
} from '../../shared/types.js';

import {
  elevationToCSS,
  shadowLayersToCSS,
} from '../../shared/surface-bridge.js';

// --- Component types ---

export interface ElevationBoxProps {
  level: ElevationLevel;
  customShadow?: ShadowLayer[];
  tag?: keyof HTMLElementTagNameMap;
  transition?: boolean;
  borderRadius?: string;
  className?: string;
  'on:click'?: (event: MouseEvent) => void;
  'on:mouseenter'?: (event: MouseEvent) => void;
  'on:mouseleave'?: (event: MouseEvent) => void;
}

export interface ElevationBoxInstance {
  update(props: Partial<ElevationBoxProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
}

export interface ElevationBoxOptions {
  target: HTMLElement;
  props: ElevationBoxProps;
}

// --- Component factory ---

export function createElevationBox(
  options: ElevationBoxOptions,
): ElevationBoxInstance {
  const { target } = options;
  let {
    level,
    customShadow,
    tag = 'div',
    transition = true,
    borderRadius = '4px',
    className,
  } = options.props;

  let onClick = options.props['on:click'];
  let onMouseEnter = options.props['on:mouseenter'];
  let onMouseLeave = options.props['on:mouseleave'];

  // Create the element
  let element = document.createElement(tag);
  element.setAttribute('data-surface-elevation', '');
  element.setAttribute('data-level', String(level));
  if (className) element.className = className;
  target.appendChild(element);

  // Derived shadow — mirrors $derived rune
  function computeShadow(): string {
    if (customShadow && customShadow.length > 0) {
      return shadowLayersToCSS(customShadow);
    }
    return elevationToCSS(level);
  }

  function applyStyles(): void {
    const shadow = computeShadow();
    element.style.boxShadow = shadow;
    element.style.borderRadius = borderRadius;
    element.setAttribute('data-level', String(level));

    if (transition) {
      element.style.transition = 'box-shadow 0.2s ease';
    } else {
      element.style.transition = '';
    }
  }

  // Event binding — on:event directive pattern
  let eventCleanups: Array<() => void> = [];

  function bindEvents(): void {
    for (const cleanup of eventCleanups) cleanup();
    eventCleanups = [];

    if (onClick) {
      element.addEventListener('click', onClick);
      const handler = onClick;
      eventCleanups.push(() => element.removeEventListener('click', handler));
    }
    if (onMouseEnter) {
      element.addEventListener('mouseenter', onMouseEnter);
      const handler = onMouseEnter;
      eventCleanups.push(() => element.removeEventListener('mouseenter', handler));
    }
    if (onMouseLeave) {
      element.addEventListener('mouseleave', onMouseLeave);
      const handler = onMouseLeave;
      eventCleanups.push(() => element.removeEventListener('mouseleave', handler));
    }
  }

  // Initial render
  applyStyles();
  bindEvents();

  return {
    get element() { return element; },

    update(newProps: Partial<ElevationBoxProps>): void {
      let needsStyleUpdate = false;
      let needsEventRebind = false;

      if (newProps.level !== undefined) { level = newProps.level; needsStyleUpdate = true; }
      if (newProps.customShadow !== undefined) { customShadow = newProps.customShadow; needsStyleUpdate = true; }
      if (newProps.transition !== undefined) { transition = newProps.transition; needsStyleUpdate = true; }
      if (newProps.borderRadius !== undefined) { borderRadius = newProps.borderRadius; needsStyleUpdate = true; }
      if (newProps.className !== undefined) {
        className = newProps.className;
        element.className = className ?? '';
      }

      if (newProps['on:click'] !== undefined) { onClick = newProps['on:click']; needsEventRebind = true; }
      if (newProps['on:mouseenter'] !== undefined) { onMouseEnter = newProps['on:mouseenter']; needsEventRebind = true; }
      if (newProps['on:mouseleave'] !== undefined) { onMouseLeave = newProps['on:mouseleave']; needsEventRebind = true; }

      // Handle tag change
      if (newProps.tag !== undefined && newProps.tag !== tag) {
        tag = newProps.tag;
        const newElement = document.createElement(tag);
        newElement.setAttribute('data-surface-elevation', '');
        if (className) newElement.className = className;
        // Migrate children
        while (element.firstChild) {
          newElement.appendChild(element.firstChild);
        }
        element.replaceWith(newElement);
        element = newElement;
        needsStyleUpdate = true;
        needsEventRebind = true;
      }

      if (needsEventRebind) bindEvents();
      if (needsStyleUpdate) applyStyles();
    },

    destroy(): void {
      for (const cleanup of eventCleanups) cleanup();
      element.remove();
    },
  };
}
