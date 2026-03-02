// ============================================================
// Clef Surface NativeScript Widget — ViewSwitcher
//
// Toggle between different view modes (e.g. list, grid, table,
// kanban). Renders a segmented button bar where each mode is
// represented by a label and optional icon text. Highlights
// the active mode.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Button } from '@nativescript/core';

// --------------- Types ---------------

export interface ViewMode {
  id: string;
  label: string;
  icon?: string;
}

// --------------- Props ---------------

export interface ViewSwitcherProps {
  /** Available view modes. */
  modes?: ViewMode[];
  /** Currently active mode id. */
  activeMode?: string;
  /** Overall label shown before the switcher. */
  label?: string;
  /** Called when a mode is selected. */
  onChange?: (modeId: string) => void;
}

// --------------- Component ---------------

export function createViewSwitcher(props: ViewSwitcherProps = {}): StackLayout {
  const {
    modes = [
      { id: 'list', label: 'List', icon: '\u2630' },
      { id: 'grid', label: 'Grid', icon: '\u2593' },
    ],
    activeMode = modes[0]?.id ?? '',
    label = 'View',
    onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-view-switcher';
  container.padding = 8;

  // Wrapper with label
  const wrapper = new GridLayout();
  wrapper.columns = 'auto, *';

  if (label) {
    const labelText = new Label();
    labelText.text = label;
    labelText.fontSize = 13;
    labelText.opacity = 0.7;
    labelText.verticalAlignment = 'middle';
    labelText.marginRight = 8;
    GridLayout.setColumn(labelText, 0);
    wrapper.addChild(labelText);
  }

  // Button bar
  const buttonBar = new StackLayout();
  buttonBar.orientation = 'horizontal' as any;
  buttonBar.borderRadius = 6;
  buttonBar.borderWidth = 1;
  buttonBar.borderColor = '#E0E0E0';
  buttonBar.padding = 2;
  GridLayout.setColumn(buttonBar, 1);

  modes.forEach((mode, index) => {
    const isActive = mode.id === activeMode;

    const modeBtn = new StackLayout();
    modeBtn.orientation = 'horizontal' as any;
    modeBtn.padding = 6;
    modeBtn.borderRadius = 4;
    modeBtn.horizontalAlignment = 'center';
    modeBtn.verticalAlignment = 'middle';

    if (isActive) {
      modeBtn.backgroundColor = '#E3F2FD' as any;
    }

    if (mode.icon) {
      const iconLabel = new Label();
      iconLabel.text = mode.icon;
      iconLabel.fontSize = 12;
      iconLabel.verticalAlignment = 'middle';
      iconLabel.marginRight = 4;
      if (isActive) {
        iconLabel.fontWeight = 'bold';
      }
      modeBtn.addChild(iconLabel);
    }

    const nameLabel = new Label();
    nameLabel.text = mode.label;
    nameLabel.fontSize = 12;
    nameLabel.fontWeight = isActive ? 'bold' : 'normal';
    nameLabel.verticalAlignment = 'middle';
    nameLabel.color = isActive ? ('#1976D2' as any) : ('#666666' as any);
    modeBtn.addChild(nameLabel);

    if (onChange) {
      modeBtn.on('tap', () => onChange(mode.id));
    }

    buttonBar.addChild(modeBtn);

    // Separator between buttons
    if (index < modes.length - 1) {
      const sep = new Label();
      sep.text = '';
      sep.width = 1;
      sep.backgroundColor = '#E0E0E0' as any;
      sep.marginTop = 2;
      sep.marginBottom = 2;
      buttonBar.addChild(sep);
    }
  });

  wrapper.addChild(buttonBar);
  container.addChild(wrapper);
  return container;
}

createViewSwitcher.displayName = 'ViewSwitcher';
export default createViewSwitcher;
