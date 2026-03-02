// ============================================================
// Clef Surface Ink Widget — PermissionMatrix
//
// Role-based access control grid mapping roles (columns)
// against permissions (rows). Each intersection cell contains
// a checkbox toggle [x]/[ ]. Supports keyboard grid navigation.
// Terminal rendering with ASCII table layout.
// Maps permission-matrix.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface PermissionMatrixProps {
  /** Array of role names (displayed as column headers). */
  roles: string[];
  /** Array of permission names (displayed as row labels). */
  permissions: string[];
  /** Nested map: matrix[permission][role] = boolean. */
  matrix: Record<string, Record<string, boolean>>;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a permission toggle is changed. */
  onChange?: (permission: string, role: string, granted: boolean) => void;
}

// --------------- Component ---------------

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  roles,
  permissions,
  matrix,
  isFocused = false,
  onChange,
}) => {
  const [focusRow, setFocusRow] = useState(0);
  const [focusCol, setFocusCol] = useState(0);

  const handleToggle = useCallback(
    (row: number, col: number) => {
      const perm = permissions[row];
      const role = roles[col];
      if (perm === undefined || role === undefined) return;
      const current = matrix[perm]?.[role] ?? false;
      onChange?.(perm, role, !current);
    },
    [permissions, roles, matrix, onChange],
  );

  useInput(
    (input, key) => {
      if (!isFocused || permissions.length === 0 || roles.length === 0) return;

      if (key.downArrow) {
        setFocusRow((r) => Math.min(r + 1, permissions.length - 1));
      } else if (key.upArrow) {
        setFocusRow((r) => Math.max(r - 1, 0));
      } else if (key.rightArrow) {
        setFocusCol((c) => Math.min(c + 1, roles.length - 1));
      } else if (key.leftArrow) {
        setFocusCol((c) => Math.max(c - 1, 0));
      } else if (key.return || input === ' ') {
        handleToggle(focusRow, focusCol);
      }
    },
    { isActive: isFocused },
  );

  const labelWidth = Math.max(16, ...permissions.map((p) => p.length + 2));
  const colWidth = Math.max(8, ...roles.map((r) => r.length + 2));

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Header Row */}
      <Box>
        <Box width={labelWidth}>
          <Text bold>Permission</Text>
        </Box>
        {roles.map((role, ci) => (
          <Box key={role} width={colWidth}>
            <Text bold underline>{role}</Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>{'\u2500'.repeat(labelWidth + colWidth * roles.length)}</Text>
      </Box>

      {/* Permission Rows */}
      {permissions.map((perm, ri) => (
        <Box key={perm}>
          <Box width={labelWidth}>
            <Text
              bold={isFocused && ri === focusRow}
              color={isFocused && ri === focusRow ? 'cyan' : undefined}
            >
              {perm}
            </Text>
          </Box>
          {roles.map((role, ci) => {
            const granted = matrix[perm]?.[role] ?? false;
            const focused = isFocused && ri === focusRow && ci === focusCol;
            return (
              <Box key={role} width={colWidth}>
                <Text
                  bold={focused}
                  color={focused ? 'cyan' : granted ? 'green' : 'gray'}
                  inverse={focused}
                >
                  {granted ? '[x]' : '[ ]'}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      {permissions.length === 0 && (
        <Text dimColor>No permissions defined.</Text>
      )}
    </Box>
  );
};

PermissionMatrix.displayName = 'PermissionMatrix';
export default PermissionMatrix;
