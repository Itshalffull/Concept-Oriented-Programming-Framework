// ============================================================
// Clef Surface Ink Widget — ElevationBox
//
// Terminal box with border styling that varies by elevation
// level. Since terminals cannot render CSS shadows, elevation
// is communicated via Ink's borderStyle property:
//
//   Level 0: No border
//   Level 1: Single lines (light)
//   Level 2: Single lines
//   Level 3: Double lines
//   Level 4: Bold lines
//   Level 5: Double lines + shadow text
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';

import type { ElevationLevel } from '../../shared/types.js';

// --------------- Border Style Mapping ---------------

type InkBorderStyle =
  | 'single'
  | 'double'
  | 'round'
  | 'bold'
  | 'singleDouble'
  | 'doubleSingle'
  | 'classic'
  | 'arrow';

const ELEVATION_BORDER: Record<ElevationLevel, InkBorderStyle | null> = {
  0: null,
  1: 'round',
  2: 'single',
  3: 'double',
  4: 'bold',
  5: 'double',
};

// --------------- Props ---------------

export interface ElevationBoxProps {
  /** Elevation level (0-5). */
  level: ElevationLevel;
  /** Child nodes to render inside the box. */
  children: ReactNode;
  /** Width of the box in columns (including borders). */
  width?: number;
  /** Title text in the top border. */
  title?: string;
  /** Padding inside the box. */
  padding?: number;
  /** Border color. */
  borderColor?: string;
  /** Shadow color (for level 5). */
  shadowColor?: string;
}

// --------------- Component ---------------

export const ElevationBox: React.FC<ElevationBoxProps> = ({
  level,
  children,
  width,
  title,
  padding = 1,
  borderColor,
  shadowColor = '#444444',
}) => {
  const borderStyle = ELEVATION_BORDER[level];

  if (level === 0) {
    return (
      <Box flexDirection="column" width={width}>
        {children}
      </Box>
    );
  }

  const borderDim = level === 1;

  const content = (
    <Box
      flexDirection="column"
      borderStyle={borderStyle ?? 'single'}
      borderColor={borderColor}
      paddingX={padding}
      paddingY={padding > 0 ? 1 : 0}
      width={width}
      dimBorder={borderDim}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}
      {children}
    </Box>
  );

  if (level === 5) {
    return (
      <Box flexDirection="column">
        {content}
        <Text color={shadowColor}> {'▄'.repeat((width ?? 40) - 1)}</Text>
      </Box>
    );
  }

  return content;
};

ElevationBox.displayName = 'ElevationBox';
export default ElevationBox;
