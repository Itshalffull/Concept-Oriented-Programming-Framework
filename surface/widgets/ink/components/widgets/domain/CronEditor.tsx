// ============================================================
// Clef Surface Ink Widget — CronEditor
//
// Visual cron expression builder rendered in the terminal as
// five editable fields with a human-readable schedule summary
// below. Supports keyboard navigation between fields and
// value editing.
//
// Adapts the cron-editor.widget spec: anatomy (root, tabs,
// simpleEditor, frequencySelect, timeInput, daySelect,
// advancedEditor, cronInput, preview, nextRuns), states
// (simple, advanced), and connect attributes.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface CronEditorProps {
  /** Current cron expression value. */
  value: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the cron expression changes. */
  onChange?: (value: string) => void;
}

// --------------- Helpers ---------------

const FIELD_LABELS = ['min', 'hour', 'day', 'month', 'weekday'];

function describeCron(parts: string[]): string {
  if (parts.length !== 5) return 'Invalid cron expression';

  const [min, hour, day, month, weekday] = parts;

  if (parts.every((p) => p === '*')) return 'Every minute';
  if (min !== '*' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return `At minute ${min} of every hour`;
  }
  if (min !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
    return `Daily at ${hour}:${min.padStart(2, '0')}`;
  }
  if (weekday !== '*' && day === '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[Number(weekday)] || weekday;
    return `Every ${dayName} at ${hour || '*'}:${(min || '*').padStart(2, '0')}`;
  }
  if (day !== '*' && month === '*') {
    return `Monthly on day ${day} at ${hour || '*'}:${(min || '*').padStart(2, '0')}`;
  }

  return `${min} ${hour} ${day} ${month} ${weekday}`;
}

// --------------- Component ---------------

export const CronEditor: React.FC<CronEditorProps> = ({
  value,
  isFocused = false,
  onChange,
}) => {
  const parts = useMemo(() => {
    const p = value.split(/\s+/);
    while (p.length < 5) p.push('*');
    return p.slice(0, 5);
  }, [value]);

  const [activeField, setActiveField] = useState(0);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.rightArrow || key.tab) {
        setActiveField((i) => (i + 1) % 5);
      } else if (key.leftArrow) {
        setActiveField((i) => (i + 4) % 5);
      } else if (key.upArrow) {
        // Increment the current field value
        const current = parts[activeField];
        if (current === '*') {
          const newParts = [...parts];
          newParts[activeField] = '0';
          onChange?.(newParts.join(' '));
        } else {
          const num = parseInt(current, 10);
          if (!isNaN(num)) {
            const newParts = [...parts];
            newParts[activeField] = String(num + 1);
            onChange?.(newParts.join(' '));
          }
        }
      } else if (key.downArrow) {
        // Decrement the current field value
        const current = parts[activeField];
        if (current === '*') return;
        const num = parseInt(current, 10);
        if (!isNaN(num) && num > 0) {
          const newParts = [...parts];
          newParts[activeField] = String(num - 1);
          onChange?.(newParts.join(' '));
        } else {
          const newParts = [...parts];
          newParts[activeField] = '*';
          onChange?.(newParts.join(' '));
        }
      } else if (input === '*') {
        const newParts = [...parts];
        newParts[activeField] = '*';
        onChange?.(newParts.join(' '));
      } else if (/^\d$/.test(input)) {
        const current = parts[activeField];
        const newParts = [...parts];
        if (current === '*') {
          newParts[activeField] = input;
        } else {
          newParts[activeField] = current + input;
        }
        onChange?.(newParts.join(' '));
      } else if (key.backspace) {
        const current = parts[activeField];
        const newParts = [...parts];
        if (current.length <= 1) {
          newParts[activeField] = '*';
        } else {
          newParts[activeField] = current.slice(0, -1);
        }
        onChange?.(newParts.join(' '));
      }
    },
    { isActive: isFocused },
  );

  const summary = describeCron(parts);

  return (
    <Box flexDirection="column">
      {/* Field labels */}
      <Box gap={1}>
        {FIELD_LABELS.map((label, index) => (
          <Box key={label} width={10} justifyContent="center">
            <Text dimColor>{label}</Text>
          </Box>
        ))}
      </Box>

      {/* Field values */}
      <Box gap={1}>
        {parts.map((part, index) => {
          const isActive = isFocused && activeField === index;
          return (
            <Box
              key={index}
              width={10}
              justifyContent="center"
              borderStyle={isActive ? 'single' : undefined}
              borderColor={isActive ? 'cyan' : undefined}
            >
              <Text
                inverse={isActive}
                bold={isActive}
                color={isActive ? 'cyan' : undefined}
              >
                {part.padStart(3).padEnd(3)}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Human-readable summary */}
      <Box marginTop={1}>
        <Text color="green">{'\u23F0'} </Text>
        <Text bold>{summary}</Text>
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2190\u2192'} switch field {'  '} {'\u2191\u2193'} adjust value
            {'  '} 0-9 type {'  '} * wildcard
          </Text>
        </Box>
      )}
    </Box>
  );
};

CronEditor.displayName = 'CronEditor';
export default CronEditor;
