// ============================================================
// Clef Surface NativeScript Widget — PreferenceMatrix
//
// Preference settings grid displaying categories as rows and
// preference options as toggleable switches. Supports grouped
// sections with descriptions and reset-to-default actions.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Switch, Button, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export interface PreferenceOption {
  id: string;
  label: string;
  description?: string;
  value: boolean;
  defaultValue?: boolean;
}

export interface PreferenceGroup {
  name: string;
  description?: string;
  options: PreferenceOption[];
}

// --------------- Props ---------------

export interface PreferenceMatrixProps {
  /** Grouped preference sections. */
  groups?: PreferenceGroup[];
  /** Whether options can be modified. */
  editable?: boolean;
  /** Called when a preference is toggled. */
  onToggle?: (groupName: string, optionId: string, value: boolean) => void;
  /** Called when a group is reset to defaults. */
  onResetGroup?: (groupName: string) => void;
}

// --------------- Component ---------------

export function createPreferenceMatrix(props: PreferenceMatrixProps = {}): StackLayout {
  const {
    groups = [],
    editable = true,
    onToggle,
    onResetGroup,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-preference-matrix';
  container.padding = 12;

  // Title
  const titleLabel = new Label();
  titleLabel.text = 'Preferences';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  titleLabel.marginBottom = 12;
  container.addChild(titleLabel);

  if (groups.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No preferences available.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    container.addChild(emptyLabel);
    return container;
  }

  const scrollView = new ScrollView();
  const list = new StackLayout();

  groups.forEach((group) => {
    const groupContainer = new StackLayout();
    groupContainer.marginBottom = 16;

    // Group header
    const groupHeader = new GridLayout();
    groupHeader.columns = '*, auto';
    groupHeader.marginBottom = 4;

    const groupName = new Label();
    groupName.text = group.name;
    groupName.fontWeight = 'bold';
    groupName.fontSize = 14;
    GridLayout.setColumn(groupName, 0);
    groupHeader.addChild(groupName);

    if (onResetGroup && editable) {
      const hasNonDefault = group.options.some(
        (o) => o.defaultValue !== undefined && o.value !== o.defaultValue,
      );
      if (hasNonDefault) {
        const resetBtn = new Button();
        resetBtn.text = 'Reset';
        resetBtn.fontSize = 10;
        resetBtn.padding = 2;
        GridLayout.setColumn(resetBtn, 1);
        resetBtn.on('tap', () => onResetGroup(group.name));
        groupHeader.addChild(resetBtn);
      }
    }

    groupContainer.addChild(groupHeader);

    if (group.description) {
      const descLabel = new Label();
      descLabel.text = group.description;
      descLabel.textWrap = true;
      descLabel.opacity = 0.6;
      descLabel.fontSize = 11;
      descLabel.marginBottom = 6;
      groupContainer.addChild(descLabel);
    }

    // Options
    group.options.forEach((option) => {
      const optRow = new GridLayout();
      optRow.columns = '*, auto';
      optRow.padding = 6;
      optRow.marginBottom = 2;
      optRow.borderRadius = 4;
      optRow.backgroundColor = '#FAFAFA' as any;

      const labelStack = new StackLayout();
      GridLayout.setColumn(labelStack, 0);

      const optLabel = new Label();
      optLabel.text = option.label;
      optLabel.fontSize = 13;
      labelStack.addChild(optLabel);

      if (option.description) {
        const optDesc = new Label();
        optDesc.text = option.description;
        optDesc.textWrap = true;
        optDesc.opacity = 0.5;
        optDesc.fontSize = 11;
        labelStack.addChild(optDesc);
      }

      optRow.addChild(labelStack);

      if (editable) {
        const toggle = new Switch();
        toggle.checked = option.value;
        toggle.verticalAlignment = 'middle';
        GridLayout.setColumn(toggle, 1);
        if (onToggle) {
          toggle.on('checkedChange', () => {
            onToggle(group.name, option.id, toggle.checked);
          });
        }
        optRow.addChild(toggle);
      } else {
        const stateLabel = new Label();
        stateLabel.text = option.value ? 'On' : 'Off';
        stateLabel.fontSize = 12;
        stateLabel.opacity = 0.6;
        stateLabel.verticalAlignment = 'middle';
        GridLayout.setColumn(stateLabel, 1);
        optRow.addChild(stateLabel);
      }

      groupContainer.addChild(optRow);
    });

    list.addChild(groupContainer);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createPreferenceMatrix.displayName = 'PreferenceMatrix';
export default createPreferenceMatrix;
