// ============================================================
// Clef Surface NativeScript Widget — FloatingToolbar
//
// Floating action toolbar for NativeScript. Renders an
// absolutely-positioned row of icon/label action buttons
// that hovers above content, typically anchored to a screen
// edge with configurable position and elevation.
// ============================================================

import {
  StackLayout,
  GridLayout,
  FlexboxLayout,
  Label,
  Button,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface FloatingToolbarAction {
  id: string;
  label?: string;
  icon?: string;
  onTap?: () => void;
  disabled?: boolean;
}

export type FloatingToolbarPosition = 'bottom' | 'top' | 'left' | 'right';

// --------------- Props ---------------

export interface FloatingToolbarProps {
  actions?: FloatingToolbarAction[];
  position?: FloatingToolbarPosition;
  backgroundColor?: string;
  textColor?: string;
  disabledColor?: string;
  borderColor?: string;
  borderRadius?: number;
  elevation?: number;
  padding?: number;
  gap?: number;
  margin?: number;
}

// --------------- Component ---------------

export function createFloatingToolbar(props: FloatingToolbarProps = {}): StackLayout {
  const {
    actions = [],
    position = 'bottom',
    backgroundColor = '#FFFFFF',
    textColor = '#111827',
    disabledColor = '#D1D5DB',
    borderColor = '#E5E7EB',
    borderRadius = 16,
    elevation = 8,
    padding = 8,
    gap = 4,
    margin = 16,
  } = props;

  // Outer wrapper for positioning
  const wrapper = new StackLayout();
  wrapper.className = `clef-floating-toolbar clef-floating-toolbar-${position}`;

  if (position === 'bottom') {
    wrapper.verticalAlignment = 'bottom';
    wrapper.horizontalAlignment = 'center';
    wrapper.marginBottom = margin;
  } else if (position === 'top') {
    wrapper.verticalAlignment = 'top';
    wrapper.horizontalAlignment = 'center';
    wrapper.marginTop = margin;
  } else if (position === 'left') {
    wrapper.verticalAlignment = 'middle';
    wrapper.horizontalAlignment = 'left';
    wrapper.marginLeft = margin;
  } else {
    wrapper.verticalAlignment = 'middle';
    wrapper.horizontalAlignment = 'right';
    wrapper.marginRight = margin;
  }

  // Toolbar container
  const toolbar = new FlexboxLayout();
  toolbar.className = 'clef-floating-toolbar-bar';
  toolbar.flexDirection = (position === 'left' || position === 'right') ? 'column' : 'row';
  toolbar.alignItems = 'center';
  toolbar.backgroundColor = new Color(backgroundColor);
  toolbar.borderRadius = borderRadius;
  toolbar.borderWidth = 1;
  toolbar.borderColor = new Color(borderColor);
  toolbar.padding = padding;
  toolbar.androidElevation = elevation;

  actions.forEach((action, index) => {
    const actionButton = new StackLayout();
    actionButton.className = 'clef-floating-toolbar-action';
    actionButton.padding = 8;
    actionButton.borderRadius = borderRadius - 4;
    actionButton.horizontalAlignment = 'center';
    actionButton.isUserInteractionEnabled = !action.disabled;
    actionButton.opacity = action.disabled ? 0.4 : 1;

    if (index > 0) {
      if (position === 'left' || position === 'right') {
        actionButton.marginTop = gap;
      } else {
        actionButton.marginLeft = gap;
      }
    }

    if (action.icon) {
      const iconLabel = new Label();
      iconLabel.text = action.icon;
      iconLabel.fontSize = 18;
      iconLabel.color = new Color(action.disabled ? disabledColor : textColor);
      iconLabel.horizontalAlignment = 'center';
      actionButton.addChild(iconLabel);
    }

    if (action.label) {
      const labelView = new Label();
      labelView.text = action.label;
      labelView.fontSize = 11;
      labelView.color = new Color(action.disabled ? disabledColor : textColor);
      labelView.horizontalAlignment = 'center';
      actionButton.addChild(labelView);
    }

    if (action.onTap && !action.disabled) {
      actionButton.on('tap', action.onTap);
    }

    toolbar.addChild(actionButton);
  });

  wrapper.addChild(toolbar);
  return wrapper;
}

createFloatingToolbar.displayName = 'FloatingToolbar';
export default createFloatingToolbar;
