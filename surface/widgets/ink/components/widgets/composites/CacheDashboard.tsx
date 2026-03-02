// ============================================================
// Clef Surface Ink Widget — CacheDashboard
//
// Cache monitoring dashboard displaying hit/miss ratio, memory
// usage bar, and a table of cache entries with key, size, TTL,
// and hit counts. Provides evict and clear actions. Terminal
// rendering with ASCII progress bars and tabular layout.
// Maps cache-dashboard.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface CacheEntry {
  key: string;
  size: number;
  ttl: number;
  hits: number;
}

// --------------- Props ---------------

export interface CacheDashboardProps {
  /** Array of cache entries. */
  entries: CacheEntry[];
  /** Total size of all cached data in bytes. */
  totalSize: number;
  /** Maximum cache capacity in bytes. */
  maxSize: number;
  /** Overall cache hit rate (0-1). */
  hitRate: number;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to evict a specific cache entry. */
  onEvict?: (key: string) => void;
  /** Callback to clear the entire cache. */
  onClear?: () => void;
}

// --------------- Helpers ---------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function renderBar(ratio: number, width: number): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

// --------------- Component ---------------

export const CacheDashboard: React.FC<CacheDashboardProps> = ({
  entries,
  totalSize,
  maxSize,
  hitRate,
  isFocused = false,
  onEvict,
  onClear,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  // 0..entries.length-1 = entry rows, entries.length = [Clear All] button
  const totalItems = entries.length + 1;

  const handleEvict = useCallback(
    (index: number) => {
      const entry = entries[index];
      if (entry) onEvict?.(entry.key);
    },
    [entries, onEvict],
  );

  useInput(
    (_input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (focusIndex < entries.length) {
          handleEvict(focusIndex);
        } else {
          onClear?.();
        }
      }
    },
    { isActive: isFocused },
  );

  const usageRatio = maxSize > 0 ? totalSize / maxSize : 0;
  const barWidth = 20;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Stats Header */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold>Cache Dashboard</Text>
        <Box>
          <Text>Hit Rate: </Text>
          <Text color={hitRate >= 0.8 ? 'green' : hitRate >= 0.5 ? 'yellow' : 'red'}>
            {(hitRate * 100).toFixed(1)}%
          </Text>
        </Box>
        <Box>
          <Text>Usage: </Text>
          <Text color={usageRatio >= 0.9 ? 'red' : usageRatio >= 0.7 ? 'yellow' : 'green'}>
            {renderBar(usageRatio, barWidth)}
          </Text>
          <Text dimColor> {formatBytes(totalSize)}/{formatBytes(maxSize)}</Text>
        </Box>
      </Box>

      {/* Table Header */}
      <Box>
        <Box width={20}><Text bold underline>Key</Text></Box>
        <Box width={10}><Text bold underline>Size</Text></Box>
        <Box width={10}><Text bold underline>TTL</Text></Box>
        <Box width={8}><Text bold underline>Hits</Text></Box>
      </Box>

      {/* Entry Rows */}
      {entries.map((entry, index) => {
        const focused = isFocused && index === focusIndex;
        return (
          <Box key={entry.key}>
            <Box width={20}>
              <Text bold={focused} color={focused ? 'cyan' : undefined} wrap="truncate-end">
                {entry.key}
              </Text>
            </Box>
            <Box width={10}>
              <Text dimColor={!focused}>{formatBytes(entry.size)}</Text>
            </Box>
            <Box width={10}>
              <Text dimColor={!focused}>{entry.ttl}s</Text>
            </Box>
            <Box width={8}>
              <Text dimColor={!focused}>{entry.hits}</Text>
            </Box>
          </Box>
        );
      })}

      {entries.length === 0 && (
        <Text dimColor>No cache entries.</Text>
      )}

      {/* Clear All Button */}
      <Box marginTop={1}>
        <Text
          bold={isFocused && focusIndex === entries.length}
          inverse={isFocused && focusIndex === entries.length}
          color={isFocused && focusIndex === entries.length ? 'red' : 'gray'}
        >
          [ Clear All ]
        </Text>
      </Box>
    </Box>
  );
};

CacheDashboard.displayName = 'CacheDashboard';
export default CacheDashboard;
