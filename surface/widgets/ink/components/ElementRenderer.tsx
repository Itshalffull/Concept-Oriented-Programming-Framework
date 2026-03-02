// ============================================================
// Clef Surface Ink Widget — ElementRenderer
//
// Renders Clef Surface Element concepts as terminal prompts
// using Ink components:
//
//   input-text       → text input with cursor
//   input-number     → numeric input with ◄/► controls
//   input-date       → date entry field
//   input-bool       → checkbox toggle [x] / [ ]
//   selection-single → radio list with arrow navigation
//   selection-multi  → multi-select with checkboxes
//   trigger          → button rendered as [ Label ]
//   output-*         → formatted display values
//   group            → bordered group with label
//   container        → simple wrapper
// ============================================================

import React, { useState, useCallback, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ElementConfig, ElementKind } from '../../shared/types.js';

// --------------- Props ---------------

export interface ElementRendererProps {
  /** Clef Surface element configuration. */
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
  /** Label color. */
  labelColor?: string;
  /** Focus indicator color. */
  focusColor?: string;
  /** Callback when value changes. */
  onChange?: (value: unknown) => void;
}

// --------------- Sub-Components ---------------

const FieldLabel: React.FC<{
  label: string;
  required?: boolean;
  color?: string;
}> = ({ label, required, color }) => (
  <Text bold color={color}>
    {label}
    {required && <Text color="red">*</Text>}
  </Text>
);

const FieldError: React.FC<{ error: string }> = ({ error }) => (
  <Text color="red">  ⚠ {error}</Text>
);

const FieldHint: React.FC<{ hint: string }> = ({ hint }) => (
  <Text dimColor>  {hint}</Text>
);

// --------------- Text Input ---------------

const TextInput: React.FC<ElementRendererProps> = ({
  element, value = '', focused = false, disabled = false,
  error, hint, cursorPosition = 0, width = 40,
  labelColor, focusColor, onChange,
}) => {
  const textValue = String(value);
  const inputWidth = Math.max(10, (width || 40) - 4);
  const borderColor = focused ? (focusColor || 'cyan') : undefined;

  return (
    <Box flexDirection="column">
      <FieldLabel label={element.label} required={element.required} color={labelColor} />
      <Box
        borderStyle="single"
        borderColor={borderColor}
        dimBorder={!focused}
        width={inputWidth + 4}
      >
        <Text dimColor={disabled}>
          {focused && cursorPosition <= textValue.length
            ? textValue.substring(0, cursorPosition) +
              '\u2588' +
              textValue.substring(cursorPosition)
            : textValue || ' '
          }
        </Text>
      </Box>
      {error && <FieldError error={error} />}
      {hint && <FieldHint hint={hint} />}
    </Box>
  );
};

// --------------- Number Input ---------------

const NumberInput: React.FC<ElementRendererProps> = ({
  element, value = 0, focused = false, disabled = false, error, labelColor,
}) => {
  const numValue = Number(value);
  const borderColor = focused ? 'cyan' : undefined;

  return (
    <Box flexDirection="column">
      <FieldLabel label={element.label} required={element.required} color={labelColor} />
      <Text dimColor={disabled}>
        <Text dimColor={!focused} color={borderColor}>[</Text>
        {' ◄ '}<Text>{numValue}</Text>{' ► '}
        <Text dimColor={!focused} color={borderColor}>]</Text>
      </Text>
      {error && <FieldError error={error} />}
    </Box>
  );
};

// --------------- Date Input ---------------

const DateInput: React.FC<ElementRendererProps> = ({
  element, value = '', focused = false, disabled = false, error, labelColor,
}) => {
  const dateValue = String(value || 'YYYY-MM-DD');
  const borderColor = focused ? 'cyan' : undefined;

  return (
    <Box flexDirection="column">
      <FieldLabel label={element.label} required={element.required} color={labelColor} />
      <Text dimColor={disabled}>
        <Text dimColor={!focused} color={borderColor}>[</Text>
        {' '}{dateValue}{' '}
        <Text dimColor={!focused} color={borderColor}>]</Text>
        <Text dimColor> (date)</Text>
      </Text>
      {error && <FieldError error={error} />}
    </Box>
  );
};

// --------------- Bool Input ---------------

const BoolInput: React.FC<ElementRendererProps> = ({
  element, value = false, focused = false, disabled = false, labelColor,
}) => {
  const checked = Boolean(value);

  return (
    <Box>
      <Text color={focused ? 'cyan' : undefined} dimColor={disabled}>
        <Text color={checked ? 'green' : undefined}>
          {checked ? '[x]' : '[ ]'}
        </Text>
        {' '}{element.label}
      </Text>
    </Box>
  );
};

// --------------- Single Selection ---------------

const SingleSelection: React.FC<ElementRendererProps> = ({
  element, focused = false, disabled = false,
  options = [], selectedIndex = 0, error, hint, labelColor,
}) => (
  <Box flexDirection="column">
    <FieldLabel label={element.label} required={element.required} color={labelColor} />
    {options.map((opt, i) => {
      const isSelected = i === selectedIndex;
      const isDisabled = disabled || opt.disabled;
      const radio = isSelected ? '(●)' : '(○)';

      return (
        <Box key={opt.value}>
          {focused && isSelected ? (
            <Text color="cyan" bold>{'❯ '}</Text>
          ) : (
            <Text>{'  '}</Text>
          )}
          <Text
            color={isSelected ? 'green' : undefined}
            dimColor={isDisabled}
          >
            {radio} {opt.label}
          </Text>
        </Box>
      );
    })}
    {focused && <Text dimColor>  ↑/↓ navigate  ⏎ select</Text>}
    {error && <FieldError error={error} />}
    {hint && <FieldHint hint={hint} />}
  </Box>
);

// --------------- Multi Selection ---------------

const MultiSelection: React.FC<ElementRendererProps> = ({
  element, focused = false, disabled = false,
  options = [], selectedIndex = 0,
  selectedIndices = new Set<number>(), error, labelColor,
}) => (
  <Box flexDirection="column">
    <FieldLabel label={element.label} required={element.required} color={labelColor} />
    {options.map((opt, i) => {
      const isHighlighted = i === selectedIndex;
      const isChecked = selectedIndices.has(i);
      const isDisabled = disabled || opt.disabled;
      const checkbox = isChecked ? '[x]' : '[ ]';

      return (
        <Box key={opt.value}>
          {focused && isHighlighted ? (
            <Text color="cyan" bold>{'❯ '}</Text>
          ) : (
            <Text>{'  '}</Text>
          )}
          <Text dimColor={isDisabled}>
            <Text color={isChecked ? 'green' : undefined}>{checkbox}</Text>
            {' '}{opt.label}
          </Text>
        </Box>
      );
    })}
    {focused && <Text dimColor>  ↑/↓ navigate  space toggle  ⏎ confirm</Text>}
    {error && <FieldError error={error} />}
  </Box>
);

// --------------- Trigger ---------------

const Trigger: React.FC<ElementRendererProps> = ({
  element, focused = false, disabled = false,
}) => (
  <Box>
    <Text
      inverse={focused}
      bold={!disabled}
      dimColor={disabled}
    >
      {'[ '}{element.label}{' ]'}
    </Text>
  </Box>
);

// --------------- Navigation ---------------

const Navigation: React.FC<ElementRendererProps> = ({
  element, focused = false, disabled = false,
}) => (
  <Box>
    <Text
      underline
      color={focused ? 'cyan' : 'blue'}
      dimColor={disabled}
    >
      {element.label}
    </Text>
  </Box>
);

// --------------- Output ---------------

const Output: React.FC<ElementRendererProps> = ({
  element, value,
}) => {
  let display: ReactNode;

  switch (element.kind) {
    case 'output-bool':
      display = Boolean(value)
        ? <Text color="green">✓ Yes</Text>
        : <Text color="red">✗ No</Text>;
      break;
    case 'output-number':
      display = <Text color="cyan">{Number(value).toLocaleString()}</Text>;
      break;
    case 'output-date':
      display = <Text dimColor>{String(value || '—')}</Text>;
      break;
    default:
      display = <Text>{String(value ?? '—')}</Text>;
  }

  return (
    <Box>
      <Text bold>{element.label}: </Text>
      {display}
    </Box>
  );
};

// --------------- Group ---------------

const Group: React.FC<ElementRendererProps> = (props) => {
  const { element, width = 40 } = props;

  return (
    <Box flexDirection="column" borderStyle="single" width={width} paddingX={1}>
      <Text bold>{element.label}</Text>
      {element.children?.map((child) => (
        <ElementRenderer key={child.id} {...props} element={child} width={(width || 40) - 4} />
      ))}
    </Box>
  );
};

// --------------- Container ---------------

const Container: React.FC<ElementRendererProps> = (props) => {
  const { element } = props;
  return (
    <Box flexDirection="column">
      {element.children?.map((child) => (
        <ElementRenderer key={child.id} {...props} element={child} />
      ))}
    </Box>
  );
};

// --------------- File Upload ---------------

const FileUpload: React.FC<ElementRendererProps> = ({
  element, value, focused = false, disabled = false, labelColor,
}) => {
  const fileName = value ? String(value) : 'No file selected';

  return (
    <Box flexDirection="column">
      <FieldLabel label={element.label} color={labelColor} />
      <Text dimColor={disabled} color={focused ? 'cyan' : undefined}>
        {'[ 📁 Browse... ] '}
        <Text dimColor>{fileName}</Text>
      </Text>
    </Box>
  );
};

// --------------- Media Display ---------------

const MediaDisplay: React.FC<ElementRendererProps> = ({
  element, value,
}) => {
  const src = String(value || '(no media)');
  return (
    <Box flexDirection="column">
      <Text bold>{element.label}</Text>
      <Text dimColor>[🎬 Media: {src}]</Text>
    </Box>
  );
};

// --------------- Main Component ---------------

export const ElementRenderer: React.FC<ElementRendererProps> = (props) => {
  const { element } = props;

  switch (element.kind) {
    case 'input-text':
    case 'rich-text':
      return <TextInput {...props} />;
    case 'input-number':
      return <NumberInput {...props} />;
    case 'input-date':
      return <DateInput {...props} />;
    case 'input-bool':
      return <BoolInput {...props} />;
    case 'selection-single':
      return <SingleSelection {...props} />;
    case 'selection-multi':
      return <MultiSelection {...props} />;
    case 'trigger':
      return <Trigger {...props} />;
    case 'navigation':
      return <Navigation {...props} />;
    case 'output-text':
    case 'output-number':
    case 'output-date':
    case 'output-bool':
      return <Output {...props} />;
    case 'group':
      return <Group {...props} />;
    case 'container':
      return <Container {...props} />;
    case 'file-upload':
      return <FileUpload {...props} />;
    case 'media-display':
      return <MediaDisplay {...props} />;
    default:
      return <Output {...props} />;
  }
};

ElementRenderer.displayName = 'ElementRenderer';
export default ElementRenderer;
