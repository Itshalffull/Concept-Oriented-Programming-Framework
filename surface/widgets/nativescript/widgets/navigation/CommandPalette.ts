// ============================================================
// Clef Surface NativeScript Widget — CommandPalette
//
// Searchable command menu for NativeScript. Provides a text
// input for filtering commands and a scrollable list of matched
// results. Each command entry can carry a label, description,
// keyboard shortcut hint, and tap handler.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  ScrollView,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface CommandEntry {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  onExecute?: () => void;
}

// --------------- Props ---------------

export interface CommandPaletteProps {
  commands?: CommandEntry[];
  placeholder?: string;
  maxVisibleItems?: number;
  backgroundColor?: string;
  inputBackgroundColor?: string;
  textColor?: string;
  descriptionColor?: string;
  shortcutColor?: string;
  highlightColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
}

// --------------- Component ---------------

export function createCommandPalette(props: CommandPaletteProps = {}): StackLayout {
  const {
    commands = [],
    placeholder = 'Type a command\u2026',
    maxVisibleItems = 8,
    backgroundColor = '#FFFFFF',
    inputBackgroundColor = '#F9FAFB',
    textColor = '#111827',
    descriptionColor = '#6B7280',
    shortcutColor = '#9CA3AF',
    highlightColor = '#EFF6FF',
    borderColor = '#E5E7EB',
    borderRadius = 12,
    padding = 12,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-command-palette';
  container.backgroundColor = new Color(backgroundColor);
  container.borderRadius = borderRadius;
  container.borderWidth = 1;
  container.borderColor = new Color(borderColor);
  container.padding = padding;

  // Search input
  const searchField = new TextField();
  searchField.hint = placeholder;
  searchField.className = 'clef-command-palette-input';
  searchField.backgroundColor = new Color(inputBackgroundColor);
  searchField.color = new Color(textColor);
  searchField.fontSize = 15;
  searchField.borderRadius = 8;
  searchField.padding = 10;
  searchField.marginBottom = 8;
  container.addChild(searchField);

  // Results scroll view
  const scrollView = new ScrollView();
  scrollView.className = 'clef-command-palette-results';
  scrollView.height = maxVisibleItems * 48;

  const resultsList = new StackLayout();
  resultsList.className = 'clef-command-palette-list';

  // Render all commands initially
  const renderResults = (filter: string) => {
    resultsList.removeChildren();
    const query = filter.toLowerCase().trim();

    const filtered = query.length === 0
      ? commands
      : commands.filter(
          (cmd) =>
            cmd.label.toLowerCase().includes(query) ||
            (cmd.description && cmd.description.toLowerCase().includes(query))
        );

    filtered.slice(0, maxVisibleItems).forEach((cmd) => {
      const row = new GridLayout();
      row.columns = '*, auto';
      row.padding = 10;
      row.borderRadius = 6;
      row.className = 'clef-command-palette-item';

      const labelCol = new StackLayout();
      GridLayout.setColumn(labelCol, 0);

      const cmdLabel = new Label();
      cmdLabel.text = cmd.label;
      cmdLabel.color = new Color(textColor);
      cmdLabel.fontWeight = 'bold';
      cmdLabel.fontSize = 14;
      labelCol.addChild(cmdLabel);

      if (cmd.description) {
        const descLabel = new Label();
        descLabel.text = cmd.description;
        descLabel.color = new Color(descriptionColor);
        descLabel.fontSize = 12;
        descLabel.textWrap = true;
        labelCol.addChild(descLabel);
      }

      row.addChild(labelCol);

      if (cmd.shortcut) {
        const shortcutLabel = new Label();
        shortcutLabel.text = cmd.shortcut;
        shortcutLabel.color = new Color(shortcutColor);
        shortcutLabel.fontSize = 12;
        shortcutLabel.verticalAlignment = 'middle';
        shortcutLabel.horizontalAlignment = 'right';
        GridLayout.setColumn(shortcutLabel, 1);
        row.addChild(shortcutLabel);
      }

      // Highlight on tap
      row.on('tap', () => {
        row.backgroundColor = new Color(highlightColor);
        setTimeout(() => {
          row.backgroundColor = new Color('transparent');
        }, 200);
        if (cmd.onExecute) cmd.onExecute();
      });

      resultsList.addChild(row);
    });

    if (filtered.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.text = 'No commands found';
      emptyLabel.color = new Color(descriptionColor);
      emptyLabel.fontSize = 13;
      emptyLabel.horizontalAlignment = 'center';
      emptyLabel.padding = 16;
      resultsList.addChild(emptyLabel);
    }
  };

  renderResults('');

  searchField.on('textChange', () => {
    renderResults(searchField.text || '');
  });

  scrollView.content = resultsList;
  container.addChild(scrollView);

  return container;
}

createCommandPalette.displayName = 'CommandPalette';
export default createCommandPalette;
