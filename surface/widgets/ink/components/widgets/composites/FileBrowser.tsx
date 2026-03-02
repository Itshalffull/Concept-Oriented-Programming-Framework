// ============================================================
// Clef Surface Ink Widget — FileBrowser
//
// File management interface with path breadcrumb, toggleable
// list of files and folders with type icons, size, and modified
// date. Arrow key navigation, enter to open/navigate folders.
// Terminal rendering with folder/file indicators.
// Maps file-browser.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface FileEntry {
  name: string;
  type: 'file' | 'folder';
  size: number;
  modified: string;
}

// --------------- Props ---------------

export interface FileBrowserProps {
  /** Array of file and folder entries. */
  files: FileEntry[];
  /** Current directory path. */
  currentPath: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when navigating to a folder. */
  onNavigate?: (path: string) => void;
  /** Callback when selecting/opening a file. */
  onSelect?: (file: FileEntry) => void;
}

// --------------- Helpers ---------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// --------------- Component ---------------

export const FileBrowser: React.FC<FileBrowserProps> = ({
  files,
  currentPath,
  isFocused = false,
  onNavigate,
  onSelect,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);

  const handleOpen = useCallback(
    (index: number) => {
      const file = files[index];
      if (!file) return;
      if (file.type === 'folder') {
        const newPath = currentPath.endsWith('/')
          ? `${currentPath}${file.name}`
          : `${currentPath}/${file.name}`;
        onNavigate?.(newPath);
      } else {
        onSelect?.(file);
      }
    },
    [files, currentPath, onNavigate, onSelect],
  );

  useInput(
    (_input, key) => {
      if (!isFocused || files.length === 0) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, files.length - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        handleOpen(focusIndex);
      } else if (key.backspace || key.delete) {
        // Navigate up one directory
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        onNavigate?.(parentPath);
      }
    },
    { isActive: isFocused },
  );

  // Breadcrumb segments
  const pathSegments = currentPath.split('/').filter(Boolean);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Breadcrumb */}
      <Box marginBottom={1}>
        <Text dimColor>/</Text>
        {pathSegments.map((seg, i) => (
          <Text key={i}>
            <Text dimColor>{i > 0 ? ' / ' : ' '}</Text>
            <Text bold={i === pathSegments.length - 1}>{seg}</Text>
          </Text>
        ))}
        {pathSegments.length === 0 && <Text bold> root</Text>}
      </Box>

      {/* File List Header */}
      <Box>
        <Box width={3}><Text dimColor> </Text></Box>
        <Box width={24}><Text bold underline>Name</Text></Box>
        <Box width={10}><Text bold underline>Size</Text></Box>
        <Box width={16}><Text bold underline>Modified</Text></Box>
      </Box>

      {/* File Entries */}
      {files.map((file, index) => {
        const focused = isFocused && index === focusIndex;
        const icon = file.type === 'folder' ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
        return (
          <Box key={file.name}>
            <Box width={3}>
              <Text>{icon}</Text>
            </Box>
            <Box width={24}>
              <Text
                bold={focused}
                color={focused ? 'cyan' : file.type === 'folder' ? 'blue' : undefined}
                wrap="truncate-end"
              >
                {file.name}
              </Text>
            </Box>
            <Box width={10}>
              <Text dimColor={!focused}>
                {file.type === 'folder' ? '--' : formatSize(file.size)}
              </Text>
            </Box>
            <Box width={16}>
              <Text dimColor={!focused}>{file.modified}</Text>
            </Box>
          </Box>
        );
      })}

      {files.length === 0 && (
        <Text dimColor>Empty directory.</Text>
      )}
    </Box>
  );
};

FileBrowser.displayName = 'FileBrowser';
export default FileBrowser;
