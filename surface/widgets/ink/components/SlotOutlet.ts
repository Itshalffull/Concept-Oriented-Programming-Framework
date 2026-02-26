// ============================================================
// Clef Surface Ink Widget — SlotOutlet
//
// Named placeholder in terminal layout. Renders default content
// when no fill is provided, or renders the filled content when
// a slot is populated. Supports scoped data passing to slot
// consumers and fallback rendering.
// ============================================================

import type { SlotConfig } from '../../shared/types.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_ITALIC = '\x1b[3m';
const ANSI_YELLOW_FG = '\x1b[33m';
const ANSI_MAGENTA_FG = '\x1b[35m';
const ANSI_CYAN_FG = '\x1b[36m';

// --- Border Characters ---

const BORDER = {
  topLeft: '\u250c', topRight: '\u2510',
  bottomLeft: '\u2514', bottomRight: '\u2518',
  horizontal: '\u2500', vertical: '\u2502',
  dotHorizontal: '\u2504', dotVertical: '\u2506',
};

// --- SlotOutlet Props ---

export interface SlotOutletProps {
  /** Name of the slot. */
  name: string;
  /** Default content to render when slot is not filled. */
  defaultContent?: (TerminalNode | string)[];
  /** Filled content (provided by parent). */
  filledContent?: (TerminalNode | string)[];
  /** Scoped data passed to slot consumers. */
  scope?: Record<string, unknown>;
  /** Whether to show slot debug information (name, state). */
  debug?: boolean;
  /** Width constraint for the slot area. */
  width?: number;
  /** Whether to render a border around the slot region. */
  showBorder?: boolean;
  /** Accent color for debug info (hex). */
  accentColor?: string;
}

/**
 * Creates a SlotOutlet terminal node.
 *
 * Renders either the filled content (if provided) or the
 * default content. In debug mode, shows slot boundaries
 * and state information.
 */
export function createSlotOutlet(props: SlotOutletProps): TerminalNode {
  const {
    name,
    defaultContent,
    filledContent,
    scope,
    debug = false,
    width,
    showBorder = false,
    accentColor,
  } = props;

  const isFilled = filledContent !== undefined && filledContent.length > 0;
  const content = isFilled ? filledContent : (defaultContent || []);
  const accentAnsi = accentColor ? hexToAnsiFg(accentColor) : ANSI_MAGENTA_FG;

  const children: (TerminalNode | string)[] = [];

  // Debug: show slot header
  if (debug) {
    const status = isFilled ? `${ANSI_CYAN_FG}filled` : `${ANSI_YELLOW_FG}default`;
    const scopeInfo = scope
      ? ` ${ANSI_DIM}scope:{${Object.keys(scope).join(',')}}${ANSI_RESET}`
      : '';
    children.push({
      type: 'text',
      props: { role: 'slot-debug' },
      children: [
        `${accentAnsi}${ANSI_DIM}\u25c8 slot:${ANSI_RESET}${accentAnsi}${name}${ANSI_RESET} ${status}${ANSI_RESET}${scopeInfo}`,
      ],
    });
  }

  // Show border around slot region
  if (showBorder && width) {
    const innerWidth = width - 4;
    const slotLabel = ` ${name} `;
    const leftFill = 1;
    const rightFill = Math.max(1, innerWidth - slotLabel.length - leftFill);

    const topLine = `${ANSI_DIM}${BORDER.topLeft}${BORDER.dotHorizontal.repeat(leftFill)}${ANSI_RESET}${accentAnsi}${ANSI_ITALIC}${slotLabel}${ANSI_RESET}${ANSI_DIM}${BORDER.dotHorizontal.repeat(rightFill)}${BORDER.topRight}${ANSI_RESET}`;
    children.push({ type: 'text', props: {}, children: [topLine] });

    // Content wrapped in border verticals
    for (const child of content) {
      children.push({
        type: 'box',
        props: {
          role: 'slot-content-line',
          prefixStr: `${ANSI_DIM}${BORDER.dotVertical}${ANSI_RESET} `,
          suffixStr: ` ${ANSI_DIM}${BORDER.dotVertical}${ANSI_RESET}`,
        },
        children: [child],
      });
    }

    const bottomLine = `${ANSI_DIM}${BORDER.bottomLeft}${BORDER.dotHorizontal.repeat(innerWidth + 2)}${BORDER.bottomRight}${ANSI_RESET}`;
    children.push({ type: 'text', props: {}, children: [bottomLine] });
  } else {
    // No border: render content directly
    children.push(...content);
  }

  // Show empty slot placeholder when no content at all
  if (content.length === 0) {
    const placeholder = debug
      ? `${ANSI_DIM}${ANSI_ITALIC}(empty slot: ${name})${ANSI_RESET}`
      : '';
    if (placeholder) {
      children.push({
        type: 'text',
        props: { role: 'slot-placeholder' },
        children: [placeholder],
      });
    }
  }

  return {
    type: 'box',
    props: {
      role: 'slot-outlet',
      slotName: name,
      isFilled,
      scope: scope || {},
      flexDirection: 'column',
      width,
    },
    children,
  };
}

// --- Slot Registry (manages multiple slots) ---

export interface SlotRegistryEntry {
  name: string;
  defaultContent?: (TerminalNode | string)[];
  filledContent?: (TerminalNode | string)[];
  scope?: Record<string, unknown>;
}

export class SlotRegistry {
  private slots: Map<string, SlotRegistryEntry> = new Map();
  private listeners: Set<(slotName: string) => void> = new Set();

  /** Register a new slot with default content. */
  registerSlot(
    name: string,
    defaultContent?: (TerminalNode | string)[],
    scope?: Record<string, unknown>,
  ): void {
    this.slots.set(name, { name, defaultContent, scope });
  }

  /** Fill a slot with content. */
  fillSlot(name: string, content: (TerminalNode | string)[]): void {
    const entry = this.slots.get(name);
    if (entry) {
      entry.filledContent = content;
      this.notifyChange(name);
    }
  }

  /** Clear a slot's filled content (revert to default). */
  clearSlot(name: string): void {
    const entry = this.slots.get(name);
    if (entry) {
      entry.filledContent = undefined;
      this.notifyChange(name);
    }
  }

  /** Update scope data for a slot. */
  updateScope(name: string, scope: Record<string, unknown>): void {
    const entry = this.slots.get(name);
    if (entry) {
      entry.scope = { ...entry.scope, ...scope };
      this.notifyChange(name);
    }
  }

  /** Check if a slot is filled. */
  isFilled(name: string): boolean {
    const entry = this.slots.get(name);
    return !!(entry?.filledContent && entry.filledContent.length > 0);
  }

  /** Get all registered slot names. */
  getSlotNames(): string[] {
    return Array.from(this.slots.keys());
  }

  /** Render a specific slot as a TerminalNode. */
  renderSlot(name: string, options?: Partial<SlotOutletProps>): TerminalNode {
    const entry = this.slots.get(name);
    if (!entry) {
      return createSlotOutlet({ name, debug: true, ...options });
    }

    return createSlotOutlet({
      name: entry.name,
      defaultContent: entry.defaultContent,
      filledContent: entry.filledContent,
      scope: entry.scope,
      ...options,
    });
  }

  /** Subscribe to slot changes. */
  onChange(listener: (slotName: string) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Remove all slots. */
  destroy(): void {
    this.slots.clear();
    this.listeners.clear();
  }

  private notifyChange(slotName: string): void {
    for (const listener of this.listeners) {
      listener(slotName);
    }
  }
}

// --- SlotOutlet from Clef Surface SlotConfig ---

/**
 * Create a SlotOutlet from a Clef Surface SlotConfig.
 */
export function createSlotFromConfig(
  config: SlotConfig,
  filledContent?: (TerminalNode | string)[],
  debug = false,
): TerminalNode {
  const defaultContent: (TerminalNode | string)[] = [];

  if (config.defaultContent) {
    // Render default content as string representation
    defaultContent.push({
      type: 'text',
      props: {},
      children: [String(config.defaultContent)],
    });
  }

  return createSlotOutlet({
    name: config.name,
    defaultContent,
    filledContent,
    scope: config.scope,
    debug,
  });
}
