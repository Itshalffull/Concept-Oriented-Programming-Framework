// ============================================================
// Clef Surface NativeScript Widget — ViewToggle
//
// Toggle control for switching between list and grid display
// modes. Renders a segmented button pair with icons and
// optional labels, highlighting the active view mode.
// ============================================================

import { StackLayout, GridLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Types ---------------

export type ViewMode = 'list' | 'grid';

export interface ViewToggleOption {
  mode: ViewMode;
  icon?: string;
  label?: string;
}

// --------------- Props ---------------

export interface ViewToggleProps {
  activeMode?: ViewMode;
  options?: ViewToggleOption[];
  activeColor?: string;
  activeTextColor?: string;
  inactiveColor?: string;
  inactiveTextColor?: string;
  borderRadius?: number;
  height?: number;
  showLabels?: boolean;
  onChange?: (mode: ViewMode) => void;
}

// --------------- Defaults ---------------

const DEFAULT_OPTIONS: ViewToggleOption[] = [
  { mode: 'list', icon: '\u2630', label: 'List' },
  { mode: 'grid', icon: '\u25A6', label: 'Grid' },
];

// --------------- Component ---------------

export function createViewToggle(props: ViewToggleProps = {}): GridLayout {
  const {
    activeMode = 'list',
    options = DEFAULT_OPTIONS,
    activeColor = '#1976D2',
    activeTextColor = '#FFFFFF',
    inactiveColor = '#F5F5F5',
    inactiveTextColor = '#757575',
    borderRadius = 8,
    height = 40,
    showLabels = true,
    onChange,
  } = props;

  const container = new GridLayout();
  container.className = 'clef-view-toggle';
  const colDefs = options.map(() => '*').join(', ');
  container.columns = colDefs;
  container.height = height;
  container.borderRadius = borderRadius;
  container.backgroundColor = inactiveColor as any;
  container.borderWidth = 1;
  container.borderColor = '#E0E0E0';

  options.forEach((option, index) => {
    const isActive = option.mode === activeMode;

    const btn = new GridLayout();
    btn.className = `clef-view-toggle-option ${isActive ? 'clef-view-toggle-active' : ''}`;
    btn.columns = option.icon && showLabels && option.label ? 'auto, auto' : '*';
    btn.borderRadius = borderRadius - 1;
    btn.margin = 2;
    btn.horizontalAlignment = 'stretch';
    btn.verticalAlignment = 'stretch';

    if (isActive) {
      btn.backgroundColor = activeColor as any;
      btn.androidElevation = 2;
    }

    const textColor = isActive ? activeTextColor : inactiveTextColor;

    let colIdx = 0;

    if (option.icon) {
      const iconLabel = new Label();
      iconLabel.text = option.icon;
      iconLabel.fontSize = 16;
      iconLabel.color = new Color(textColor);
      iconLabel.horizontalAlignment = 'center';
      iconLabel.verticalAlignment = 'middle';

      if (showLabels && option.label) {
        iconLabel.horizontalAlignment = 'right';
        iconLabel.marginRight = 4;
      }

      GridLayout.setColumn(iconLabel, colIdx);
      btn.addChild(iconLabel);

      if (showLabels && option.label) {
        colIdx = 1;
      }
    }

    if (showLabels && option.label) {
      const labelText = new Label();
      labelText.text = option.label;
      labelText.fontSize = 13;
      labelText.fontWeight = isActive ? 'bold' : 'normal';
      labelText.color = new Color(textColor);
      labelText.verticalAlignment = 'middle';

      if (option.icon) {
        labelText.horizontalAlignment = 'left';
        labelText.marginLeft = 4;
      } else {
        labelText.horizontalAlignment = 'center';
      }

      GridLayout.setColumn(labelText, colIdx);
      btn.addChild(labelText);
    }

    btn.on('tap', () => {
      if (option.mode !== activeMode) {
        onChange?.(option.mode);
      }
    });

    GridLayout.setColumn(btn, index);
    container.addChild(btn);
  });

  return container;
}

createViewToggle.displayName = 'ViewToggle';
export default createViewToggle;
