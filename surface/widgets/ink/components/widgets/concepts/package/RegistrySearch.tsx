export type RegistrySearchState = 'idle' | 'searching';
export type RegistrySearchEvent =
  | { type: 'INPUT' }
  | { type: 'SELECT_RESULT' }
  | { type: 'RESULTS' }
  | { type: 'CLEAR' };

export function registrySearchReducer(state: RegistrySearchState, event: RegistrySearchEvent): RegistrySearchState {
  switch (state) {
    case 'idle':
      if (event.type === 'INPUT') return 'searching';
      if (event.type === 'SELECT_RESULT') return 'idle';
      return state;
    case 'searching':
      if (event.type === 'RESULTS') return 'idle';
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface SearchResult {
  name: string;
  version: string;
  description?: string;
  downloads?: number;
  author?: string;
}

export interface RegistrySearchProps {
  query: string;
  results: SearchResult[];
  sortBy?: 'relevance' | 'downloads' | 'date';
  pageSize?: number;
  onSearch?: (query: string) => void;
  onSelect?: (name: string) => void;
  isFocused?: boolean;
}

export function RegistrySearch({
  query: initialQuery,
  results,
  sortBy = 'relevance',
  pageSize = 10,
  onSearch,
  onSelect,
  isFocused = false,
}: RegistrySearchProps) {
  const [state, send] = useReducer(registrySearchReducer, 'idle');
  const [query, setQuery] = useState(initialQuery);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const visibleResults = results.slice(0, pageSize);

  useInput((input, key) => {
    if (!isFocused) return;

    if (isEditing) {
      if (key.escape) {
        setIsEditing(false);
        return;
      }
      if (key.backspace || key.delete) {
        setQuery(prev => prev.slice(0, -1));
        return;
      }
      if (key.return) {
        setIsEditing(false);
        send({ type: 'INPUT' });
        onSearch?.(query);
        send({ type: 'RESULTS' });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setQuery(prev => prev + input);
        return;
      }
    }

    if (input === '/') {
      setIsEditing(true);
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(visibleResults.length - 1, prev + 1));
    }
    if (key.return) {
      const result = visibleResults[cursorIndex];
      if (result) {
        send({ type: 'SELECT_RESULT' });
        onSelect?.(result.name);
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Text bold>Registry Search</Text>

      {/* Search input */}
      <Box marginTop={1} borderStyle="round" borderColor={isEditing ? 'cyan' : 'gray'}>
        <Text color="cyan">{'\u{1F50D}'} </Text>
        <Text>{query || <Text color="gray">Search packages...</Text>}</Text>
        {isEditing && <Text color="cyan">{'\u2588'}</Text>}
      </Box>

      {/* Sort indicator */}
      <Box>
        <Text color="gray">Sort: {sortBy}</Text>
        {state === 'searching' && <Text color="yellow"> Searching...</Text>}
      </Box>

      {/* Results */}
      <Box flexDirection="column" marginTop={1}>
        {visibleResults.length === 0 && query && (
          <Text color="gray">No results found</Text>
        )}
        {visibleResults.map((result, i) => {
          const isCursor = i === cursorIndex && isFocused;
          return (
            <Box key={result.name} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                <Text bold>{result.name}</Text>
                <Text color="gray">@{result.version}</Text>
                {result.downloads !== undefined && (
                  <Text color="gray"> {'\u2193'}{result.downloads.toLocaleString()}</Text>
                )}
              </Box>
              {result.description && (
                <Box paddingLeft={4}>
                  <Text color="gray" wrap="truncate">{result.description}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {results.length > pageSize && (
        <Box marginTop={1}>
          <Text color="gray">Showing {pageSize} of {results.length} results</Text>
        </Box>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[/] Search [{'\u2191\u2193'}] Nav [Enter] Select</Text>
        </Box>
      )}
    </Box>
  );
}

export default RegistrySearch;
