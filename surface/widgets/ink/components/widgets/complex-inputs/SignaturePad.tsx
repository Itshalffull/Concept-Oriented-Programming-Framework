// ============================================================
// Clef Surface Ink Widget — SignaturePad
//
// Freeform signature capture placeholder for the terminal.
// Since terminals cannot render canvas drawing, this shows a
// bordered area with a placeholder message and a clear button.
// Maps the signature-pad.widget anatomy (root, canvas,
// clearButton, label) and states (content, focus) to a
// keyboard-driven terminal representation.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface SignaturePadProps {
  /** Width of the signature area in characters. */
  width?: number;
  /** Height of the signature area in lines. */
  height?: number;
  /** Disables the pad when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when a signature is recorded (simulated in terminal). */
  onSign?: (data: string) => void;
  /** Called when the signature is cleared. */
  onClear?: () => void;
  /** Visible label. */
  label?: string;
}

// --------------- Component ---------------

export const SignaturePad: React.FC<SignaturePadProps> = ({
  width = 40,
  height = 8,
  disabled = false,
  isFocused = false,
  onSign,
  onClear,
  label = 'Signature',
}) => {
  const [signed, setSigned] = useState(false);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [cursorX, setCursorX] = useState(Math.floor(width / 2));
  const [cursorY, setCursorY] = useState(Math.floor(height / 2));

  const clear = useCallback(() => {
    if (disabled) return;
    setSigned(false);
    setStrokes([]);
    setCursorX(Math.floor(width / 2));
    setCursorY(Math.floor(height / 2));
    onClear?.();
  }, [disabled, width, height, onClear]);

  const addStroke = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      setStrokes((prev) => {
        if (prev.includes(key)) return prev;
        return [...prev, key];
      });
      if (!signed) {
        setSigned(true);
        onSign?.(`signature-${Date.now()}`);
      }
    },
    [signed, onSign],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      // Clear with 'c' or delete/backspace
      if (input === 'c' || key.delete || key.backspace) {
        clear();
        return;
      }

      // Move cursor
      let nx = cursorX;
      let ny = cursorY;

      if (key.leftArrow) nx = Math.max(0, cursorX - 1);
      else if (key.rightArrow) nx = Math.min(width - 1, cursorX + 1);
      else if (key.upArrow) ny = Math.max(0, cursorY - 1);
      else if (key.downArrow) ny = Math.min(height - 1, cursorY + 1);

      if (nx !== cursorX || ny !== cursorY) {
        setCursorX(nx);
        setCursorY(ny);
      }

      // Space draws at current position
      if (input === ' ' || key.return) {
        addStroke(cursorX, cursorY);
      }
    },
    { isActive: isFocused },
  );

  // Build the grid
  const strokeSet = new Set(strokes);
  const grid: string[][] = [];
  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      if (strokeSet.has(`${x},${y}`)) {
        row.push('\u2588'); // filled block
      } else {
        row.push(' ');
      }
    }
    grid.push(row);
  }

  return (
    <Box flexDirection="column">
      {/* Label */}
      <Text bold dimColor={disabled}>{label}</Text>

      {/* Canvas area */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={isFocused && !disabled ? 'cyan' : 'gray'}
      >
        {!signed && strokes.length === 0 ? (
          // Empty placeholder
          <Box height={height} width={width} justifyContent="center" alignItems="center">
            <Text dimColor>[Draw signature here]</Text>
          </Box>
        ) : (
          // Drawn strokes
          grid.map((row, y) => (
            <Box key={y}>
              {row.map((ch, x) => {
                const isCursorHere = x === cursorX && y === cursorY && isFocused;
                return (
                  <Text
                    key={x}
                    inverse={isCursorHere && !disabled}
                    color={ch !== ' ' ? 'white' : undefined}
                  >
                    {ch}
                  </Text>
                );
              })}
            </Box>
          ))
        )}
      </Box>

      {/* Controls */}
      <Box>
        <Text
          bold={isFocused}
          inverse={isFocused && signed && !disabled}
          dimColor={disabled || !signed}
        >
          {'['} Clear {']'}
        </Text>
        <Text dimColor>
          {signed ? ' Signed' : ' Not signed'}
        </Text>
      </Box>

      {/* Hint */}
      {isFocused && !disabled && (
        <Box>
          <Text dimColor>
            {'\u2190\u2191\u2192\u2193'} move {'|'} Space draw {'|'} c clear
          </Text>
        </Box>
      )}
    </Box>
  );
};

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
