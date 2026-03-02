// ============================================================
// Clef Surface Ink Widget — PolicyEditor
//
// Access-control policy rule editor rendered in the terminal.
// Displays a list of ALLOW/DENY rules with subject, action,
// resource fields, and supports adding/removing rules via
// keyboard navigation.
//
// Adapts the policy-editor.widget spec: anatomy (root,
// modeToggle, visualEditor, serviceSelector, actionSelector,
// resourceSelector, jsonEditor, validateButton, simulatorButton),
// states, and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface PolicyRule {
  id: string;
  subject: string;
  action: string;
  resource: string;
  effect: 'ALLOW' | 'DENY';
}

// --------------- Props ---------------

export interface PolicyEditorProps {
  /** List of policy rules. */
  rules: PolicyRule[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new rule. */
  onAdd?: () => void;
  /** Callback to remove a rule by id. */
  onRemove?: (id: string) => void;
  /** Callback when a rule changes. */
  onChange?: (id: string, rule: PolicyRule) => void;
}

// --------------- Component ---------------

export const PolicyEditor: React.FC<PolicyEditorProps> = ({
  rules,
  isFocused = false,
  onAdd,
  onRemove,
  onChange,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const totalItems = rules.length + 1;

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (selectedIndex >= rules.length) {
          onAdd?.();
        }
      } else if (key.delete || key.backspace) {
        if (selectedIndex < rules.length) {
          const rule = rules[selectedIndex];
          if (rule) onRemove?.(rule.id);
          setSelectedIndex((i) => Math.max(i - 1, 0));
        }
      } else if (input === 't' && selectedIndex < rules.length) {
        // Toggle effect
        const rule = rules[selectedIndex];
        if (rule) {
          onChange?.(rule.id, {
            ...rule,
            effect: rule.effect === 'ALLOW' ? 'DENY' : 'ALLOW',
          });
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Policy Rules</Text>
        <Text dimColor> ({rules.length} rules)</Text>
      </Box>

      {rules.map((rule, index) => {
        const isSelected = isFocused && selectedIndex === index;
        const effectColor = rule.effect === 'ALLOW' ? 'green' : 'red';

        return (
          <Box key={rule.id}>
            <Text
              inverse={isSelected}
              bold={isSelected}
              color={isSelected ? 'cyan' : undefined}
            >
              {isSelected ? '\u276F ' : '  '}
              <Text color={effectColor} bold>{rule.effect}</Text>
              {' '}
              <Text>{rule.subject}</Text>
              {' '}
              <Text color="yellow">{rule.action}</Text>
              {' '}
              <Text dimColor>{rule.resource}</Text>
            </Text>
            {isSelected && (
              <Text dimColor> [Del remove | t toggle]</Text>
            )}
          </Box>
        );
      })}

      <Box marginTop={rules.length > 0 ? 0 : 0}>
        <Text
          inverse={isFocused && selectedIndex >= rules.length}
          bold={isFocused && selectedIndex >= rules.length}
          color="green"
        >
          {isFocused && selectedIndex >= rules.length ? '\u276F ' : '  '}
          [+ Add Rule]
        </Text>
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Enter add {'  '} Del remove
            {'  '} t toggle ALLOW/DENY
          </Text>
        </Box>
      )}
    </Box>
  );
};

PolicyEditor.displayName = 'PolicyEditor';
export default PolicyEditor;
