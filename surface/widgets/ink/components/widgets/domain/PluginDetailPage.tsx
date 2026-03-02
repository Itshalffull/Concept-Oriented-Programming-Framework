// ============================================================
// Clef Surface Ink Widget — PluginDetailPage
//
// Plugin marketplace detail page rendered in the terminal with
// a header section showing name, version, and author, followed
// by description text, scrollable readme content, and action
// buttons for install/uninstall and enable/disable.
//
// Adapts the plugin-detail-page.widget spec: anatomy (root,
// hero, heroIcon, heroTitle, heroStats, installButton, tabs,
// descriptionTab, screenshotsTab, reviewsTab, changelogTab),
// states, and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface PluginDetailPageProps {
  /** Plugin display name. */
  name: string;
  /** Plugin version string. */
  version: string;
  /** Plugin author name. */
  author: string;
  /** Short description of the plugin. */
  description: string;
  /** Full readme content. */
  readme?: string;
  /** Whether the plugin is installed. */
  installed?: boolean;
  /** Whether the plugin is enabled. */
  enabled?: boolean;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to install/uninstall the plugin. */
  onInstall?: () => void;
  /** Callback to toggle enable/disable. */
  onToggle?: () => void;
}

// --------------- Component ---------------

export const PluginDetailPage: React.FC<PluginDetailPageProps> = ({
  name,
  version,
  author,
  description,
  readme,
  installed = false,
  enabled = false,
  isFocused = false,
  onInstall,
  onToggle,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusedButton, setFocusedButton] = useState<'install' | 'toggle'>('install');

  const readmeLines = (readme || '').split('\n');
  const maxVisible = 10;

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setScrollOffset((o) => Math.min(o + 1, Math.max(0, readmeLines.length - maxVisible)));
      } else if (key.upArrow) {
        setScrollOffset((o) => Math.max(o - 1, 0));
      } else if (key.tab) {
        setFocusedButton((b) => b === 'install' ? 'toggle' : 'install');
      } else if (key.return) {
        if (focusedButton === 'install') {
          onInstall?.();
        } else {
          onToggle?.();
        }
      }
    },
    { isActive: isFocused },
  );

  const installLabel = installed ? 'Uninstall' : 'Install';
  const toggleLabel = enabled ? 'Disable' : 'Enable';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? 'cyan' : 'gray'} paddingX={1}>
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="cyan">{name}</Text>
          <Text dimColor>@{version}</Text>
        </Box>
        <Box>
          <Text dimColor>by </Text>
          <Text>{author}</Text>
        </Box>
        {installed && (
          <Box>
            <Text color={enabled ? 'green' : 'yellow'}>
              {enabled ? '\u2713 Enabled' : '\u25CB Disabled'}
            </Text>
          </Box>
        )}
      </Box>

      {/* Description */}
      <Box marginBottom={1}>
        <Text>{description}</Text>
      </Box>

      {/* Readme */}
      {readme && (
        <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold dimColor>README</Text>
          {readmeLines.slice(scrollOffset, scrollOffset + maxVisible).map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          {readmeLines.length > maxVisible && (
            <Text dimColor>
              [{scrollOffset + 1}-{Math.min(scrollOffset + maxVisible, readmeLines.length)}/{readmeLines.length}]
              {' '}{'\u2191\u2193'} scroll
            </Text>
          )}
        </Box>
      )}

      {/* Action buttons */}
      <Box gap={2}>
        <Text
          inverse={isFocused && focusedButton === 'install'}
          bold={isFocused && focusedButton === 'install'}
          color={installed ? 'red' : 'green'}
        >
          [ {installLabel} ]
        </Text>
        {installed && (
          <Text
            inverse={isFocused && focusedButton === 'toggle'}
            bold={isFocused && focusedButton === 'toggle'}
            color={enabled ? 'yellow' : 'green'}
          >
            [ {toggleLabel} ]
          </Text>
        )}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            Tab switch button {'  '} Enter activate {'  '} {'\u2191\u2193'} scroll readme
          </Text>
        </Box>
      )}
    </Box>
  );
};

PluginDetailPage.displayName = 'PluginDetailPage';
export default PluginDetailPage;
