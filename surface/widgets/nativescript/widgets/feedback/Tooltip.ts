// ============================================================
// Clef Surface NativeScript Widget — Tooltip
//
// Lightweight tooltip overlay that displays a short text hint
// near a trigger element. Supports configurable placement
// (top, bottom, left, right), an optional arrow, custom
// colors, and imperative show/hide/toggle helpers attached
// to the returned view.
// ============================================================

import { StackLayout, Label, Color, ContentView } from '@nativescript/core';

// --------------- Types ---------------

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

// --------------- Props ---------------

export interface TooltipProps {
  text: string;
  placement?: TooltipPlacement;
  visible?: boolean;
  showArrow?: boolean;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  fontSize?: number;
  maxWidth?: number;
  padding?: number;
  delay?: number;
  onShow?: () => void;
  onHide?: () => void;
}

// --------------- Component ---------------

export function createTooltip(props: TooltipProps = { text: '' }): StackLayout {
  const {
    text,
    placement = 'top',
    visible = false,
    showArrow = true,
    backgroundColor = '#616161',
    textColor = '#FFFFFF',
    borderRadius = 6,
    fontSize = 12,
    maxWidth = 220,
    padding = 8,
    delay = 0,
    onShow,
    onHide,
  } = props;

  const wrapper = new StackLayout();
  wrapper.className = `clef-tooltip clef-tooltip-${placement}`;
  wrapper.horizontalAlignment = 'center';
  wrapper.visibility = visible ? 'visible' : 'collapse';

  // Helper to build the arrow indicator
  function buildArrow(): ContentView {
    const arrow = new ContentView();
    arrow.className = 'clef-tooltip-arrow';
    arrow.width = 8;
    arrow.height = 8;
    arrow.backgroundColor = backgroundColor as any;
    arrow.rotate = 45;
    arrow.horizontalAlignment = 'center';
    return arrow;
  }

  // --- Arrow before body (for bottom/right placements) ---
  if (showArrow && (placement === 'bottom' || placement === 'right')) {
    const arrow = buildArrow();
    if (placement === 'bottom') {
      arrow.marginBottom = -4;
    } else {
      arrow.marginRight = -4;
    }
    wrapper.addChild(arrow);
  }

  // --- Tooltip body ---
  const body = new StackLayout();
  body.className = 'clef-tooltip-body';
  body.backgroundColor = backgroundColor as any;
  body.borderRadius = borderRadius;
  body.padding = padding;
  body.maxWidth = maxWidth;

  const label = new Label();
  label.text = text;
  label.className = 'clef-tooltip-text';
  label.fontSize = fontSize;
  label.color = new Color(textColor);
  label.textWrap = true;
  label.textAlignment = 'center';
  body.addChild(label);

  wrapper.addChild(body);

  // --- Arrow after body (for top/left placements) ---
  if (showArrow && (placement === 'top' || placement === 'left')) {
    const arrow = buildArrow();
    if (placement === 'top') {
      arrow.marginTop = -4;
    } else {
      arrow.marginLeft = -4;
    }
    wrapper.addChild(arrow);
  }

  // --- Imperative show/hide/toggle ---
  let delayTimer: ReturnType<typeof setTimeout> | undefined;

  (wrapper as any).show = () => {
    if (delay > 0) {
      delayTimer = setTimeout(() => {
        wrapper.visibility = 'visible';
        if (onShow) onShow();
      }, delay);
    } else {
      wrapper.visibility = 'visible';
      if (onShow) onShow();
    }
  };

  (wrapper as any).hide = () => {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = undefined;
    }
    wrapper.visibility = 'collapse';
    if (onHide) onHide();
  };

  (wrapper as any).toggle = () => {
    if (wrapper.visibility === 'visible') {
      (wrapper as any).hide();
    } else {
      (wrapper as any).show();
    }
  };

  // --- Update text at runtime ---
  (wrapper as any).updateText = (newText: string) => {
    label.text = newText;
  };

  return wrapper;
}

createTooltip.displayName = 'Tooltip';
export default createTooltip;
