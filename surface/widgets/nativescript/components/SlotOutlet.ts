// ============================================================
// Clef Surface NativeScript Widget — SlotOutlet
//
// Named placeholder for NativeScript layout composition.
// Renders default content when no fill is provided, or renders
// the filled content. Supports a global slot registry for
// managing multiple slots.
// ============================================================

import {
  StackLayout,
  ContentView,
  Label,
  View,
  Color,
} from '@nativescript/core';

import type { SlotConfig } from '../../shared/types.js';

// --------------- Slot Registry ---------------

export interface SlotFill {
  name: string;
  content: View;
}

const _slotRegistry = new Map<string, { defaultContent?: View; fill?: View }>();

export function registerSlot(name: string, defaultContent?: View): void {
  const existing = _slotRegistry.get(name) || {};
  _slotRegistry.set(name, { ...existing, defaultContent });
}

export function fillSlot(name: string, content: View): void {
  const existing = _slotRegistry.get(name) || {};
  _slotRegistry.set(name, { ...existing, fill: content });
}

export function clearSlot(name: string): void {
  const existing = _slotRegistry.get(name);
  if (existing) {
    existing.fill = undefined;
    _slotRegistry.set(name, existing);
  }
}

export function isFilled(name: string): boolean {
  return _slotRegistry.get(name)?.fill !== undefined;
}

export function getFilledContent(name: string): View | undefined {
  return _slotRegistry.get(name)?.fill;
}

export function getSlotNames(): string[] {
  return Array.from(_slotRegistry.keys());
}

// --------------- SlotProvider ---------------

export interface SlotProviderProps {
  children?: View[];
}

export function createSlotProvider(props: SlotProviderProps = {}): StackLayout {
  const container = new StackLayout();
  container.className = 'clef-slot-provider';

  if (props.children) {
    for (const child of props.children) {
      container.addChild(child);
    }
  }

  return container;
}

// --------------- SlotOutlet Props ---------------

export interface SlotOutletProps {
  name: string;
  defaultContent?: View;
  filledContent?: View;
  scope?: Record<string, unknown>;
  debug?: boolean;
  width?: number;
  showBorder?: boolean;
  accentColor?: string;
}

// --------------- SlotOutlet Component ---------------

export function createSlotOutlet(props: SlotOutletProps): StackLayout {
  const {
    name,
    defaultContent,
    filledContent,
    scope,
    debug = false,
    width,
    showBorder = false,
    accentColor = '#a855f7',
  } = props;

  const container = new StackLayout();
  container.className = 'clef-slot-outlet';
  if (width) container.width = width;

  // Register slot with default content
  registerSlot(name, defaultContent);

  // Debug header
  if (debug) {
    const debugRow = new StackLayout();
    debugRow.orientation = 'horizontal';

    const slotLabel = new Label();
    slotLabel.text = `\u25C8 slot: ${name}`;
    slotLabel.color = new Color(accentColor);
    slotLabel.fontSize = 11;
    debugRow.addChild(slotLabel);

    const hasFill = filledContent !== undefined || isFilled(name);
    const statusLabel = new Label();
    statusLabel.text = ` [${hasFill ? 'filled' : 'default'}]`;
    statusLabel.color = new Color(hasFill ? '#06b6d4' : '#eab308');
    statusLabel.fontSize = 11;
    debugRow.addChild(statusLabel);

    if (scope) {
      const scopeLabel = new Label();
      scopeLabel.text = ` scope:{${Object.keys(scope).join(',')}}`;
      scopeLabel.opacity = 0.5;
      scopeLabel.fontSize = 11;
      debugRow.addChild(scopeLabel);
    }

    container.addChild(debugRow);
  }

  // Determine content
  const registryFill = getFilledContent(name);
  const content = filledContent ?? registryFill ?? defaultContent;

  if (showBorder) {
    const bordered = new StackLayout();
    bordered.borderWidth = 1;
    bordered.borderColor = new Color('#cccccc');
    bordered.padding = 4;
    if (width) bordered.width = width;

    const nameLabel = new Label();
    nameLabel.text = name;
    nameLabel.fontStyle = 'italic';
    nameLabel.opacity = 0.5;
    bordered.addChild(nameLabel);

    if (content) bordered.addChild(content);
    container.addChild(bordered);
  } else if (content) {
    container.addChild(content);
  }

  if (!content && debug) {
    const emptyLabel = new Label();
    emptyLabel.text = `(empty slot: ${name})`;
    emptyLabel.fontStyle = 'italic';
    emptyLabel.opacity = 0.5;
    container.addChild(emptyLabel);
  }

  return container;
}

// --------------- From Config ---------------

export function createSlotFromConfig(config: SlotConfig, filledContent?: View, debug = false): StackLayout {
  let defaultView: View | undefined;
  if (config.defaultContent) {
    const label = new Label();
    label.text = String(config.defaultContent);
    defaultView = label;
  }

  return createSlotOutlet({
    name: config.name,
    defaultContent: defaultView,
    filledContent,
    scope: config.scope,
    debug,
  });
}

export default createSlotOutlet;
