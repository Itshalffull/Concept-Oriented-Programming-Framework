// ============================================================
// SlotOutlet — Solid.js Component
//
// Dynamic content insertion point. Manages named slots where
// content can be projected, replaced, or cleared reactively.
// Uses Solid's fine-grained reactivity to update only the
// affected slot when content changes.
// ============================================================

import type {
  SlotConfig,
} from '../../shared/types.js';

import { createSignal as coifCreateSignal } from '../../shared/coif-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = coifCreateSignal<T>(initial);
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

// --- Slot content type ---

export type SlotContent = HTMLElement | string | null;

export type SlotRenderFn = (scope: Record<string, unknown>) => HTMLElement;

// --- Component Props ---

export interface SlotOutletProps {
  config: SlotConfig;
  content?: SlotContent;
  renderFn?: SlotRenderFn;
  fallback?: SlotContent;
  class?: string;
}

// --- Component Result ---

export interface SlotOutletResult {
  element: HTMLElement;
  dispose: () => void;
  setContent: (content: SlotContent) => void;
  clearContent: () => void;
  getContent: () => SlotContent;
  slotName: string;
}

// --- Component ---

export function SlotOutlet(props: SlotOutletProps): SlotOutletResult {
  const [content, setContent] = solidCreateSignal<SlotContent>(props.content ?? null);

  // Create the slot container
  const slot = document.createElement('div');
  slot.setAttribute('data-coif-widget', 'slot-outlet');
  slot.setAttribute('data-slot-name', props.config.name);
  slot.setAttribute('data-slot-component', props.config.component);
  slot.setAttribute('role', 'presentation');

  if (props.class) {
    slot.setAttribute('class', props.class);
  }

  // Helper: resolve content to a DOM node
  function resolveContent(raw: SlotContent): HTMLElement | null {
    if (raw === null || raw === undefined) {
      return null;
    }
    if (typeof raw === 'string') {
      const textEl = document.createElement('span');
      textEl.textContent = raw;
      return textEl;
    }
    return raw;
  }

  // Helper: render default content from config
  function renderDefault(): HTMLElement | null {
    // If a renderFn is provided, invoke it with scope
    if (props.renderFn && props.config.scope) {
      return props.renderFn(props.config.scope);
    }

    // If defaultContent is specified in the config
    if (props.config.defaultContent !== undefined) {
      if (typeof props.config.defaultContent === 'string') {
        const textEl = document.createElement('span');
        textEl.textContent = props.config.defaultContent;
        textEl.setAttribute('data-slot-default', 'true');
        return textEl;
      }
      if (props.config.defaultContent instanceof HTMLElement) {
        return props.config.defaultContent as HTMLElement;
      }
    }

    // Use fallback prop
    return resolveContent(props.fallback ?? null);
  }

  // Reactive effect: update slot content
  const disposeEffect = solidCreateEffect([content as () => unknown], () => {
    // Clear current children
    while (slot.firstChild) {
      slot.removeChild(slot.firstChild);
    }

    const currentContent = content();
    const resolved = resolveContent(currentContent);

    if (resolved) {
      slot.appendChild(resolved);
      slot.setAttribute('data-slot-filled', 'true');
      slot.removeAttribute('data-slot-empty');
    } else {
      // Try default/fallback
      const defaultContent = renderDefault();
      if (defaultContent) {
        slot.appendChild(defaultContent);
        slot.setAttribute('data-slot-filled', 'fallback');
        slot.removeAttribute('data-slot-empty');
      } else {
        slot.setAttribute('data-slot-empty', 'true');
        slot.removeAttribute('data-slot-filled');
      }
    }

    // Dispatch slot content change event
    slot.dispatchEvent(
      new CustomEvent('coif:slot-change', {
        bubbles: true,
        detail: {
          slotName: props.config.name,
          filled: !!resolved,
          component: props.config.component,
        },
      })
    );
  });

  function clearContent() {
    setContent(null);
  }

  function dispose() {
    disposeEffect();
    slot.remove();
  }

  return {
    element: slot,
    dispose,
    setContent,
    clearContent,
    getContent: content,
    slotName: props.config.name,
  };
}
