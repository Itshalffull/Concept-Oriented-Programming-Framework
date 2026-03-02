// ============================================================
// Clef Surface NativeScript Widget — PropertyPanel
//
// Property inspector panel displaying key-value pairs in
// editable or read-only mode. Supports grouped sections,
// text fields, switches, and labels for different value types.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, TextField, Switch, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export type PropertyType = 'string' | 'number' | 'boolean' | 'readonly';

export interface PropertyItem {
  key: string;
  label: string;
  value: string | number | boolean;
  type: PropertyType;
  description?: string;
}

export interface PropertyGroup {
  name: string;
  properties: PropertyItem[];
  collapsed?: boolean;
}

// --------------- Props ---------------

export interface PropertyPanelProps {
  /** Title for the panel. */
  title?: string;
  /** Grouped property sections. */
  groups?: PropertyGroup[];
  /** Called when a property value changes. */
  onChange?: (key: string, value: string | number | boolean) => void;
  /** Called when a group is toggled. */
  onToggleGroup?: (groupName: string, collapsed: boolean) => void;
}

// --------------- Component ---------------

export function createPropertyPanel(props: PropertyPanelProps = {}): StackLayout {
  const {
    title = 'Properties',
    groups = [],
    onChange,
    onToggleGroup,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-property-panel';
  container.padding = 12;

  // Title
  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  titleLabel.marginBottom = 12;
  container.addChild(titleLabel);

  if (groups.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No properties.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    container.addChild(emptyLabel);
    return container;
  }

  const scrollView = new ScrollView();
  const list = new StackLayout();

  groups.forEach((group) => {
    const groupContainer = new StackLayout();
    groupContainer.marginBottom = 12;

    // Group header (collapsible)
    const groupHeader = new GridLayout();
    groupHeader.columns = 'auto, *';
    groupHeader.padding = 4;
    groupHeader.marginBottom = 4;

    const chevron = new Label();
    chevron.text = group.collapsed ? '\u25B6 ' : '\u25BC ';
    chevron.fontSize = 10;
    chevron.verticalAlignment = 'middle';
    GridLayout.setColumn(chevron, 0);
    groupHeader.addChild(chevron);

    const groupName = new Label();
    groupName.text = group.name;
    groupName.fontWeight = 'bold';
    groupName.fontSize = 13;
    groupName.verticalAlignment = 'middle';
    GridLayout.setColumn(groupName, 1);
    groupHeader.addChild(groupName);

    if (onToggleGroup) {
      groupHeader.on('tap', () => onToggleGroup(group.name, !group.collapsed));
    }

    groupContainer.addChild(groupHeader);

    if (!group.collapsed) {
      group.properties.forEach((prop) => {
        const propRow = new GridLayout();
        propRow.columns = '120, *';
        propRow.padding = 4;
        propRow.marginBottom = 2;

        // Label
        const propLabel = new Label();
        propLabel.text = prop.label;
        propLabel.fontSize = 12;
        propLabel.verticalAlignment = 'middle';
        propLabel.opacity = 0.8;
        GridLayout.setColumn(propLabel, 0);
        propRow.addChild(propLabel);

        // Value editor
        if (prop.type === 'boolean') {
          const toggle = new Switch();
          toggle.checked = prop.value as boolean;
          toggle.verticalAlignment = 'middle';
          GridLayout.setColumn(toggle, 1);
          if (onChange) {
            toggle.on('checkedChange', () => onChange(prop.key, toggle.checked));
          }
          propRow.addChild(toggle);
        } else if (prop.type === 'readonly') {
          const readonlyLabel = new Label();
          readonlyLabel.text = `${prop.value}`;
          readonlyLabel.fontSize = 12;
          readonlyLabel.verticalAlignment = 'middle';
          readonlyLabel.opacity = 0.6;
          GridLayout.setColumn(readonlyLabel, 1);
          propRow.addChild(readonlyLabel);
        } else {
          const textField = new TextField();
          textField.text = `${prop.value}`;
          textField.fontSize = 12;
          textField.keyboardType = prop.type === 'number' ? 'number' : 'text' as any;
          GridLayout.setColumn(textField, 1);
          if (onChange) {
            textField.on('textChange', () => {
              const val = prop.type === 'number' ? Number(textField.text) : textField.text;
              onChange(prop.key, val);
            });
          }
          propRow.addChild(textField);
        }

        groupContainer.addChild(propRow);

        // Description hint
        if (prop.description) {
          const hintLabel = new Label();
          hintLabel.text = prop.description;
          hintLabel.textWrap = true;
          hintLabel.opacity = 0.4;
          hintLabel.fontSize = 10;
          hintLabel.marginLeft = 124;
          hintLabel.marginBottom = 4;
          groupContainer.addChild(hintLabel);
        }
      });
    }

    list.addChild(groupContainer);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createPropertyPanel.displayName = 'PropertyPanel';
export default createPropertyPanel;
