// ============================================================
// Clef Surface NativeScript Widget — Disclosure
//
// Single collapsible section with trigger and content.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface DisclosureProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  title?: string;
  onOpenChange?: (open: boolean) => void;
  children?: View[];
}

export function createDisclosure(props: DisclosureProps): StackLayout {
  const { open: openProp, defaultOpen = false, disabled = false, title = '', onOpenChange, children = [] } = props;
  let isOpen = openProp ?? defaultOpen;
  const container = new StackLayout();
  container.className = 'clef-widget-disclosure';

  const trigger = new Button();
  trigger.text = `${isOpen ? '\u25BC' : '\u25B6'} ${title}`;
  trigger.isEnabled = !disabled;
  trigger.accessibilityRole = 'button';
  trigger.accessibilityState = { expanded: isOpen };
  trigger.on('tap', () => {
    if (disabled) return;
    isOpen = !isOpen;
    onOpenChange?.(isOpen);
  });
  container.addChild(trigger);

  const content = new StackLayout();
  content.visibility = isOpen ? 'visible' : 'collapsed';
  content.padding = '8 16';
  for (const child of children) content.addChild(child);
  container.addChild(content);

  return container;
}

export default createDisclosure;
