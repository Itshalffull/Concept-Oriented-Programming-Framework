// ============================================================
// Clef Surface Ink Widget — ColorPicker
//
// Color selection control for the terminal. Shows preset color
// swatches as colored block characters, a hex value display,
// and arrow-key navigation across preset colors. Maps the
// color-picker.widget anatomy (root, trigger, swatch,
// swatchGroup, swatchTrigger, input) and states (popover,
// interaction, focus) to keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface ColorPickerProps {
  /** Current color as a hex string (e.g. "#ff0000"). */
  value?: string;
  /** Array of preset color hex strings. */
  presets?: string[];
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Called when the selected color changes. */
  onChange?: (color: string) => void;
}

// --------------- Helpers ---------------

/** Map a hex color to an approximate Ink/ANSI color keyword. */
const hexToAnsi = (hex: string): string | undefined => {
  const h = hex.replace('#', '').toLowerCase();
  const map: Record<string, string> = {
    ff0000: 'red',
    '00ff00': 'green',
    '0000ff': 'blue',
    ffff00: 'yellow',
    ff00ff: 'magenta',
    '00ffff': 'cyan',
    ffffff: 'white',
    '000000': 'blackBright',
    ff8800: 'yellow',
    '808080': 'gray',
  };
  return map[h] ?? undefined;
};

// --------------- Component ---------------

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value: controlledValue,
  presets = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000'],
  isFocused = false,
  disabled = false,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '#000000');
  const [presetIndex, setPresetIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  // Sync preset index when value changes externally
  useEffect(() => {
    const idx = presets.indexOf(currentValue);
    if (idx >= 0) {
      setPresetIndex(idx);
    }
  }, [currentValue, presets]);

  const selectColor = useCallback(
    (color: string) => {
      if (disabled) return;
      setInternalValue(color);
      onChange?.(color);
    },
    [disabled, onChange],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (isEditing) {
        if (key.return) {
          // Commit edit
          const hex = editBuffer.startsWith('#') ? editBuffer : `#${editBuffer}`;
          if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
            selectColor(hex.toLowerCase());
          }
          setIsEditing(false);
          setEditBuffer('');
          return;
        }
        if (key.escape) {
          setIsEditing(false);
          setEditBuffer('');
          return;
        }
        if (key.backspace || key.delete) {
          setEditBuffer((prev) => prev.slice(0, -1));
          return;
        }
        if (/^[0-9a-fA-F#]$/.test(input)) {
          setEditBuffer((prev) => prev + input);
        }
        return;
      }

      // Preset navigation
      if (key.leftArrow) {
        const next = (presetIndex - 1 + presets.length) % presets.length;
        setPresetIndex(next);
        selectColor(presets[next]);
      } else if (key.rightArrow) {
        const next = (presetIndex + 1) % presets.length;
        setPresetIndex(next);
        selectColor(presets[next]);
      } else if (input === 'e' || input === '#') {
        // Enter hex editing mode
        setIsEditing(true);
        setEditBuffer('#');
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {/* Current color display */}
      <Box>
        <Text dimColor={disabled}>Color: </Text>
        <Text color={hexToAnsi(currentValue)} bold>
          {'\u2588\u2588'}
        </Text>
        <Text dimColor={disabled}> {currentValue}</Text>
      </Box>

      {/* Editing mode */}
      {isEditing && (
        <Box>
          <Text color="cyan">Hex: </Text>
          <Text bold>{editBuffer}</Text>
          <Text dimColor>{'_'}</Text>
        </Box>
      )}

      {/* Preset swatches */}
      <Box marginTop={1}>
        <Text dimColor={disabled}>Presets: </Text>
        {presets.map((color, idx) => (
          <Text
            key={color}
            color={hexToAnsi(color)}
            bold={idx === presetIndex}
            inverse={idx === presetIndex && isFocused && !disabled}
          >
            {'\u2588\u2588'}
            {idx < presets.length - 1 ? ' ' : ''}
          </Text>
        ))}
      </Box>

      {/* Hint */}
      {isFocused && !disabled && !isEditing && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2190\u2192'} navigate presets {'|'} # edit hex
          </Text>
        </Box>
      )}
    </Box>
  );
};

ColorPicker.displayName = 'ColorPicker';
export default ColorPicker;
