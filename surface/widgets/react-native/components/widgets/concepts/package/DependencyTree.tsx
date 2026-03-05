export type DependencyTreeState = 'idle' | 'nodeSelected' | 'filtering';
export type DependencyTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'SEARCH' }
  | { type: 'FILTER_SCOPE' }
  | { type: 'DESELECT' }
  | { type: 'CLEAR' };

export function dependencyTreeReducer(state: DependencyTreeState, event: DependencyTreeEvent): DependencyTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'nodeSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'FILTER_SCOPE') return 'idle';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'nodeSelected';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface DependencyTreeProps {
  rootPackage: string;
  dependencies: unknown[];
  expandDepth?: number;
  showDevDeps?: boolean;
  showVulnerabilities?: boolean;
  selectedPackage?: string | undefined;
}

export function DependencyTree(props: DependencyTreeProps) {
  const [state, send] = useReducer(dependencyTreeReducer, 'idle');

  return (
    <View
      accessibilityRole="list"
      accessibilityLabel="Interactive dependency tree viewer for p"
      data-widget="dependency-tree"
      data-state={state}
    >
      <View>{/* searchBar: Filter dependencies by name */}</View>
      <View>{/* scopeFilter: Scope filter chips (runtime, dev, optional) */}</View>
      <View>{/* tree: Collapsible dependency tree */}</View>
      <View>{/* treeNode: Single dependency node */}</View>
      <Text>{/* Package name */}</Text>
    </View>
  );
}

export default DependencyTree;
