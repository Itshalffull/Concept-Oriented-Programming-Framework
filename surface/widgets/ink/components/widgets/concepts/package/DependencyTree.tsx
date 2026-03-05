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

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface DepNode {
  name: string;
  version: string;
  scope?: 'runtime' | 'dev' | 'optional';
  vulnerable?: boolean;
  children?: DepNode[];
}

export interface DependencyTreeProps {
  rootPackage: string;
  dependencies: DepNode[];
  expandDepth?: number;
  showDevDeps?: boolean;
  showVulnerabilities?: boolean;
  selectedPackage?: string | undefined;
  onSelect?: (name: string) => void;
  isFocused?: boolean;
}

function flattenDeps(deps: DepNode[], depth = 0, expandDepth = 2): Array<DepNode & { depth: number }> {
  const result: Array<DepNode & { depth: number }> = [];
  for (const dep of deps) {
    result.push({ ...dep, depth });
    if (dep.children && depth < expandDepth) {
      result.push(...flattenDeps(dep.children, depth + 1, expandDepth));
    }
  }
  return result;
}

export function DependencyTree({
  rootPackage,
  dependencies,
  expandDepth = 2,
  showDevDeps = true,
  showVulnerabilities = true,
  onSelect,
  isFocused = false,
}: DependencyTreeProps) {
  const [state, send] = useReducer(dependencyTreeReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = showDevDeps ? dependencies : dependencies.filter(d => d.scope !== 'dev');
  const flat = flattenDeps(filtered, 0, expandDepth);
  const displayDeps = searchQuery
    ? flat.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : flat;

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'filtering') {
      if (key.escape) {
        send({ type: 'CLEAR' });
        setSearchQuery('');
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
        return;
      }
      if (key.return) {
        send({ type: 'CLEAR' });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery(prev => prev + input);
        return;
      }
    }

    if (input === '/' && state === 'idle') {
      send({ type: 'SEARCH' });
      setSearchQuery('');
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(displayDeps.length - 1, prev + 1));
    }
    if (key.return) {
      const dep = displayDeps[cursorIndex];
      if (dep) {
        send({ type: 'SELECT' });
        onSelect?.(dep.name);
      }
    }
    if (key.escape) send({ type: 'DESELECT' });
  });

  const SCOPE_COLORS: Record<string, string> = {
    runtime: 'green',
    dev: 'yellow',
    optional: 'gray',
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Text bold>{rootPackage}</Text>

      {state === 'filtering' && (
        <Box marginTop={1}>
          <Text color="cyan">{'\u{1F50D}'} </Text>
          <Text>{searchQuery}</Text>
          <Text color="cyan">{'\u2588'}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {displayDeps.map((dep, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const indent = dep.depth === 0 ? '' :
            '  '.repeat(dep.depth - 1) + (i < displayDeps.length - 1 ? '\u251C\u2500 ' : '\u2514\u2500 ');
          const scopeColor = SCOPE_COLORS[dep.scope ?? 'runtime'] ?? 'white';

          return (
            <Box key={`${dep.name}-${i}`}>
              <Text color={isCursor ? 'cyan' : undefined}>
                {isCursor ? '\u25B6 ' : '  '}
              </Text>
              <Text color="gray">{indent}</Text>
              <Text bold={isCursor}>{dep.name}</Text>
              <Text color="gray">@{dep.version}</Text>
              {dep.scope && dep.scope !== 'runtime' && (
                <Text color={scopeColor}> [{dep.scope}]</Text>
              )}
              {showVulnerabilities && dep.vulnerable && (
                <Text color="red"> {'\u26A0'}</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[{'\u2191\u2193'}] Nav [/] Search [Enter] Select</Text>
        </Box>
      )}
    </Box>
  );
}

export default DependencyTree;
