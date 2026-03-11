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

import React, { forwardRef, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet, ActivityIndicator } from 'react-native';

export interface RegistrySearchResult {
  name: string;
  version: string;
  description: string;
  downloads?: number;
  author?: string;
  keywords?: string[];
}

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export interface RegistrySearchProps {
  query: string;
  results: RegistrySearchResult[];
  sortBy?: 'relevance' | 'downloads' | 'date';
  pageSize?: number;
  loading?: boolean;
  placeholder?: string;
  onSearch?: (query: string) => void;
  onSelect?: (packageName: string) => void;
  onKeywordClick?: (keyword: string) => void;
  children?: ReactNode;
}

const DEBOUNCE_MS = 200;

const RegistrySearch = forwardRef<View, RegistrySearchProps>(function RegistrySearch(
  {
    query,
    results,
    sortBy = 'relevance',
    pageSize = 20,
    loading = false,
    placeholder = 'Search packages\u2026',
    onSearch,
    onSelect,
    onKeywordClick,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(registrySearchReducer, 'idle');
  const [internalQuery, setInternalQuery] = useState(query);
  const [page, setPage] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInternalQuery(query);
  }, [query]);

  useEffect(() => {
    if (state === 'searching' && !loading && results.length >= 0) {
      send({ type: 'RESULTS' });
    }
  }, [results, loading, state]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const paginatedResults = useMemo(() => {
    const start = page * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, page, pageSize]);

  const handleInputChange = useCallback((value: string) => {
    setInternalQuery(value);
    setPage(0);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim()) {
      send({ type: 'INPUT' });
      debounceRef.current = setTimeout(() => {
        onSearch?.(value);
      }, DEBOUNCE_MS);
    } else {
      send({ type: 'CLEAR' });
      onSearch?.('');
    }
  }, [onSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelect = useCallback((packageName: string) => {
    send({ type: 'SELECT_RESULT' });
    onSelect?.(packageName);
  }, [onSelect]);

  const handleKeywordClick = useCallback((keyword: string) => {
    setInternalQuery(keyword);
    setPage(0);
    send({ type: 'INPUT' });
    onKeywordClick?.(keyword);
    onSearch?.(keyword);
  }, [onKeywordClick, onSearch]);

  const renderResult = useCallback(({ item }: { item: RegistrySearchResult }) => (
    <Pressable
      onPress={() => handleSelect(item.name)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}@${item.version}`}
      style={s.resultItem}
    >
      <View style={s.resultHeader}>
        <Text style={s.resultName}>{item.name}</Text>
        <Text style={s.resultVersion}>{item.version}</Text>
      </View>
      <Text style={s.resultDesc} numberOfLines={2}>{item.description}</Text>
      <View style={s.resultMeta}>
        {item.downloads != null && (
          <Text style={s.downloads} accessibilityLabel={`${item.downloads} downloads`}>
            {formatDownloads(item.downloads)} downloads
          </Text>
        )}
        {item.author && <Text style={s.author}>{item.author}</Text>}
      </View>
      {item.keywords && item.keywords.length > 0 && (
        <View style={s.keywordsRow}>
          {item.keywords.map((kw) => (
            <Pressable
              key={kw}
              onPress={() => handleKeywordClick(kw)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by keyword: ${kw}`}
              style={s.keywordChip}
            >
              <Text style={s.keywordText}>{kw}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Pressable>
  ), [handleSelect, handleKeywordClick]);

  return (
    <View ref={ref} testID="registry-search" accessibilityRole="search" accessibilityLabel="Package registry search" style={s.root}>
      {/* Search input */}
      <TextInput
        style={s.searchInput}
        placeholder={placeholder}
        value={internalQuery}
        onChangeText={handleInputChange}
        accessibilityLabel="Search packages"
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Loading indicator */}
      {loading && (
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={s.loadingText}>Loading results...</Text>
        </View>
      )}

      {/* Result list */}
      <FlatList
        data={paginatedResults}
        keyExtractor={(item) => `${item.name}@${item.version}`}
        renderItem={renderResult}
        style={s.resultList}
        accessibilityRole="list"
        accessibilityLabel="Search results"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={s.pagination} accessibilityRole="none" accessibilityLabel="Search result pages">
          <Pressable
            onPress={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            style={[s.pageButton, page === 0 && s.pageButtonDisabled]}
          >
            <Text style={s.pageButtonText}>Previous</Text>
          </Pressable>
          <Text style={s.pageInfo}>Page {page + 1} of {totalPages}</Text>
          <Pressable
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            accessibilityRole="button"
            accessibilityLabel="Next page"
            style={[s.pageButton, page >= totalPages - 1 && s.pageButtonDisabled]}
          >
            <Text style={s.pageButtonText}>Next</Text>
          </Pressable>
        </View>
      )}

      {/* Empty states */}
      {!loading && internalQuery.trim() !== '' && results.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No packages found for "{internalQuery}". Try a different search term.</Text>
        </View>
      )}
      {!loading && internalQuery.trim() === '' && results.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>Enter a search term to find packages.</Text>
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12, flex: 1 },
  searchInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 10, fontSize: 14, marginBottom: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { fontSize: 13, color: '#6b7280' },
  resultList: { flex: 1 },
  resultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  resultHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  resultName: { fontSize: 14, fontWeight: '700', color: '#1e40af' },
  resultVersion: { fontSize: 12, color: '#6b7280' },
  resultDesc: { fontSize: 13, color: '#374151', marginBottom: 4 },
  resultMeta: { flexDirection: 'row', gap: 12 },
  downloads: { fontSize: 11, color: '#6b7280' },
  author: { fontSize: 11, color: '#6b7280' },
  keywordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  keywordChip: { backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  keywordText: { fontSize: 11, color: '#4b5563' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  pageButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 4 },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { fontSize: 13, fontWeight: '600' },
  pageInfo: { fontSize: 13, color: '#6b7280' },
  emptyState: { padding: 16, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
});

RegistrySearch.displayName = 'RegistrySearch';
export { RegistrySearch };
export default RegistrySearch;
