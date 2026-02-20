// ============================================================
// COIF Ink Widget — ElementRenderer
//
// Renders COIF Element concepts as terminal prompts:
//
//   input-text    → readline-style text input with cursor
//   input-number  → numeric input with increment/decrement
//   input-date    → date entry with field navigation
//   input-bool    → checkbox toggle [x] / [ ]
//   selection-single → arrow-key navigable list
//   selection-multi  → multi-select with checkboxes
//   trigger       → button rendered as [ Label ]
//   output-*      → formatted display values
//   group         → bordered group with label
//   container     → simple wrapper box
// ============================================================

import type { ElementConfig, ElementKind } from '../../shared/types.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_UNDERLINE = '\x1b[4m';
const ANSI_INVERSE = '\x1b[7m';
const ANSI_GREEN_FG = '\x1b[32m';
const ANSI_RED_FG = '\x1b[31m';
const ANSI_YELLOW_FG = '\x1b[33m';
const ANSI_CYAN_FG = '\x1b[36m';
const ANSI_BLUE_FG = '\x1b[34m';

// --- Checkbox Characters ---

const CHECKBOX_CHECKED = '[x]';
const CHECKBOX_UNCHECKED = '[ ]';
const RADIO_CHECKED = '(\u25cf)';   // (●)
const RADIO_UNCHECKED = '(\u25cb)'; // (○)

// --- Border Characters ---

const BORDER = {
  topLeft: '\u250c', topRight: '\u2510',
  bottomLeft: '\u2514', bottomRight: '\u2518',
  horizontal: '\u2500', vertical: '\u2502',
};

// --- ElementRenderer Props ---

export interface ElementRendererProps {
  /** COIF element configuration. */
  element: ElementConfig;
  /** Current value of the element. */
  value?: unknown;
  /** Whether the element currently has focus. */
  focused?: boolean;
  /** Whether the element is disabled. */
  disabled?: boolean;
  /** Validation error message. */
  error?: string;
  /** Hint text shown below the input. */
  hint?: string;
  /** Options for selection elements. */
  options?: Array<{ label: string; value: string; disabled?: boolean }>;
  /** Currently selected index for selection elements. */
  selectedIndex?: number;
  /** Set of selected indices for multi-select elements. */
  selectedIndices?: Set<number>;
  /** Cursor position within text input. */
  cursorPosition?: number;
  /** Width available for rendering. */
  width?: number;
  /** Label color as hex. */
  labelColor?: string;
  /** Focus indicator color as hex. */
  focusColor?: string;
}

/**
 * Creates an ElementRenderer terminal node.
 *
 * Maps COIF ElementKind to appropriate terminal rendering.
 */
export function createElementRenderer(props: ElementRendererProps): TerminalNode {
  const { element } = props;

  switch (element.kind) {
    case 'input-text':
      return renderTextInput(props);
    case 'input-number':
      return renderNumberInput(props);
    case 'input-date':
      return renderDateInput(props);
    case 'input-bool':
      return renderBoolInput(props);
    case 'selection-single':
      return renderSingleSelection(props);
    case 'selection-multi':
      return renderMultiSelection(props);
    case 'trigger':
      return renderTrigger(props);
    case 'navigation':
      return renderNavigation(props);
    case 'output-text':
    case 'output-number':
    case 'output-date':
    case 'output-bool':
      return renderOutput(props);
    case 'group':
      return renderGroup(props);
    case 'container':
      return renderContainer(props);
    case 'rich-text':
      return renderTextInput({ ...props, element: { ...element, kind: 'input-text' } });
    case 'file-upload':
      return renderFileUpload(props);
    case 'media-display':
      return renderMediaDisplay(props);
    default:
      return renderOutput(props);
  }
}

// --- Element Renderers ---

function renderTextInput(props: ElementRendererProps): TerminalNode {
  const {
    element, value = '', focused = false, disabled = false,
    error, hint, cursorPosition, width = 40,
    labelColor, focusColor,
  } = props;

  const labelAnsi = labelColor ? hexToAnsiFg(labelColor) : '';
  const focusAnsi = focusColor ? hexToAnsiFg(focusColor) : ANSI_CYAN_FG;
  const textValue = String(value);
  const inputWidth = Math.max(10, width - 4);

  const children: (TerminalNode | string)[] = [];

  // Label
  const requiredMark = element.required ? `${ANSI_RED_FG}*${ANSI_RESET}` : '';
  children.push({
    type: 'text',
    props: { role: 'label' },
    children: [`${labelAnsi}${ANSI_BOLD}${element.label}${requiredMark}${ANSI_RESET}`],
  });

  // Input field
  const focusBorder = focused ? focusAnsi : ANSI_DIM;
  const disabledStyle = disabled ? ANSI_DIM : '';

  let displayValue = textValue;
  if (focused && cursorPosition !== undefined) {
    // Show cursor as inverse character
    const before = textValue.substring(0, cursorPosition);
    const cursorChar = textValue[cursorPosition] || ' ';
    const after = textValue.substring(cursorPosition + 1);
    displayValue = `${before}${ANSI_INVERSE}${cursorChar}${ANSI_RESET}${disabledStyle}${after}`;
  }

  const paddedValue = displayValue + ' '.repeat(Math.max(0, inputWidth - stripAnsi(displayValue).length));
  const inputLine = `${focusBorder}${BORDER.vertical}${ANSI_RESET}${disabledStyle} ${paddedValue} ${focusBorder}${BORDER.vertical}${ANSI_RESET}`;
  const topBorder = `${focusBorder}${BORDER.topLeft}${BORDER.horizontal.repeat(inputWidth + 2)}${BORDER.topRight}${ANSI_RESET}`;
  const bottomBorder = `${focusBorder}${BORDER.bottomLeft}${BORDER.horizontal.repeat(inputWidth + 2)}${BORDER.bottomRight}${ANSI_RESET}`;

  children.push(
    { type: 'text', props: {}, children: [topBorder] },
    { type: 'text', props: {}, children: [inputLine] },
    { type: 'text', props: {}, children: [bottomBorder] },
  );

  // Error message
  if (error) {
    children.push({
      type: 'text',
      props: { role: 'error' },
      children: [`${ANSI_RED_FG}  \u26a0 ${error}${ANSI_RESET}`],
    });
  }

  // Hint
  if (hint) {
    children.push({
      type: 'text',
      props: { role: 'hint' },
      children: [`${ANSI_DIM}  ${hint}${ANSI_RESET}`],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'input-text',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'column',
    },
    children,
  };
}

function renderNumberInput(props: ElementRendererProps): TerminalNode {
  const {
    element, value = 0, focused = false, disabled = false,
    error, hint, width = 30,
  } = props;

  const numValue = Number(value);
  const children: (TerminalNode | string)[] = [];

  const requiredMark = element.required ? `${ANSI_RED_FG}*${ANSI_RESET}` : '';
  children.push({
    type: 'text',
    props: { role: 'label' },
    children: [`${ANSI_BOLD}${element.label}${requiredMark}${ANSI_RESET}`],
  });

  const focusBorder = focused ? ANSI_CYAN_FG : ANSI_DIM;
  const disabledStyle = disabled ? ANSI_DIM : '';
  const inputLine = `${focusBorder}[ ${ANSI_RESET}${disabledStyle}\u25c4 ${numValue} \u25ba${ANSI_RESET}${focusBorder} ]${ANSI_RESET}`;

  children.push({
    type: 'text',
    props: { role: 'number-input' },
    children: [inputLine],
  });

  if (error) {
    children.push({
      type: 'text',
      props: { role: 'error' },
      children: [`${ANSI_RED_FG}  \u26a0 ${error}${ANSI_RESET}`],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'input-number',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'column',
    },
    children,
  };
}

function renderDateInput(props: ElementRendererProps): TerminalNode {
  const {
    element, value = '', focused = false, disabled = false,
    error,
  } = props;

  const dateValue = String(value || 'YYYY-MM-DD');
  const children: (TerminalNode | string)[] = [];

  const requiredMark = element.required ? `${ANSI_RED_FG}*${ANSI_RESET}` : '';
  children.push({
    type: 'text',
    props: { role: 'label' },
    children: [`${ANSI_BOLD}${element.label}${requiredMark}${ANSI_RESET}`],
  });

  const focusBorder = focused ? ANSI_CYAN_FG : ANSI_DIM;
  const disabledStyle = disabled ? ANSI_DIM : '';
  const calendarIcon = '\u{1f4c5}';
  const inputLine = `${focusBorder}[ ${ANSI_RESET}${disabledStyle}${dateValue}${ANSI_RESET}${focusBorder} ] ${ANSI_DIM}(date)${ANSI_RESET}`;

  children.push({
    type: 'text',
    props: { role: 'date-input' },
    children: [inputLine],
  });

  if (error) {
    children.push({
      type: 'text',
      props: { role: 'error' },
      children: [`${ANSI_RED_FG}  \u26a0 ${error}${ANSI_RESET}`],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'input-date',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'column',
    },
    children,
  };
}

function renderBoolInput(props: ElementRendererProps): TerminalNode {
  const {
    element, value = false, focused = false, disabled = false,
  } = props;

  const checked = Boolean(value);
  const checkbox = checked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;
  const focusStyle = focused ? ANSI_CYAN_FG : '';
  const disabledStyle = disabled ? ANSI_DIM : '';
  const checkColor = checked ? ANSI_GREEN_FG : '';

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'input-bool',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'row',
    },
    children: [{
      type: 'text',
      props: {},
      children: [
        `${focusStyle}${disabledStyle}${checkColor}${checkbox}${ANSI_RESET} ${element.label}`,
      ],
    }],
  };
}

function renderSingleSelection(props: ElementRendererProps): TerminalNode {
  const {
    element, value, focused = false, disabled = false,
    options = [], selectedIndex = 0, error, hint,
  } = props;

  const children: (TerminalNode | string)[] = [];

  const requiredMark = element.required ? `${ANSI_RED_FG}*${ANSI_RESET}` : '';
  children.push({
    type: 'text',
    props: { role: 'label' },
    children: [`${ANSI_BOLD}${element.label}${requiredMark}${ANSI_RESET}`],
  });

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const isSelected = i === selectedIndex;
    const isDisabled = disabled || opt.disabled;

    const radio = isSelected ? RADIO_CHECKED : RADIO_UNCHECKED;
    const prefix = focused && isSelected ? `${ANSI_CYAN_FG}\u276f ` : '  ';
    const color = isSelected ? ANSI_GREEN_FG : isDisabled ? ANSI_DIM : '';
    const dimStyle = isDisabled ? ANSI_DIM : '';

    children.push({
      type: 'text',
      props: { index: i, selected: isSelected, disabled: isDisabled },
      children: [`${prefix}${color}${dimStyle}${radio} ${opt.label}${ANSI_RESET}`],
    });
  }

  if (focused) {
    children.push({
      type: 'text',
      props: { role: 'hint' },
      children: [`${ANSI_DIM}  \u2191/\u2193 navigate  \u23ce select${ANSI_RESET}`],
    });
  }

  if (error) {
    children.push({
      type: 'text',
      props: { role: 'error' },
      children: [`${ANSI_RED_FG}  \u26a0 ${error}${ANSI_RESET}`],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'selection-single',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'column',
    },
    children,
  };
}

function renderMultiSelection(props: ElementRendererProps): TerminalNode {
  const {
    element, focused = false, disabled = false,
    options = [], selectedIndex = 0,
    selectedIndices = new Set<number>(), error,
  } = props;

  const children: (TerminalNode | string)[] = [];

  const requiredMark = element.required ? `${ANSI_RED_FG}*${ANSI_RESET}` : '';
  children.push({
    type: 'text',
    props: { role: 'label' },
    children: [`${ANSI_BOLD}${element.label}${requiredMark}${ANSI_RESET}`],
  });

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const isHighlighted = i === selectedIndex;
    const isChecked = selectedIndices.has(i);
    const isDisabled = disabled || opt.disabled;

    const checkbox = isChecked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;
    const prefix = focused && isHighlighted ? `${ANSI_CYAN_FG}\u276f ` : '  ';
    const checkColor = isChecked ? ANSI_GREEN_FG : '';
    const dimStyle = isDisabled ? ANSI_DIM : '';

    children.push({
      type: 'text',
      props: { index: i, highlighted: isHighlighted, checked: isChecked },
      children: [`${prefix}${dimStyle}${checkColor}${checkbox}${ANSI_RESET}${dimStyle} ${opt.label}${ANSI_RESET}`],
    });
  }

  if (focused) {
    children.push({
      type: 'text',
      props: { role: 'hint' },
      children: [`${ANSI_DIM}  \u2191/\u2193 navigate  space toggle  \u23ce confirm${ANSI_RESET}`],
    });
  }

  if (error) {
    children.push({
      type: 'text',
      props: { role: 'error' },
      children: [`${ANSI_RED_FG}  \u26a0 ${error}${ANSI_RESET}`],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'selection-multi',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'column',
    },
    children,
  };
}

function renderTrigger(props: ElementRendererProps): TerminalNode {
  const { element, focused = false, disabled = false } = props;

  const focusStyle = focused ? ANSI_INVERSE : '';
  const disabledStyle = disabled ? ANSI_DIM : ANSI_BOLD;
  const label = ` ${element.label} `;

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'trigger',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'row',
    },
    children: [{
      type: 'text',
      props: {},
      children: [`${focusStyle}${disabledStyle}[${label}]${ANSI_RESET}`],
    }],
  };
}

function renderNavigation(props: ElementRendererProps): TerminalNode {
  const { element, focused = false, disabled = false } = props;

  const style = focused ? ANSI_UNDERLINE + ANSI_CYAN_FG : ANSI_BLUE_FG + ANSI_UNDERLINE;
  const disabledStyle = disabled ? ANSI_DIM : '';

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'navigation',
      elementId: element.id,
      focused,
      disabled,
    },
    children: [{
      type: 'text',
      props: {},
      children: [`${disabledStyle}${style}${element.label}${ANSI_RESET}`],
    }],
  };
}

function renderOutput(props: ElementRendererProps): TerminalNode {
  const { element, value } = props;

  let displayValue: string;
  switch (element.kind) {
    case 'output-bool':
      displayValue = Boolean(value) ? `${ANSI_GREEN_FG}\u2713 Yes${ANSI_RESET}` : `${ANSI_RED_FG}\u2717 No${ANSI_RESET}`;
      break;
    case 'output-number':
      displayValue = `${ANSI_CYAN_FG}${Number(value).toLocaleString()}${ANSI_RESET}`;
      break;
    case 'output-date':
      displayValue = `${ANSI_DIM}${String(value || '—')}${ANSI_RESET}`;
      break;
    default:
      displayValue = String(value ?? '—');
  }

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: element.kind,
      elementId: element.id,
      flexDirection: 'row',
    },
    children: [{
      type: 'text',
      props: {},
      children: [`${ANSI_BOLD}${element.label}:${ANSI_RESET} ${displayValue}`],
    }],
  };
}

function renderGroup(props: ElementRendererProps): TerminalNode {
  const { element, width = 40 } = props;

  const innerWidth = width - 4;
  const titleText = ` ${element.label} `;
  const leftFill = 2;
  const rightFill = Math.max(1, innerWidth - titleText.length - leftFill);

  const topBorder = `${ANSI_DIM}${BORDER.topLeft}${BORDER.horizontal.repeat(leftFill)}${ANSI_RESET}${ANSI_BOLD}${titleText}${ANSI_RESET}${ANSI_DIM}${BORDER.horizontal.repeat(rightFill)}${BORDER.topRight}${ANSI_RESET}`;
  const bottomBorder = `${ANSI_DIM}${BORDER.bottomLeft}${BORDER.horizontal.repeat(innerWidth + 2)}${BORDER.bottomRight}${ANSI_RESET}`;

  const children: (TerminalNode | string)[] = [
    { type: 'text', props: {}, children: [topBorder] },
  ];

  // Render child elements recursively
  if (element.children) {
    for (const child of element.children) {
      children.push(createElementRenderer({
        ...props,
        element: child,
        width: innerWidth,
      }));
    }
  }

  children.push({ type: 'text', props: {}, children: [bottomBorder] });

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'group',
      elementId: element.id,
      flexDirection: 'column',
    },
    children,
  };
}

function renderContainer(props: ElementRendererProps): TerminalNode {
  const { element } = props;

  const children: (TerminalNode | string)[] = [];

  if (element.children) {
    for (const child of element.children) {
      children.push(createElementRenderer({
        ...props,
        element: child,
      }));
    }
  }

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'container',
      elementId: element.id,
      flexDirection: 'column',
    },
    children,
  };
}

function renderFileUpload(props: ElementRendererProps): TerminalNode {
  const { element, value, focused = false, disabled = false } = props;

  const fileName = value ? String(value) : 'No file selected';
  const focusStyle = focused ? ANSI_CYAN_FG : ANSI_DIM;
  const disabledStyle = disabled ? ANSI_DIM : '';

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'file-upload',
      elementId: element.id,
      focused,
      disabled,
      flexDirection: 'column',
    },
    children: [
      {
        type: 'text',
        props: { role: 'label' },
        children: [`${ANSI_BOLD}${element.label}${ANSI_RESET}`],
      },
      {
        type: 'text',
        props: {},
        children: [`${focusStyle}${disabledStyle}[ \u{1f4c1} Browse... ] ${ANSI_DIM}${fileName}${ANSI_RESET}`],
      },
    ],
  };
}

function renderMediaDisplay(props: ElementRendererProps): TerminalNode {
  const { element, value } = props;

  const src = String(value || '(no media)');

  return {
    type: 'box',
    props: {
      role: 'element',
      elementKind: 'media-display',
      elementId: element.id,
    },
    children: [
      {
        type: 'text',
        props: { role: 'label' },
        children: [`${ANSI_BOLD}${element.label}${ANSI_RESET}`],
      },
      {
        type: 'text',
        props: {},
        children: [`${ANSI_DIM}[\u{1f3ac} Media: ${src}]${ANSI_RESET}`],
      },
    ],
  };
}

// --- Interactive ElementRenderer ---

export class ElementRendererInteractive {
  private element: ElementConfig;
  private value: unknown;
  private focused: boolean;
  private disabled: boolean;
  private cursorPosition: number;
  private selectedIndex: number;
  private selectedIndices: Set<number>;
  private options: Array<{ label: string; value: string; disabled?: boolean }>;
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private onChange?: (value: unknown) => void;
  private destroyed = false;
  private props: ElementRendererProps;

  constructor(
    props: ElementRendererProps,
    onChange?: (value: unknown) => void,
  ) {
    this.props = props;
    this.element = props.element;
    this.value = props.value ?? '';
    this.focused = props.focused ?? false;
    this.disabled = props.disabled ?? false;
    this.cursorPosition = props.cursorPosition ?? 0;
    this.selectedIndex = props.selectedIndex ?? 0;
    this.selectedIndices = props.selectedIndices ?? new Set();
    this.options = props.options ?? [];
    this.onChange = onChange;
  }

  handleKey(key: string): boolean {
    if (this.destroyed || this.disabled) return false;

    switch (this.element.kind) {
      case 'input-text':
      case 'rich-text':
        return this.handleTextKey(key);
      case 'input-number':
        return this.handleNumberKey(key);
      case 'input-bool':
        return this.handleBoolKey(key);
      case 'selection-single':
        return this.handleSingleSelectionKey(key);
      case 'selection-multi':
        return this.handleMultiSelectionKey(key);
      case 'trigger':
        return this.handleTriggerKey(key);
      default:
        return false;
    }
  }

  getValue(): unknown {
    return this.value;
  }

  setValue(value: unknown): void {
    this.value = value;
    this.onChange?.(value);
    this.notify();
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    this.notify();
  }

  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  render(): TerminalNode {
    return createElementRenderer({
      ...this.props,
      value: this.value,
      focused: this.focused,
      disabled: this.disabled,
      cursorPosition: this.cursorPosition,
      selectedIndex: this.selectedIndex,
      selectedIndices: this.selectedIndices,
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }

  private handleTextKey(key: string): boolean {
    const text = String(this.value);
    switch (key) {
      case 'left':
        this.cursorPosition = Math.max(0, this.cursorPosition - 1);
        this.notify();
        return true;
      case 'right':
        this.cursorPosition = Math.min(text.length, this.cursorPosition + 1);
        this.notify();
        return true;
      case 'home':
        this.cursorPosition = 0;
        this.notify();
        return true;
      case 'end':
        this.cursorPosition = text.length;
        this.notify();
        return true;
      case 'backspace':
        if (this.cursorPosition > 0) {
          this.value = text.substring(0, this.cursorPosition - 1) + text.substring(this.cursorPosition);
          this.cursorPosition--;
          this.onChange?.(this.value);
          this.notify();
        }
        return true;
      case 'delete':
        if (this.cursorPosition < text.length) {
          this.value = text.substring(0, this.cursorPosition) + text.substring(this.cursorPosition + 1);
          this.onChange?.(this.value);
          this.notify();
        }
        return true;
      default:
        // Single printable character
        if (key.length === 1 && key >= ' ') {
          this.value = text.substring(0, this.cursorPosition) + key + text.substring(this.cursorPosition);
          this.cursorPosition++;
          this.onChange?.(this.value);
          this.notify();
          return true;
        }
        return false;
    }
  }

  private handleNumberKey(key: string): boolean {
    const num = Number(this.value) || 0;
    switch (key) {
      case 'up':
        this.value = num + 1;
        this.onChange?.(this.value);
        this.notify();
        return true;
      case 'down':
        this.value = num - 1;
        this.onChange?.(this.value);
        this.notify();
        return true;
      default:
        return false;
    }
  }

  private handleBoolKey(key: string): boolean {
    if (key === 'space' || key === 'return' || key === 'enter') {
      this.value = !this.value;
      this.onChange?.(this.value);
      this.notify();
      return true;
    }
    return false;
  }

  private handleSingleSelectionKey(key: string): boolean {
    switch (key) {
      case 'up':
      case 'k':
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.notify();
        return true;
      case 'down':
      case 'j':
        this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
        this.notify();
        return true;
      case 'return':
      case 'enter':
        if (this.options[this.selectedIndex]) {
          this.value = this.options[this.selectedIndex].value;
          this.onChange?.(this.value);
          this.notify();
        }
        return true;
      default:
        return false;
    }
  }

  private handleMultiSelectionKey(key: string): boolean {
    switch (key) {
      case 'up':
      case 'k':
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.notify();
        return true;
      case 'down':
      case 'j':
        this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
        this.notify();
        return true;
      case 'space':
        if (this.selectedIndices.has(this.selectedIndex)) {
          this.selectedIndices.delete(this.selectedIndex);
        } else {
          this.selectedIndices.add(this.selectedIndex);
        }
        this.value = Array.from(this.selectedIndices).map(i => this.options[i]?.value).filter(Boolean);
        this.onChange?.(this.value);
        this.notify();
        return true;
      default:
        return false;
    }
  }

  private handleTriggerKey(key: string): boolean {
    if (key === 'return' || key === 'enter' || key === 'space') {
      this.onChange?.(true); // Signal button press
      return true;
    }
    return false;
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}

// --- Utility ---

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
