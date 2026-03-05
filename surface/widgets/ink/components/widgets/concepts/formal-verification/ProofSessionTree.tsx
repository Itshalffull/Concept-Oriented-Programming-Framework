/* ---------------------------------------------------------------------------
 * ProofSessionTree — Ink (terminal) implementation
 * Hierarchical tree view displaying proof goals and their status
 * See widget spec: proof-session-tree.widget
 * ------------------------------------------------------------------------- */

export type ProofSessionTreeState = 'idle' | 'selected' | 'ready' | 'fetching';
export type ProofSessionTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' }
  | { type: 'LOAD_CHILDREN' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' };

export function proofSessionTreeReducer(state: ProofSessionTreeState, event: ProofSessionTreeEvent): ProofSessionTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'ready':
      if (event.type === 'LOAD_CHILDREN') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      if (event.type === 'LOAD_ERROR') return 'ready';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ProofGoal {
  id: string;
  label: string;
  status: 'open' | 'proved' | 'failed' | 'skipped';
  tactic?: string;
  children?: ProofGoal[];
  progress?: number;
}

const STATUS_ICONS: Record<ProofGoal['status'], string> = {
  proved: '\u2713',
  failed: '\u2717',
  open: '\u25CB',
  skipped: '\u2298',
};

const STATUS_COLORS: Record<ProofGoal['status'], string> = {
  proved: 'green',
  failed: 'red',
  open: 'yellow',
  skipped: 'gray',
};

const STATUS_LABELS: Record<ProofGoal['status'], string> = {
  proved: 'Proved',
  failed: 'Failed',
  open: 'Open',
  skipped: 'Skipped',
};

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function flattenVisible(goals: ProofGoal[], expandedSet: Set<string>): ProofGoal[] {
  const result: ProofGoal[] = [];
  function walk(nodes: ProofGoal[]) {
    for (const goal of nodes) {
      result.push(goal);
      if (goal.children?.length && expandedSet.has(goal.id)) {
        walk(goal.children);
      }
    }
  }
  walk(goals);
  return result;
}

function findGoal(goals: ProofGoal[], id: string): ProofGoal | undefined {
  for (const goal of goals) {
    if (goal.id === id) return goal;
    if (goal.children?.length) {
      const found = findGoal(goal.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function countGoals(goals: ProofGoal[]): { total: number; proved: number } {
  let total = 0;
  let proved = 0;
  function walk(nodes: ProofGoal[]) {
    for (const goal of nodes) {
      total++;
      if (goal.status === 'proved') proved++;
      if (goal.children?.length) walk(goal.children);
    }
  }
  walk(goals);
  return { total, proved };
}

function getDepth(goals: ProofGoal[], targetId: string, depth = 0): number {
  for (const goal of goals) {
    if (goal.id === targetId) return depth;
    if (goal.children?.length) {
      const found = getDepth(goal.children, targetId, depth + 1);
      if (found >= 0) return found;
    }
  }
  return -1;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ProofSessionTreeProps {
  goals: ProofGoal[];
  selectedId?: string | undefined;
  expandedIds?: string[];
  onSelectGoal?: (id: string | undefined) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function ProofSessionTree({
  goals,
  selectedId: controlledSelectedId,
  expandedIds: controlledExpandedIds,
  onSelectGoal,
}: ProofSessionTreeProps) {
  const [, send] = useReducer(proofSessionTreeReducer, 'idle');

  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(controlledExpandedIds ?? []),
  );
  const expandedSet = controlledExpandedIds ? new Set(controlledExpandedIds) : internalExpandedIds;

  const [focusIndex, setFocusIndex] = useState(0);

  const flatList = useMemo(() => flattenVisible(goals, expandedSet), [goals, expandedSet]);
  const { total, proved } = useMemo(() => countGoals(goals), [goals]);

  const handleSelect = useCallback((id: string) => {
    const nextId = id === selectedId ? undefined : id;
    setInternalSelectedId(nextId);
    onSelectGoal?.(nextId);
    send({ type: nextId ? 'SELECT' : 'DESELECT' });
  }, [selectedId, onSelectGoal]);

  const handleToggleExpand = useCallback((id: string) => {
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); send({ type: 'COLLAPSE' }); }
      else { next.add(id); send({ type: 'EXPAND' }); }
      return next;
    });
  }, []);

  useInput((input, key) => {
    if (key.downArrow) {
      setFocusIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (key.upArrow) {
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (key.rightArrow) {
      const goal = flatList[focusIndex];
      if (goal?.children?.length) {
        if (!expandedSet.has(goal.id)) {
          handleToggleExpand(goal.id);
        } else {
          // Move to first child
          const childIdx = flatList.findIndex((g) => g.id === goal.children![0].id);
          if (childIdx >= 0) setFocusIndex(childIdx);
        }
      }
    } else if (key.leftArrow) {
      const goal = flatList[focusIndex];
      if (goal && expandedSet.has(goal.id)) {
        handleToggleExpand(goal.id);
      }
    } else if (key.return) {
      const goal = flatList[focusIndex];
      if (goal) handleSelect(goal.id);
    } else if (key.escape) {
      setInternalSelectedId(undefined);
      onSelectGoal?.(undefined);
      send({ type: 'DESELECT' });
    }
  });

  const selectedGoal = selectedId ? findGoal(goals, selectedId) : undefined;
  const displayState: ProofSessionTreeState = selectedId ? 'selected' : 'idle';

  // Build progress bar for goals with progress
  function progressBar(progress: number): string {
    const width = 10;
    const filled = Math.round(progress * width);
    return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
  }

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Summary */}
      <Box>
        <Text bold>Proof Session</Text>
        <Text dimColor> {proved} of {total} goals proved</Text>
      </Box>

      <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>

      {/* Tree items */}
      {flatList.map((goal, index) => {
        const depth = getDepth(goals, goal.id);
        const isFocused = index === focusIndex;
        const isSelected = selectedId === goal.id;
        const hasChildren = !!(goal.children?.length);
        const isExpanded = expandedSet.has(goal.id);

        const indent = '  '.repeat(Math.max(0, depth));
        const treeChar = depth > 0 ? '\u2514\u2500 ' : '';
        const expandChar = hasChildren ? (isExpanded ? '\u25BC ' : '\u25B6 ') : '  ';

        return (
          <Box key={goal.id}>
            <Text dimColor>{indent}{treeChar}</Text>
            <Text bold={isFocused} inverse={isSelected}>
              {isFocused ? '\u25B6' : ' '}
            </Text>
            <Text dimColor>{expandChar}</Text>
            <Text color={STATUS_COLORS[goal.status]}>
              {STATUS_ICONS[goal.status]}
            </Text>
            <Text bold={isSelected}> {goal.label}</Text>
            {goal.progress != null && (
              <Text dimColor> {progressBar(goal.progress)} {Math.round(goal.progress * 100)}%</Text>
            )}
          </Box>
        );
      })}

      {/* Detail panel */}
      {selectedGoal && (
        <>
          <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>
          <Box flexDirection="column">
            <Box>
              <Text color={STATUS_COLORS[selectedGoal.status]}>
                {STATUS_ICONS[selectedGoal.status]} {STATUS_LABELS[selectedGoal.status]}
              </Text>
            </Box>
            <Box><Text bold>{selectedGoal.label}</Text></Box>
            {selectedGoal.tactic && (
              <Box><Text dimColor>Tactic: {selectedGoal.tactic}</Text></Box>
            )}
            {selectedGoal.progress != null && (
              <Box><Text dimColor>Progress: {Math.round(selectedGoal.progress * 100)}%</Text></Box>
            )}
            {selectedGoal.children && selectedGoal.children.length > 0 && (
              <Box><Text dimColor>Sub-goals: {selectedGoal.children.length}</Text></Box>
            )}
          </Box>
        </>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>
      <Box>
        <Text dimColor>\u2191\u2193 navigate  \u2190\u2192 collapse/expand  Enter select  Esc deselect</Text>
      </Box>
    </Box>
  );
}

export default ProofSessionTree;
