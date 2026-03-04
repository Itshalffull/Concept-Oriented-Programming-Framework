// ============================================================
// Clef Surface NativeScript Widget — HoverCard
//
// Card that appears on hover/long-press with rich content.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface HoverCardProps {
  open?: boolean;
  openDelay?: number;
  closeDelay?: number;
  onOpenChange?: (open: boolean) => void;
  trigger?: View;
  children?: View[];
}

export function createHoverCard(props: HoverCardProps): StackLayout {
  const {
    open = false, openDelay = 200, closeDelay = 300,
    onOpenChange, trigger, children = [],
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-hover-card';

  if (trigger) container.addChild(trigger);

  const content = new StackLayout();
  content.className = 'clef-hover-card-content';
  content.visibility = open ? 'visible' : 'collapsed';
  content.padding = '12';

  for (const child of children) content.addChild(child);

  container.addChild(content);
  return container;
}

export default createHoverCard;
