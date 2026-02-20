// ============================================================
// SlotOutlet — Vanilla DOM Component
//
// Creates a container for named slot content. Uses
// replaceChildren() for atomic content updates. Supports
// default (fallback) content when no slot content is provided.
// ============================================================

import type {
  SlotConfig,
} from '../../shared/types.js';

// --- Public Interface ---

export interface SlotOutletProps {
  /** Slot configuration from the COIF Slot concept */
  slot: SlotConfig;
  /** The content element(s) to render into this slot */
  content?: HTMLElement | HTMLElement[] | null;
  /** Default/fallback content if no content is provided */
  fallback?: HTMLElement | string;
  /** Scope data available to slotted content (set as data attributes) */
  scope?: Record<string, unknown>;
  /** Optional CSS class name */
  className?: string;
}

export interface SlotOutletOptions {
  target: HTMLElement;
  props: SlotOutletProps;
}

// --- Component ---

export class SlotOutlet {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: SlotOutletProps;
  private contentContainer: HTMLElement;

  constructor(options: SlotOutletOptions) {
    const { target, props } = options;
    this.props = props;

    // Outer slot wrapper
    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-slot', props.slot.name);
    this.el.setAttribute('data-slot-name', props.slot.name);

    if (props.slot.component) {
      this.el.setAttribute('data-slot-component', props.slot.component);
    }

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Inner content container (for replaceChildren)
    this.contentContainer = document.createElement('div');
    this.contentContainer.setAttribute('data-slot-content', '');
    this.el.appendChild(this.contentContainer);

    // Apply scope data
    if (props.scope) {
      this.applyScope(props.scope);
    }

    // Render initial content or fallback
    this.renderContent(props.content, props.fallback);

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  /** Get the inner content container for direct manipulation */
  getContentContainer(): HTMLElement {
    return this.contentContainer;
  }

  /** Replace slot content with new elements */
  setContent(content: HTMLElement | HTMLElement[] | null): void {
    this.props.content = content;
    this.renderContent(content, this.props.fallback);
  }

  update(props: Partial<SlotOutletProps>): void {
    if (props.slot !== undefined) {
      this.props.slot = props.slot;
      this.el.setAttribute('data-coif-slot', props.slot.name);
      this.el.setAttribute('data-slot-name', props.slot.name);
      if (props.slot.component) {
        this.el.setAttribute('data-slot-component', props.slot.component);
      }
    }

    if (props.scope !== undefined) {
      this.props.scope = props.scope;
      this.applyScope(props.scope);
    }

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (props.content !== undefined || props.fallback !== undefined) {
      if (props.content !== undefined) this.props.content = props.content;
      if (props.fallback !== undefined) this.props.fallback = props.fallback;
      this.renderContent(this.props.content, this.props.fallback);
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

  private renderContent(
    content: HTMLElement | HTMLElement[] | null | undefined,
    fallback?: HTMLElement | string,
  ): void {
    if (content) {
      // Use replaceChildren for atomic swap
      const children = Array.isArray(content) ? content : [content];
      this.contentContainer.replaceChildren(...children);
      this.el.setAttribute('data-slot-filled', 'true');
    } else if (fallback) {
      // Render fallback content
      if (typeof fallback === 'string') {
        const textNode = document.createElement('span');
        textNode.textContent = fallback;
        this.contentContainer.replaceChildren(textNode);
      } else {
        this.contentContainer.replaceChildren(fallback);
      }
      this.el.setAttribute('data-slot-filled', 'false');
    } else {
      // Empty slot
      this.contentContainer.replaceChildren();
      this.el.setAttribute('data-slot-filled', 'false');
    }
  }

  private applyScope(scope: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(scope)) {
      if (value !== undefined && value !== null) {
        this.el.setAttribute(
          `data-scope-${key}`,
          typeof value === 'object' ? JSON.stringify(value) : String(value),
        );
      } else {
        this.el.removeAttribute(`data-scope-${key}`);
      }
    }
  }
}
