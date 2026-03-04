// ============================================================
// Clef Surface NativeScript Widget — Popover
//
// Floating content panel anchored to a trigger element.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface PopoverProps {
  open?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  onOpenChange?: (open: boolean) => void;
  trigger?: View;
  title?: string;
  description?: string;
  children?: View[];
}

export function createPopover(props: PopoverProps): StackLayout {
  const {
    open = false, placement = 'bottom',
    onOpenChange, trigger, title, description, children = [],
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-popover clef-placement-${placement}`;

  if (trigger) container.addChild(trigger);

  const content = new StackLayout();
  content.className = 'clef-popover-content';
  content.visibility = open ? 'visible' : 'collapsed';
  content.padding = '12';

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    content.addChild(titleLabel);
  }

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    content.addChild(desc);
  }

  for (const child of children) content.addChild(child);

  container.addChild(content);
  return container;
}

export default createPopover;
