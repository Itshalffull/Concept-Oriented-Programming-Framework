export type EvalResultsTableState = 'idle' | 'rowSelected';
export type EvalResultsTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'DESELECT' };

export function evalResultsTableReducer(state: EvalResultsTableState, event: EvalResultsTableEvent): EvalResultsTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
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

export interface EvalResultsTableProps {
  testCases: unknown[];
  overallScore: number;
  passCount: number;
  failCount: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filterStatus?: string | undefined;
  showExpected?: boolean;
}

export function EvalResultsTable(props: EvalResultsTableProps) {
  const [state, send] = useReducer(evalResultsTableReducer, 'idle');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Results table for LLM evaluation runs sh"
      data-widget="eval-results-table"
      data-state={state}
    >
      <View>{/* summaryBar: Overall score, pass/fail counts */}</View>
      <Text>{/* Overall score as percentage */}</Text>
      <View>{/* passFailBar: Pass/fail ratio bar */}</View>
      <View>{/* table: Results data table */}</View>
      <View>{/* headerRow: Column headers */}</View>
    </View>
  );
}

export default EvalResultsTable;
