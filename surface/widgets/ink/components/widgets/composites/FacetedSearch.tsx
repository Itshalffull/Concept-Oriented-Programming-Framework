// ============================================================
// Clef Surface Ink Widget — FacetedSearch
//
// Full-featured search interface with a text query input, facet
// filters on the left with [x] checkbox toggles, and a results
// list on the right. Supports grouped facet options and active
// filter display. Terminal rendering with keyboard navigation.
// Maps faceted-search.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface FacetOption {
  label: string;
  value: string;
  selected?: boolean;
}

export interface Facet {
  name: string;
  options: FacetOption[];
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
}

// --------------- Props ---------------

export interface FacetedSearchProps {
  /** Current search query string. */
  query: string;
  /** Array of facet filter groups. */
  facets: Facet[];
  /** Array of search results. */
  results: SearchResult[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the query text changes. */
  onQueryChange?: (query: string) => void;
  /** Callback when a facet option is toggled. */
  onFacetChange?: (facetName: string, optionValue: string, selected: boolean) => void;
  /** Callback when a search result is selected. */
  onSelect?: (result: SearchResult) => void;
}

// --------------- Component ---------------

type FocusZone = 'facets' | 'results';

export const FacetedSearch: React.FC<FacetedSearchProps> = ({
  query,
  facets,
  results,
  isFocused = false,
  onQueryChange,
  onFacetChange,
  onSelect,
}) => {
  const [zone, setZone] = useState<FocusZone>('facets');
  const [facetIndex, setFacetIndex] = useState(0);
  const [resultIndex, setResultIndex] = useState(0);

  // Flatten facet options for linear navigation
  const flatFacets = facets.flatMap((f) =>
    f.options.map((o) => ({ facetName: f.name, ...o })),
  );

  const handleFacetToggle = useCallback(
    (index: number) => {
      const item = flatFacets[index];
      if (item) {
        onFacetChange?.(item.facetName, item.value, !item.selected);
      }
    },
    [flatFacets, onFacetChange],
  );

  const handleResultSelect = useCallback(
    (index: number) => {
      const result = results[index];
      if (result) onSelect?.(result);
    },
    [results, onSelect],
  );

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.tab) {
        setZone((z) => (z === 'facets' ? 'results' : 'facets'));
        return;
      }

      if (zone === 'facets') {
        if (key.downArrow) {
          setFacetIndex((i) => Math.min(i + 1, flatFacets.length - 1));
        } else if (key.upArrow) {
          setFacetIndex((i) => Math.max(i - 1, 0));
        } else if (key.return || input === ' ') {
          handleFacetToggle(facetIndex);
        }
      } else {
        if (key.downArrow) {
          setResultIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (key.upArrow) {
          setResultIndex((i) => Math.max(i - 1, 0));
        } else if (key.return) {
          handleResultSelect(resultIndex);
        }
      }
    },
    { isActive: isFocused },
  );

  // Track which facet group each flat index belongs to
  let currentGroup = '';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Search Input */}
      <Box marginBottom={1}>
        <Text dimColor>Search: </Text>
        <Text bold>{query || ''}</Text>
        <Text dimColor>{query ? '' : '(empty)'}</Text>
      </Box>

      <Box>
        {/* Facet Sidebar */}
        <Box flexDirection="column" width={30} marginRight={2}>
          <Text bold underline>Filters</Text>
          {flatFacets.map((item, index) => {
            const showGroup = item.facetName !== currentGroup;
            if (showGroup) currentGroup = item.facetName;
            const focused = isFocused && zone === 'facets' && index === facetIndex;
            return (
              <Box key={`${item.facetName}-${item.value}`} flexDirection="column">
                {showGroup && (
                  <Box marginTop={1}>
                    <Text bold dimColor>{item.facetName}</Text>
                  </Box>
                )}
                <Box>
                  <Text color={focused ? 'cyan' : undefined}>
                    {item.selected ? '[x]' : '[ ]'}{' '}
                  </Text>
                  <Text bold={focused} color={focused ? 'cyan' : undefined}>
                    {item.label}
                  </Text>
                </Box>
              </Box>
            );
          })}
          {flatFacets.length === 0 && <Text dimColor>No filters</Text>}
        </Box>

        {/* Results List */}
        <Box flexDirection="column" flexGrow={1}>
          <Text bold underline>Results ({results.length})</Text>
          {results.length === 0 && (
            <Box marginTop={1}>
              <Text dimColor>No results found.</Text>
            </Box>
          )}
          {results.map((result, index) => {
            const focused = isFocused && zone === 'results' && index === resultIndex;
            return (
              <Box key={result.id} flexDirection="column" marginTop={index === 0 ? 1 : 0}>
                <Box>
                  <Text bold={focused} color={focused ? 'cyan' : undefined}>
                    {focused ? '\u25B6 ' : '  '}{result.title}
                  </Text>
                </Box>
                {result.description && (
                  <Box marginLeft={2}>
                    <Text dimColor wrap="truncate-end">{result.description}</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

FacetedSearch.displayName = 'FacetedSearch';
export default FacetedSearch;
