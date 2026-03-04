// ============================================================
// Clef Surface NativeScript Widget — Tooltip
//
// Small informational popup triggered on hover/focus.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface TooltipProps {
  content?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  trigger?: View;
}

export function createTooltip(props: TooltipProps): StackLayout {
  const { content = '', placement = 'top', delay = 0, disabled = false, trigger } = props;
  const container = new StackLayout();
  container.className = `clef-widget-tooltip clef-placement-${placement}`;

  if (trigger) container.addChild(trigger);

  const tip = new StackLayout();
  tip.className = 'clef-tooltip-content';
  tip.visibility = 'collapsed';
  tip.padding = '4 8';

  const tipLabel = new Label();
  tipLabel.text = content;
  tipLabel.fontSize = 12;
  tip.addChild(tipLabel);

  container.addChild(tip);
  return container;
}

export default createTooltip;
