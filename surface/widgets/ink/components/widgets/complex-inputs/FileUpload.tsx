// ============================================================
// Clef Surface Ink Widget — FileUpload
//
// File selection indicator for the terminal. Since terminals
// cannot open native file pickers, this renders a styled
// browse button and displays the currently selected file info.
// Maps the file-upload.widget anatomy (root, dropzone,
// dropzoneLabel, fileList, fileItem, fileName, fileSize,
// fileRemove) and states (dropzone, upload, fileItem) to a
// keyboard-driven terminal representation.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface FileInfo {
  /** File name. */
  name: string;
  /** File size in bytes. */
  size: number;
}

// --------------- Props ---------------

export interface FileUploadProps {
  /** Accepted file type extensions (e.g. [".png", ".jpg"]). */
  accept?: string[];
  /** Maximum file size in bytes. */
  maxSize?: number;
  /** Whether multiple files can be selected. */
  multiple?: boolean;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Currently selected files (controlled). */
  files?: FileInfo[];
  /** Called when files are selected or removed. */
  onSelect?: (files: FileInfo[]) => void;
}

// --------------- Helpers ---------------

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// --------------- Component ---------------

export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxSize,
  multiple = false,
  disabled = false,
  isFocused = false,
  files: controlledFiles,
  onSelect,
}) => {
  const [internalFiles, setInternalFiles] = useState<FileInfo[]>(controlledFiles ?? []);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const files = controlledFiles !== undefined ? controlledFiles : internalFiles;

  useEffect(() => {
    if (controlledFiles !== undefined) {
      setInternalFiles(controlledFiles);
    }
  }, [controlledFiles]);

  const removeFile = useCallback(
    (index: number) => {
      if (disabled) return;
      const next = files.filter((_, i) => i !== index);
      setInternalFiles(next);
      onSelect?.(next);
      if (selectedIndex >= next.length && next.length > 0) {
        setSelectedIndex(next.length - 1);
      }
    },
    [disabled, files, selectedIndex, onSelect],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (files.length > 0) {
        if (key.upArrow) {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (key.downArrow) {
          setSelectedIndex((i) => Math.min(files.length - 1, i + 1));
          return;
        }
        if (key.delete || key.backspace || input === 'd') {
          removeFile(selectedIndex);
          return;
        }
      }

      // Enter triggers simulated browse (emits onSelect with placeholder)
      if (key.return) {
        onSelect?.(files);
      }
    },
    { isActive: isFocused },
  );

  const hasFiles = files.length > 0;
  const acceptStr = accept ? accept.join(', ') : '*';

  return (
    <Box flexDirection="column">
      {/* Browse button area */}
      <Box>
        <Text
          bold={isFocused}
          inverse={isFocused && !disabled}
          dimColor={disabled}
        >
          {'['} {'\uD83D\uDCC1'} Browse... {']'}
        </Text>
        {!hasFiles && (
          <Text dimColor> No file selected</Text>
        )}
      </Box>

      {/* File constraints info */}
      <Box>
        <Text dimColor>
          Accepts: {acceptStr}
          {maxSize ? ` (max ${formatFileSize(maxSize)})` : ''}
          {multiple ? ' [multiple]' : ''}
        </Text>
      </Box>

      {/* File list */}
      {hasFiles && (
        <Box flexDirection="column" marginTop={1}>
          {files.map((file, idx) => {
            const isSelected = idx === selectedIndex && isFocused;
            return (
              <Box key={`${file.name}-${idx}`}>
                <Text
                  bold={isSelected}
                  inverse={isSelected && !disabled}
                >
                  {isSelected ? '\u25BA ' : '  '}
                </Text>
                <Text bold>{file.name}</Text>
                <Text dimColor> ({formatFileSize(file.size)})</Text>
                {isSelected && !disabled && (
                  <Text color="red"> [d:remove]</Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Hint */}
      {isFocused && !disabled && hasFiles && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'|'} d remove file
          </Text>
        </Box>
      )}
    </Box>
  );
};

FileUpload.displayName = 'FileUpload';
export default FileUpload;
