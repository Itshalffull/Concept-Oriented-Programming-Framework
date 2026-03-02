// ============================================================
// Clef Surface NativeScript Widget — Toolbar
//
// Action toolbar for NativeScript. Renders a horizontal bar
// of action buttons with optional icon, label, separator
// dividers, and overflow menu indicator. Supports primary
// and secondary action styling.
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

export interface ToolbarAction {
  id: string;
  label?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  dividerAfter?: boolean;
  onTap?: () => void;
}

// --------------- Props ---------------

export interface ToolbarProps {
  actions?: ToolbarAction[];
  alignment?: 'start' | 'center' | 'end' | 'space-between';
  backgroundColor?: string;
  primaryColor?: string;
  primaryTextColor?: string;
  secondaryColor?: string;
  ghostColor?: string;
  disabledColor?: string;
  dividerColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  gap?: number;
  height?: number;
}

// --------------- Component ---------------

export function createToolbar(props: ToolbarProps = {}): FlexboxLayout {
  const {
    actions = [],
    alignment = 'start',
    backgroundColor = '#FFFFFF',
    primaryColor = '#2563EB',
    primaryTextColor = '#FFFFFF',
    secondaryColor = '#F3F4F6',
    ghostColor = '#374151',
    disabledColor = '#D1D5DB',
    dividerColor = '#E5E7EB',
    borderColor = '#E5E7EB',
    borderRadius = 8,
    padding = 8,
    gap = 4,
    height = 48,
  } = props;

  const container = new FlexboxLayout();
  container.className = 'clef-toolbar';
  container.flexDirection = 'row';
  container.alignItems = 'center';
  container.height = height;
  container.backgroundColor = new Color(backgroundColor);
  container.borderBottomWidth = 1;
  container.borderColor = new Color(borderColor);
  container.padding = `0 ${padding}`;

  // Map alignment to flexbox justifyContent
  const justifyMap: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    'space-between': 'space-between',
  };
  container.justifyContent = justifyMap[alignment] || 'flex-start';

  actions.forEach((action, index) => {
    const variant = action.variant || 'ghost';
    const isDisabled = !!action.disabled;

    const actionView = new FlexboxLayout();
    actionView.className = `clef-toolbar-action clef-toolbar-action-${variant}`;
    actionView.flexDirection = 'row';
    actionView.alignItems = 'center';
    actionView.padding = '6 10';
    actionView.borderRadius = 6;
    actionView.marginRight = gap;
    actionView.isUserInteractionEnabled = !isDisabled;
    actionView.opacity = isDisabled ? 0.4 : 1;

    // Variant background
    if (variant === 'primary') {
      actionView.backgroundColor = new Color(isDisabled ? disabledColor : primaryColor);
    } else if (variant === 'secondary') {
      actionView.backgroundColor = new Color(secondaryColor);
      actionView.borderWidth = 1;
      actionView.borderColor = new Color(borderColor);
    } else {
      actionView.backgroundColor = new Color('transparent');
    }

    if (action.icon) {
      const iconLabel = new Label();
      iconLabel.text = action.icon;
      iconLabel.fontSize = 16;

      if (variant === 'primary') {
        iconLabel.color = new Color(primaryTextColor);
      } else if (isDisabled) {
        iconLabel.color = new Color(disabledColor);
      } else {
        iconLabel.color = new Color(ghostColor);
      }

      if (action.label) iconLabel.marginRight = 6;
      actionView.addChild(iconLabel);
    }

    if (action.label) {
      const labelView = new Label();
      labelView.text = action.label;
      labelView.fontSize = 13;
      labelView.fontWeight = variant === 'primary' ? 'bold' : 'normal';

      if (variant === 'primary') {
        labelView.color = new Color(primaryTextColor);
      } else if (isDisabled) {
        labelView.color = new Color(disabledColor);
      } else {
        labelView.color = new Color(ghostColor);
      }

      actionView.addChild(labelView);
    }

    if (action.onTap && !isDisabled) {
      actionView.on('tap', action.onTap);
    }

    container.addChild(actionView);

    // Divider after
    if (action.dividerAfter && index < actions.length - 1) {
      const divider = new StackLayout();
      divider.className = 'clef-toolbar-divider';
      divider.width = 1;
      divider.height = height * 0.6;
      divider.backgroundColor = new Color(dividerColor);
      divider.marginRight = gap;
      divider.verticalAlignment = 'middle';
      container.addChild(divider);
    }
  });

  return container;
}

createToolbar.displayName = 'Toolbar';
export default createToolbar;
