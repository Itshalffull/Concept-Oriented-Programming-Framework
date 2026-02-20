// ============================================================
// SlotOutlet — Svelte-compatible COIF component
//
// Named content slot with defaults. Mirrors Svelte's <slot>
// element with name and fallback content. Provides a mount point
// where external content can be injected, with a default fallback
// rendered when no content is provided. Supports scoped data
// passed to slotted content (like Svelte's let: directives).
// ============================================================

import type { SlotConfig } from '../../shared/types.js';

// --- Component types ---

export interface SlotOutletProps {
  config: SlotConfig;
  /**
   * Render function for slot content. When provided, replaces
   * the default content. Receives scope data (mirrors Svelte
   * let:binding on <slot>).
   */
  renderContent?: (scope: Record<string, unknown>, slotElement: HTMLElement) => void;
  /**
   * Render function for default/fallback content. Used when
   * renderContent is not provided (mirrors <slot>fallback</slot>).
   */
  renderDefault?: (slotElement: HTMLElement) => void;
  className?: string;
}

export interface SlotOutletInstance {
  update(props: Partial<SlotOutletProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
  /**
   * Set slot content imperatively (alternative to renderContent).
   */
  setContent(content: HTMLElement | string): void;
  /**
   * Clear slot back to default content.
   */
  clearContent(): void;
  /**
   * Update scope data, re-invoking renderContent if present.
   */
  updateScope(scope: Record<string, unknown>): void;
}

export interface SlotOutletOptions {
  target: HTMLElement;
  props: SlotOutletProps;
}

// --- Component factory ---

export function createSlotOutlet(
  options: SlotOutletOptions,
): SlotOutletInstance {
  const { target } = options;
  let { config, renderContent, renderDefault, className } = options.props;

  // Create slot container
  const slotElement = document.createElement('div');
  slotElement.setAttribute('data-coif-slot', '');
  slotElement.setAttribute('data-slot-name', config.name);
  if (className) slotElement.className = className;
  target.appendChild(slotElement);

  // Track whether custom content is active
  let hasCustomContent = false;
  let currentScope: Record<string, unknown> = { ...config.scope };

  function renderSlot(): void {
    slotElement.innerHTML = '';

    if (renderContent) {
      // Render provided content with scope — mirrors <slot let:data>
      hasCustomContent = true;
      renderContent(currentScope, slotElement);
    } else if (renderDefault) {
      // Render fallback/default — mirrors <slot>fallback</slot>
      hasCustomContent = false;
      renderDefault(slotElement);
    } else if (config.defaultContent !== undefined && config.defaultContent !== null) {
      // Use config-provided default content
      hasCustomContent = false;
      if (typeof config.defaultContent === 'string') {
        slotElement.textContent = config.defaultContent;
      } else if (config.defaultContent instanceof HTMLElement) {
        slotElement.appendChild(config.defaultContent as HTMLElement);
      } else {
        slotElement.textContent = String(config.defaultContent);
      }
    } else {
      // Empty slot — render a placeholder comment-like indicator
      hasCustomContent = false;
      slotElement.setAttribute('data-slot-empty', '');
    }

    // Update data attributes
    slotElement.setAttribute('data-slot-name', config.name);
    slotElement.setAttribute('data-has-content', String(hasCustomContent));
    if (config.component) {
      slotElement.setAttribute('data-slot-component', config.component);
    }
  }

  // Initial render
  renderSlot();

  return {
    element: slotElement,

    setContent(content: HTMLElement | string): void {
      slotElement.innerHTML = '';
      hasCustomContent = true;

      if (typeof content === 'string') {
        slotElement.textContent = content;
      } else {
        slotElement.appendChild(content);
      }

      slotElement.setAttribute('data-has-content', 'true');
      slotElement.removeAttribute('data-slot-empty');
    },

    clearContent(): void {
      hasCustomContent = false;
      renderContent = undefined;
      renderSlot();
    },

    updateScope(scope: Record<string, unknown>): void {
      currentScope = { ...currentScope, ...scope };
      if (renderContent) {
        // Re-render with updated scope
        slotElement.innerHTML = '';
        renderContent(currentScope, slotElement);
      }
    },

    update(newProps: Partial<SlotOutletProps>): void {
      if (newProps.config !== undefined) {
        config = newProps.config;
        currentScope = { ...config.scope };
      }
      if (newProps.renderContent !== undefined) renderContent = newProps.renderContent;
      if (newProps.renderDefault !== undefined) renderDefault = newProps.renderDefault;
      if (newProps.className !== undefined) {
        className = newProps.className;
        slotElement.className = className ?? '';
      }
      renderSlot();
    },

    destroy(): void {
      slotElement.remove();
    },
  };
}
