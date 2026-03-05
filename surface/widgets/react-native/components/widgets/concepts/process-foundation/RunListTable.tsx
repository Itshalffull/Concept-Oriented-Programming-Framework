export type RunListTableState = 'idle' | 'rowSelected';
export type RunListTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'PAGE' }
  | { type: 'DESELECT' };

export function runListTableReducer(state: RunListTableState, event: RunListTableEvent): RunListTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'PAGE') return 'idle';
      return state;
    case 'rowSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface RunListTableProps {
  runs: unknown[];
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filterStatus?: string | undefined;
}

export function RunListTable(props: RunListTableProps) {
  const [state, send] = useReducer(runListTableReducer, 'idle');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Table listing process runs with columns "
      data-widget="run-list-table"
      data-state={state}
    >
      <View>{/* filterBar: Status filter chips and search */}</View>
      <View>{/* table: Data table with sortable columns */}</View>
      <View>{/* headerRow: Column headers */}</View>
      <View>{/* dataRow: Single run row */}</View>
      <View>{/* statusCell: Status badge cell */}</View>
    </View>
  );
}

export default RunListTable;
