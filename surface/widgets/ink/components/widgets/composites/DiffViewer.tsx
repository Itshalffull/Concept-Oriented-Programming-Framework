// ============================================================
// Clef Surface Ink Widget — DiffViewer
//
// Side-by-side or unified diff viewer for comparing two text
// versions. Displays added (+, green), removed (-, red), and
// unchanged (dim) lines with line numbers. Supports unified
// and split display modes. Terminal rendering with colored
// prefix characters. Maps diff-viewer.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  oldNum: number | null;
  newNum: number | null;
  content: string;
}

// --------------- Props ---------------

export interface DiffViewerProps {
  /** Original text (before changes). */
  oldText: string;
  /** Modified text (after changes). */
  newText: string;
  /** Display mode: unified or split. */
  mode?: 'unified' | 'split';
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
}

// --------------- Helpers ---------------

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldIdx < oldLines.length ? oldLines[oldIdx] : undefined;
    const newLine = newIdx < newLines.length ? newLines[newIdx] : undefined;

    if (oldLine !== undefined && newLine !== undefined && oldLine === newLine) {
      result.push({
        type: 'unchanged',
        oldNum: oldIdx + 1,
        newNum: newIdx + 1,
        content: oldLine,
      });
      oldIdx++;
      newIdx++;
    } else if (oldLine !== undefined && (newLine === undefined || oldLine !== newLine)) {
      // Check if the old line appears later in new lines (simple heuristic)
      const futureNew = newLines.indexOf(oldLine!, newIdx);
      if (futureNew === -1 || futureNew > newIdx + 3) {
        result.push({
          type: 'removed',
          oldNum: oldIdx + 1,
          newNum: null,
          content: oldLine!,
        });
        oldIdx++;
      } else {
        // New lines before the match are additions
        while (newIdx < futureNew) {
          result.push({
            type: 'added',
            oldNum: null,
            newNum: newIdx + 1,
            content: newLines[newIdx]!,
          });
          newIdx++;
        }
      }
    } else if (newLine !== undefined) {
      result.push({
        type: 'added',
        oldNum: null,
        newNum: newIdx + 1,
        content: newLine,
      });
      newIdx++;
    }
  }

  return result;
}

function padNum(n: number | null, width: number): string {
  if (n === null) return ' '.repeat(width);
  const s = String(n);
  return ' '.repeat(Math.max(0, width - s.length)) + s;
}

// --------------- Component ---------------

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldText,
  newText,
  mode = 'unified',
  isFocused = false,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  const diffLines = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);

  const additions = useMemo(
    () => diffLines.filter((l) => l.type === 'added').length,
    [diffLines],
  );
  const deletions = useMemo(
    () => diffLines.filter((l) => l.type === 'removed').length,
    [diffLines],
  );

  const maxVisible = 20;
  const visibleLines = diffLines.slice(scrollOffset, scrollOffset + maxVisible);
  const numWidth = Math.max(3, String(diffLines.length).length);

  useInput(
    (_input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setScrollOffset((o) => Math.min(o + 1, Math.max(0, diffLines.length - maxVisible)));
      } else if (key.upArrow) {
        setScrollOffset((o) => Math.max(o - 1, 0));
      }
    },
    { isActive: isFocused },
  );

  const renderUnified = () => (
    <Box flexDirection="column">
      {visibleLines.map((line, idx) => {
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        const color = line.type === 'added' ? 'green' : line.type === 'removed' ? 'red' : undefined;
        const dim = line.type === 'unchanged';

        return (
          <Box key={`${scrollOffset + idx}`}>
            <Text dimColor>{padNum(line.oldNum, numWidth)} </Text>
            <Text dimColor>{padNum(line.newNum, numWidth)} </Text>
            <Text color={color} dimColor={dim}>
              {prefix} {line.content}
            </Text>
          </Box>
        );
      })}
    </Box>
  );

  const renderSplit = () => {
    const oldLines = diffLines.filter((l) => l.type !== 'added');
    const newLines = diffLines.filter((l) => l.type !== 'removed');
    const maxLen = Math.max(oldLines.length, newLines.length);
    const visible = Array.from({ length: Math.min(maxVisible, maxLen - scrollOffset) }, (_, i) => i + scrollOffset);

    return (
      <Box flexDirection="column">
        <Box>
          <Box width={40}><Text bold underline>Original</Text></Box>
          <Text> {'|'} </Text>
          <Box width={40}><Text bold underline>Modified</Text></Box>
        </Box>
        {visible.map((i) => {
          const left = oldLines[i];
          const right = newLines[i];
          return (
            <Box key={i}>
              <Box width={40}>
                {left ? (
                  <Text
                    color={left.type === 'removed' ? 'red' : undefined}
                    dimColor={left.type === 'unchanged'}
                    wrap="truncate-end"
                  >
                    {padNum(left.oldNum, numWidth)} {left.type === 'removed' ? '-' : ' '} {left.content}
                  </Text>
                ) : (
                  <Text> </Text>
                )}
              </Box>
              <Text dimColor> {'|'} </Text>
              <Box width={40}>
                {right ? (
                  <Text
                    color={right.type === 'added' ? 'green' : undefined}
                    dimColor={right.type === 'unchanged'}
                    wrap="truncate-end"
                  >
                    {padNum(right.newNum, numWidth)} {right.type === 'added' ? '+' : ' '} {right.content}
                  </Text>
                ) : (
                  <Text> </Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Stats Header */}
      <Box marginBottom={1}>
        <Text bold>Diff </Text>
        <Text color="green">+{additions}</Text>
        <Text> </Text>
        <Text color="red">-{deletions}</Text>
        <Text dimColor>  [{mode}]</Text>
      </Box>

      {mode === 'unified' ? renderUnified() : renderSplit()}

      {diffLines.length > maxVisible && (
        <Box marginTop={1}>
          <Text dimColor>
            Lines {scrollOffset + 1}-{Math.min(scrollOffset + maxVisible, diffLines.length)} of {diffLines.length}
          </Text>
        </Box>
      )}
    </Box>
  );
};

DiffViewer.displayName = 'DiffViewer';
export default DiffViewer;
