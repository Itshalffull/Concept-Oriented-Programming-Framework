export type ArtifactPanelState = 'open' | 'copied' | 'fullscreen' | 'closed';
export type ArtifactPanelEvent =
  | { type: 'COPY' }
  | { type: 'FULLSCREEN' }
  | { type: 'CLOSE' }
  | { type: 'VERSION_CHANGE' }
  | { type: 'COPY_TIMEOUT' }
  | { type: 'EXIT_FULLSCREEN' }
  | { type: 'OPEN' };

export function artifactPanelReducer(state: ArtifactPanelState, event: ArtifactPanelEvent): ArtifactPanelState {
  switch (state) {
    case 'open':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'FULLSCREEN') return 'fullscreen';
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'VERSION_CHANGE') return 'open';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'open';
      return state;
    case 'fullscreen':
      if (event.type === 'EXIT_FULLSCREEN') return 'open';
      if (event.type === 'CLOSE') return 'closed';
      return state;
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

const TYPE_ICONS: Record<string, string> = {
  code: '\u2630',
  document: '\u2637',
  image: '\u25A3',
  html: '\u2316',
};

export interface ArtifactPanelProps {
  content: string;
  artifactType: string;
  title: string;
  showVersions?: boolean;
  defaultWidth?: string;
  resizable?: boolean;
  versions?: string[];
  currentVersion?: number;
  onVersionChange?: (index: number) => void;
  onClose?: () => void;
  onCopy?: () => void;
  isFocused?: boolean;
}

export function ArtifactPanel({
  content,
  artifactType,
  title,
  showVersions = false,
  versions = [],
  currentVersion = 0,
  onVersionChange,
  onClose,
  onCopy,
  isFocused = false,
}: ArtifactPanelProps) {
  const [state, send] = useReducer(artifactPanelReducer, 'open');

  useEffect(() => {
    if (state === 'copied') {
      const timer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  useInput((input, key) => {
    if (!isFocused) return;
    if (input === 'c') {
      send({ type: 'COPY' });
      onCopy?.();
    }
    if (input === 'f') {
      if (state === 'fullscreen') send({ type: 'EXIT_FULLSCREEN' });
      else if (state === 'open') send({ type: 'FULLSCREEN' });
    }
    if (input === 'q' || key.escape) {
      if (state === 'fullscreen') send({ type: 'EXIT_FULLSCREEN' });
      else {
        send({ type: 'CLOSE' });
        onClose?.();
      }
    }
    if (input === 'o' && state === 'closed') send({ type: 'OPEN' });
    if (key.leftArrow && showVersions && currentVersion > 0) {
      send({ type: 'VERSION_CHANGE' });
      onVersionChange?.(currentVersion - 1);
    }
    if (key.rightArrow && showVersions && currentVersion < versions.length - 1) {
      send({ type: 'VERSION_CHANGE' });
      onVersionChange?.(currentVersion + 1);
    }
  });

  if (state === 'closed') {
    return (
      <Box>
        <Text color="gray">[Artifact: {title}]</Text>
        {isFocused && <Text color="gray"> [o] Open</Text>}
      </Box>
    );
  }

  const icon = TYPE_ICONS[artifactType] ?? '\u25A1';

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={state === 'fullscreen' ? 'yellow' : isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Box>
          <Text>{icon} </Text>
          <Text bold>{title}</Text>
          <Text color="gray"> ({artifactType})</Text>
        </Box>
        <Box>
          {state === 'copied' && <Text color="green">{'\u2713'} Copied </Text>}
          {state === 'fullscreen' && <Text color="yellow">[FULL] </Text>}
        </Box>
      </Box>

      {showVersions && versions.length > 1 && (
        <Box>
          <Text color="gray">Version: </Text>
          <Text>{currentVersion + 1}/{versions.length}</Text>
          <Text color="gray"> [{'\u2190\u2192'}]</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1} paddingLeft={1}>
        {content.split('\n').map((line, i) => (
          <Text key={i} wrap="wrap">{line}</Text>
        ))}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[c]opy [f]ullscreen [q] Close</Text>
        </Box>
      )}
    </Box>
  );
}

export default ArtifactPanel;
