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

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface RegistrySearchProps {
  query: string;
  results: unknown[];
  sortBy?: "relevance" | "downloads" | "date";
  pageSize?: number;
}

export function RegistrySearch(props: RegistrySearchProps) {
  const [state, send] = useReducer(registrySearchReducer, 'idle');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Search interface for the package registr"
      data-widget="registry-search"
      data-state={state}
    >
      <View>{/* searchInput: Search input with type-ahead */}</View>
      <View>{/* suggestions: Type-ahead suggestion dropdown */}</View>
      <View>{/* filterBar: Keyword and sort controls */}</View>
      <View>{/* resultList: Search result cards */}</View>
      <View>{/* resultCard: Single package result */}</View>
    </View>
  );
}

export default RegistrySearch;
