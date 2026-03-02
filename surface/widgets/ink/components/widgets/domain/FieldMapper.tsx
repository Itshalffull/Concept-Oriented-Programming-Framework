// ============================================================
// Clef Surface Ink Widget — FieldMapper
//
// Field mapping interface rendered in the terminal as two columns
// showing source fields and target fields with mapped pairs
// connected by arrows. Supports keyboard-driven mapping and
// unmapping.
//
// Adapts the field-mapper.widget spec: anatomy (root, mappingRow,
// targetField, targetLabel, mappingInput, insertFieldButton,
// fieldPicker), states, and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface FieldMapping {
  source: string;
  target: string;
}

// --------------- Props ---------------

export interface FieldMapperProps {
  /** Available source fields. */
  sourceFields: string[];
  /** Available target fields. */
  targetFields: string[];
  /** Current field mappings. */
  mappings: FieldMapping[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to create a mapping. */
  onMap?: (source: string, target: string) => void;
  /** Callback to remove a mapping. */
  onUnmap?: (source: string, target: string) => void;
}

// --------------- Component ---------------

export const FieldMapper: React.FC<FieldMapperProps> = ({
  sourceFields,
  targetFields,
  mappings,
  isFocused = false,
  onMap,
  onUnmap,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const totalItems = mappings.length + 1; // mappings + add button

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (selectedIndex >= mappings.length) {
          // Auto-map first unmapped source to first unmapped target
          const mappedSources = new Set(mappings.map((m) => m.source));
          const mappedTargets = new Set(mappings.map((m) => m.target));
          const unmappedSource = sourceFields.find((s) => !mappedSources.has(s));
          const unmappedTarget = targetFields.find((t) => !mappedTargets.has(t));
          if (unmappedSource && unmappedTarget) {
            onMap?.(unmappedSource, unmappedTarget);
          }
        }
      } else if (key.delete || key.backspace) {
        if (selectedIndex < mappings.length) {
          const mapping = mappings[selectedIndex];
          if (mapping) onUnmap?.(mapping.source, mapping.target);
          setSelectedIndex((i) => Math.max(i - 1, 0));
        }
      }
    },
    { isActive: isFocused },
  );

  // Find the max field name length for alignment
  const maxSourceLen = Math.max(...sourceFields.map((s) => s.length), 6);
  const maxTargetLen = Math.max(...targetFields.map((t) => t.length), 6);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box gap={1}>
        <Box width={maxSourceLen + 2}>
          <Text bold underline>Source</Text>
        </Box>
        <Text dimColor>   </Text>
        <Box width={maxTargetLen + 2}>
          <Text bold underline>Target</Text>
        </Box>
      </Box>

      {/* Mapped pairs */}
      {mappings.map((mapping, index) => {
        const isSelected = isFocused && selectedIndex === index;
        return (
          <Box key={`${mapping.source}-${mapping.target}`} gap={1}>
            <Text
              inverse={isSelected}
              bold={isSelected}
              color={isSelected ? 'cyan' : undefined}
            >
              {isSelected ? '\u276F' : ' '}
              {mapping.source.padEnd(maxSourceLen)}
            </Text>
            <Text color="green"> \u2192 </Text>
            <Text
              inverse={isSelected}
              bold={isSelected}
              color={isSelected ? 'cyan' : undefined}
            >
              {mapping.target}
            </Text>
            {isSelected && <Text dimColor> [Del to unmap]</Text>}
          </Box>
        );
      })}

      {/* Unmapped fields */}
      {sourceFields
        .filter((s) => !mappings.some((m) => m.source === s))
        .length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            Unmapped: {sourceFields.filter((s) => !mappings.some((m) => m.source === s)).join(', ')}
          </Text>
        </Box>
      )}

      {/* Add mapping button */}
      <Box marginTop={1}>
        <Text
          inverse={isFocused && selectedIndex >= mappings.length}
          bold={isFocused && selectedIndex >= mappings.length}
          color="green"
        >
          {isFocused && selectedIndex >= mappings.length ? '\u276F ' : '  '}
          [+ Map]
        </Text>
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Enter map {'  '} Del unmap
          </Text>
        </Box>
      )}
    </Box>
  );
};

FieldMapper.displayName = 'FieldMapper';
export default FieldMapper;
