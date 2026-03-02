// ============================================================
// Clef Surface Ink Widget — PalettePreview
//
// Renders color swatches using Ink's color support. Shows
// color name, hex value, and a visual swatch using colored
// block characters with background colors.
// ============================================================

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ColorScale, SemanticRole } from '../../shared/types.js';
import { contrastRatio } from '../../shared/surface-bridge.js';

// --------------- Scale Steps ---------------

const SCALE_STEPS = [
  '50', '100', '200', '300', '400', '500',
  '600', '700', '800', '900', '950',
] as const;

// --------------- Props ---------------

export interface PalettePreviewProps {
  /** Named colors to display. Each key is a color name, value is a hex color. */
  colors?: Record<string, string>;
  /** Color scales to display. */
  scales?: Record<string, ColorScale>;
  /** Semantic role mappings to display. */
  semanticColors?: Partial<Record<SemanticRole, string>>;
  /** Width of each color swatch in block characters. */
  swatchWidth?: number;
  /** Whether to show hex values alongside swatches. */
  showHex?: boolean;
  /** Whether to show contrast ratio against white and black. */
  showContrast?: boolean;
  /** Layout: 'horizontal' shows swatches in a row, 'vertical' in a column. */
  layout?: 'horizontal' | 'vertical';
  /** Title for the palette preview. */
  title?: string;
  /** Whether this component is focused and receives input. */
  isFocused?: boolean;
}

// --------------- Swatch Component ---------------

const ColorSwatch: React.FC<{
  name: string;
  hex: string;
  swatchWidth: number;
  showHex: boolean;
  showContrast: boolean;
  highlighted?: boolean;
}> = ({ name, hex, swatchWidth, showHex, showContrast, highlighted }) => (
  <Box>
    <Text backgroundColor={hex}>{' '.repeat(swatchWidth)}</Text>
    <Text bold={highlighted}> {name}</Text>
    {showHex && <Text dimColor>  {hex}</Text>}
    {showContrast && (
      <Text dimColor>
        {'  '}W:{contrastRatio(hex, '#ffffff').toFixed(1)} B:
        {contrastRatio(hex, '#000000').toFixed(1)}
      </Text>
    )}
  </Box>
);

// --------------- Scale Component ---------------

const ColorScaleRow: React.FC<{
  name: string;
  scale: ColorScale;
  swatchWidth: number;
  layout: 'horizontal' | 'vertical';
  showHex: boolean;
}> = ({ name, scale, swatchWidth, layout, showHex }) => {
  const entries = SCALE_STEPS.map((step) => ({
    step,
    hex: scale[step as unknown as keyof ColorScale],
  }));

  if (layout === 'horizontal') {
    return (
      <Box flexDirection="column">
        <Text bold>  {name}</Text>
        <Box>
          <Text>  </Text>
          {entries.map(({ step, hex }) => (
            <Text key={step} backgroundColor={hex}>
              {' '.repeat(swatchWidth)}
            </Text>
          ))}
        </Box>
        <Box>
          <Text dimColor>  </Text>
          {entries.map(({ step }) => (
            <Text key={step} dimColor>
              {step.padEnd(swatchWidth)}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>  {name}</Text>
      {entries.map(({ step, hex }) => (
        <Box key={step}>
          <Text>  </Text>
          <Text color={hex}>{'█'.repeat(swatchWidth)}</Text>
          <Text>  {step.padEnd(4)}</Text>
          {showHex && <Text dimColor>  {hex}</Text>}
        </Box>
      ))}
    </Box>
  );
};

// --------------- Component ---------------

export const PalettePreview: React.FC<PalettePreviewProps> = ({
  colors = {},
  scales = {},
  semanticColors = {},
  swatchWidth = 4,
  showHex = true,
  showContrast = false,
  layout = 'vertical',
  title = 'Palette',
  isFocused = false,
}) => {
  const colorEntries = [
    ...Object.entries(colors).map(([name, hex]) => ({ name, hex })),
    ...Object.entries(semanticColors)
      .filter(([, hex]) => hex)
      .map(([role, hex]) => ({ name: role, hex: hex as string })),
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => Math.min(colorEntries.length - 1, i + 1));
      }
    },
    { isActive: isFocused },
  );

  const hasColors = Object.keys(colors).length > 0;
  const hasSemanticColors = Object.keys(semanticColors).length > 0;
  const hasScales = Object.keys(scales).length > 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>{title}</Text>
      <Text dimColor>{'─'.repeat(40)}</Text>

      {hasColors && (
        <>
          <Text bold>{'\n'}Named Colors</Text>
          {Object.entries(colors).map(([name, hex], i) => (
            <ColorSwatch
              key={name}
              name={name}
              hex={hex}
              swatchWidth={swatchWidth}
              showHex={showHex}
              showContrast={showContrast}
              highlighted={isFocused && i === selectedIndex}
            />
          ))}
        </>
      )}

      {hasSemanticColors && (
        <>
          <Text bold>{'\n'}Semantic Colors</Text>
          {Object.entries(semanticColors).map(([role, hex]) =>
            hex ? (
              <ColorSwatch
                key={role}
                name={role}
                hex={hex}
                swatchWidth={swatchWidth}
                showHex={showHex}
                showContrast={showContrast}
              />
            ) : null,
          )}
        </>
      )}

      {hasScales && (
        <>
          <Text bold>{'\n'}Color Scales</Text>
          {Object.entries(scales).map(([name, scale]) => (
            <ColorScaleRow
              key={name}
              name={name}
              scale={scale}
              swatchWidth={swatchWidth}
              layout={layout}
              showHex={showHex}
            />
          ))}
        </>
      )}
    </Box>
  );
};

PalettePreview.displayName = 'PalettePreview';
export default PalettePreview;
