// ============================================================
// Clef Surface Ink Widget — PluginCard
//
// Marketplace plugin card displaying name, version, author,
// description, installed/enabled status, and action buttons.
// Terminal rendering with bordered card layout, status badge,
// and keyboard-driven install/toggle actions.
// Maps plugin-card.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface PluginCardProps {
  /** Plugin display name. */
  name: string;
  /** Short description of the plugin. */
  description: string;
  /** Current version string. */
  version: string;
  /** Plugin author or publisher. */
  author: string;
  /** Whether the plugin is installed. */
  installed: boolean;
  /** Whether the plugin is enabled (only meaningful if installed). */
  enabled: boolean;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to install or uninstall the plugin. */
  onInstall?: () => void;
  /** Callback to toggle enabled/disabled state. */
  onToggle?: () => void;
}

// --------------- Component ---------------

export const PluginCard: React.FC<PluginCardProps> = ({
  name,
  description,
  version,
  author,
  installed,
  enabled,
  isFocused = false,
  onInstall,
  onToggle,
}) => {
  // Focus items: 0 = install/uninstall button, 1 = enable/disable toggle
  const [focusIndex, setFocusIndex] = useState(0);
  const actionCount = installed ? 2 : 1;

  useInput(
    (_input, key) => {
      if (!isFocused) return;

      if (key.downArrow || key.rightArrow) {
        setFocusIndex((i) => Math.min(i + 1, actionCount - 1));
      } else if (key.upArrow || key.leftArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (focusIndex === 0) {
          onInstall?.();
        } else if (focusIndex === 1 && installed) {
          onToggle?.();
        }
      }
    },
    { isActive: isFocused },
  );

  const statusText = !installed
    ? 'Available'
    : enabled
      ? 'Enabled'
      : 'Disabled';

  const statusColor = !installed
    ? 'gray'
    : enabled
      ? 'green'
      : 'yellow';

  const installLabel = installed ? 'Uninstall' : 'Install';
  const toggleLabel = enabled ? 'Disable' : 'Enable';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Name and Version */}
      <Box>
        <Text bold>{name}</Text>
        <Text dimColor> v{version}</Text>
      </Box>

      {/* Author */}
      <Box>
        <Text dimColor>by {author}</Text>
      </Box>

      {/* Description */}
      <Box marginTop={1} marginBottom={1}>
        <Text wrap="wrap">{description}</Text>
      </Box>

      {/* Status Badge */}
      <Box marginBottom={1}>
        <Text>Status: </Text>
        <Text bold color={statusColor as any}>[{statusText}]</Text>
      </Box>

      {/* Action Buttons */}
      <Box>
        <Text
          bold={isFocused && focusIndex === 0}
          inverse={isFocused && focusIndex === 0}
          color={
            isFocused && focusIndex === 0
              ? installed ? 'red' : 'green'
              : 'gray'
          }
        >
          [ {installLabel} ]
        </Text>

        {installed && (
          <>
            <Text> </Text>
            <Text
              bold={isFocused && focusIndex === 1}
              inverse={isFocused && focusIndex === 1}
              color={isFocused && focusIndex === 1 ? 'yellow' : 'gray'}
            >
              [ {toggleLabel} ]
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};

PluginCard.displayName = 'PluginCard';
export default PluginCard;
