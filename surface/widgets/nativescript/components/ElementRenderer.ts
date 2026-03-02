// ============================================================
// Clef Surface NativeScript Widget — ElementRenderer
//
// Renders Clef Surface Element concepts as native NativeScript
// views. Maps element kinds to appropriate NativeScript controls:
// TextField, Switch, Button, Label, StackLayout groups, etc.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Switch,
  Button,
  ListView,
  ItemEventData,
  ObservableArray,
  Color,
} from '@nativescript/core';

import type { ElementConfig, ElementKind } from '../../shared/types.js';

// --------------- Props ---------------

export interface ElementRendererProps {
  element: ElementConfig;
  value?: unknown;
  focused?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  options?: Array<{ label: string; value: string; disabled?: boolean }>;
  selectedIndex?: number;
  selectedIndices?: Set<number>;
  width?: number;
  labelColor?: string;
  focusColor?: string;
  onChange?: (value: unknown) => void;
}

// --------------- Helpers ---------------

function createLabel(text: string, opts: { bold?: boolean; color?: string; dimmed?: boolean; fontSize?: number } = {}): Label {
  const label = new Label();
  label.text = text;
  if (opts.bold) label.fontWeight = 'bold';
  if (opts.color) label.color = new Color(opts.color);
  if (opts.dimmed) label.opacity = 0.5;
  if (opts.fontSize) label.fontSize = opts.fontSize;
  return label;
}

function createFieldLabel(text: string, required?: boolean, color?: string): StackLayout {
  const row = new StackLayout();
  row.orientation = 'horizontal';
  const lbl = createLabel(text, { bold: true, color });
  row.addChild(lbl);
  if (required) {
    const star = createLabel(' *', { color: 'red' });
    row.addChild(star);
  }
  return row;
}

function createErrorLabel(error: string): Label {
  return createLabel(`  \u26A0 ${error}`, { color: 'red', fontSize: 12 });
}

function createHintLabel(hint: string): Label {
  return createLabel(`  ${hint}`, { dimmed: true, fontSize: 12 });
}

// --------------- Text Input ---------------

function createTextInput(props: ElementRendererProps): StackLayout {
  const { element, value = '', disabled = false, error, hint, labelColor, onChange } = props;
  const container = new StackLayout();

  container.addChild(createFieldLabel(element.label, element.required, labelColor));

  const textField = new TextField();
  textField.text = String(value);
  textField.hint = element.label;
  textField.isEnabled = !disabled;
  textField.className = 'clef-element-text-input';
  textField.on('textChange', (args: any) => {
    onChange?.(args.object.text);
  });
  container.addChild(textField);

  if (error) container.addChild(createErrorLabel(error));
  if (hint) container.addChild(createHintLabel(hint));

  return container;
}

// --------------- Number Input ---------------

function createNumberInput(props: ElementRendererProps): StackLayout {
  const { element, value = 0, disabled = false, error, labelColor, onChange } = props;
  const container = new StackLayout();

  container.addChild(createFieldLabel(element.label, element.required, labelColor));

  const row = new StackLayout();
  row.orientation = 'horizontal';

  const minusBtn = new Button();
  minusBtn.text = '\u25C4';
  minusBtn.isEnabled = !disabled;
  minusBtn.on('tap', () => onChange?.(Number(value) - 1));
  row.addChild(minusBtn);

  const numLabel = createLabel(String(value), { fontSize: 16 });
  numLabel.horizontalAlignment = 'center';
  numLabel.verticalAlignment = 'middle';
  row.addChild(numLabel);

  const plusBtn = new Button();
  plusBtn.text = '\u25BA';
  plusBtn.isEnabled = !disabled;
  plusBtn.on('tap', () => onChange?.(Number(value) + 1));
  row.addChild(plusBtn);

  container.addChild(row);
  if (error) container.addChild(createErrorLabel(error));

  return container;
}

// --------------- Bool Input ---------------

function createBoolInput(props: ElementRendererProps): StackLayout {
  const { element, value = false, disabled = false, labelColor, onChange } = props;
  const container = new StackLayout();
  container.orientation = 'horizontal';

  const toggle = new Switch();
  toggle.checked = Boolean(value);
  toggle.isEnabled = !disabled;
  toggle.on('checkedChange', (args: any) => {
    onChange?.(args.object.checked);
  });
  container.addChild(toggle);

  container.addChild(createLabel(` ${element.label}`, { color: labelColor }));

  return container;
}

// --------------- Single Selection ---------------

function createSingleSelection(props: ElementRendererProps): StackLayout {
  const { element, options = [], selectedIndex = 0, disabled = false, error, hint, labelColor, onChange } = props;
  const container = new StackLayout();

  container.addChild(createFieldLabel(element.label, element.required, labelColor));

  options.forEach((opt, i) => {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.className = 'clef-selection-row';

    const isSelected = i === selectedIndex;
    const radio = isSelected ? '(\u25CF)' : '(\u25CB)';
    const radioLabel = createLabel(`${radio} ${opt.label}`, {
      color: isSelected ? 'green' : undefined,
      dimmed: disabled || opt.disabled,
    });
    row.addChild(radioLabel);

    if (!disabled && !opt.disabled) {
      row.on('tap', () => onChange?.(opt.value));
    }

    container.addChild(row);
  });

  if (error) container.addChild(createErrorLabel(error));
  if (hint) container.addChild(createHintLabel(hint));

  return container;
}

// --------------- Multi Selection ---------------

function createMultiSelection(props: ElementRendererProps): StackLayout {
  const { element, options = [], selectedIndices = new Set<number>(), disabled = false, error, labelColor, onChange } = props;
  const container = new StackLayout();

  container.addChild(createFieldLabel(element.label, element.required, labelColor));

  options.forEach((opt, i) => {
    const row = new StackLayout();
    row.orientation = 'horizontal';

    const isChecked = selectedIndices.has(i);
    const checkbox = isChecked ? '[x]' : '[ ]';
    const checkLabel = createLabel(`${checkbox} ${opt.label}`, {
      color: isChecked ? 'green' : undefined,
      dimmed: disabled || opt.disabled,
    });
    row.addChild(checkLabel);

    if (!disabled && !opt.disabled) {
      row.on('tap', () => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(i)) newSet.delete(i);
        else newSet.add(i);
        onChange?.(newSet);
      });
    }

    container.addChild(row);
  });

  if (error) container.addChild(createErrorLabel(error));

  return container;
}

// --------------- Trigger ---------------

function createTrigger(props: ElementRendererProps): Button {
  const { element, disabled = false, onChange } = props;
  const btn = new Button();
  btn.text = element.label;
  btn.isEnabled = !disabled;
  btn.className = 'clef-element-trigger';
  btn.on('tap', () => onChange?.(true));
  return btn;
}

// --------------- Output Display ---------------

function createOutput(props: ElementRendererProps): StackLayout {
  const { element, value } = props;
  const container = new StackLayout();
  container.orientation = 'horizontal';

  container.addChild(createLabel(`${element.label}: `, { bold: true }));

  let display: string;
  switch (element.kind) {
    case 'output-bool':
      display = Boolean(value) ? '\u2713 Yes' : '\u2717 No';
      break;
    case 'output-number':
      display = Number(value).toLocaleString();
      break;
    default:
      display = String(value ?? '\u2014');
  }
  container.addChild(createLabel(display));

  return container;
}

// --------------- Group ---------------

function createGroup(props: ElementRendererProps): StackLayout {
  const { element, width } = props;
  const container = new StackLayout();
  container.className = 'clef-element-group';
  container.padding = 8;
  container.borderWidth = 1;
  container.borderColor = new Color('#cccccc');
  if (width) container.width = width;

  container.addChild(createLabel(element.label, { bold: true }));

  if (element.children) {
    for (const child of element.children) {
      container.addChild(createElementRenderer({ ...props, element: child }));
    }
  }

  return container;
}

// --------------- Container ---------------

function createContainer(props: ElementRendererProps): StackLayout {
  const { element } = props;
  const container = new StackLayout();

  if (element.children) {
    for (const child of element.children) {
      container.addChild(createElementRenderer({ ...props, element: child }));
    }
  }

  return container;
}

// --------------- Main Factory ---------------

export function createElementRenderer(props: ElementRendererProps): StackLayout | Button {
  const { element } = props;

  switch (element.kind) {
    case 'input-text':
    case 'rich-text':
      return createTextInput(props);
    case 'input-number':
      return createNumberInput(props);
    case 'input-bool':
      return createBoolInput(props);
    case 'selection-single':
      return createSingleSelection(props);
    case 'selection-multi':
      return createMultiSelection(props);
    case 'trigger':
      return createTrigger(props);
    case 'output-text':
    case 'output-number':
    case 'output-date':
    case 'output-bool':
      return createOutput(props);
    case 'group':
      return createGroup(props);
    case 'container':
      return createContainer(props);
    default:
      return createOutput(props);
  }
}

export default createElementRenderer;
