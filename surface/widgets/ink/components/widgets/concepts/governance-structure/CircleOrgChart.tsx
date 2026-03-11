/* ---------------------------------------------------------------------------
 * CircleOrgChart — Ink (terminal) implementation
 * Hierarchical organization chart showing governance circles
 * See widget spec: circle-org-chart.widget
 * ------------------------------------------------------------------------- */

export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent =
  | { type: 'SELECT_CIRCLE'; id: string }
  | { type: 'DESELECT' }
  | { type: 'EXPAND'; id: string }
  | { type: 'COLLAPSE'; id: string };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    case 'circleSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
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

export interface CircleMember {
  name: string;
  role: string;
}

export interface Circle {
  id: string;
  name: string;
  purpose: string;
  parentId?: string | undefined;
  members: CircleMember[];
  jurisdiction?: string | undefined;
  policies?: string[] | undefined;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

interface CircleTreeNode {
  circle: Circle;
  children: CircleTreeNode[];
}

function buildTree(circles: Circle[]): CircleTreeNode[] {
  const byId = new Map<string, CircleTreeNode>();
  for (const c of circles) {
    byId.set(c.id, { circle: c, children: [] });
  }
  const roots: CircleTreeNode[] = [];
  for (const c of circles) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function flattenVisible(roots: CircleTreeNode[], expandedSet: Set<string>): Circle[] {
  const result: Circle[] = [];
  function walk(nodes: CircleTreeNode[]) {
    for (const node of nodes) {
      result.push(node.circle);
      if (node.children.length > 0 && expandedSet.has(node.circle.id)) {
        walk(node.children);
      }
    }
  }
  walk(roots);
  return result;
}

function findCircle(circles: Circle[], id: string): Circle | undefined {
  return circles.find((c) => c.id === id);
}

function findNode(nodes: CircleTreeNode[], id: string): CircleTreeNode | undefined {
  for (const node of nodes) {
    if (node.circle.id === id) return node;
    if (node.children.length) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function getDepth(circles: Circle[], id: string): number {
  let depth = 0;
  let current = findCircle(circles, id);
  while (current?.parentId) {
    depth++;
    current = findCircle(circles, current.parentId);
  }
  return depth;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CircleOrgChartProps {
  circles: Circle[];
  selectedCircleId?: string | undefined;
  onSelectCircle?: (id: string | undefined) => void;
  layout?: 'tree' | 'nested' | 'radial';
  showPolicies?: boolean;
  showJurisdiction?: boolean;
  maxAvatars?: number;
  expandedIds?: string[];
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function CircleOrgChart({
  circles,
  selectedCircleId: controlledSelectedId,
  onSelectCircle,
  layout = 'tree',
  showPolicies = true,
  showJurisdiction = true,
  maxAvatars = 5,
  expandedIds: controlledExpandedIds,
}: CircleOrgChartProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const state: CircleOrgChartState = selectedId ? 'circleSelected' : 'idle';

  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(controlledExpandedIds ?? []),
  );
  const expandedSet = controlledExpandedIds ? new Set(controlledExpandedIds) : internalExpandedIds;

  const [focusIndex, setFocusIndex] = useState(0);

  const tree = useMemo(() => buildTree(circles), [circles]);
  const flatList = useMemo(() => flattenVisible(tree, expandedSet), [tree, expandedSet]);

  const handleSelect = useCallback((id: string) => {
    const nextId = id === selectedId ? undefined : id;
    setInternalSelectedId(nextId);
    onSelectCircle?.(nextId);
  }, [selectedId, onSelectCircle]);

  const handleToggleExpand = useCallback((id: string) => {
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useInput((input, key) => {
    if (key.downArrow) {
      setFocusIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (key.upArrow) {
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (key.rightArrow) {
      const circle = flatList[focusIndex];
      if (circle) {
        const node = findNode(tree, circle.id);
        if (node && node.children.length > 0) {
          if (!expandedSet.has(circle.id)) {
            handleToggleExpand(circle.id);
          } else {
            // Move to first child
            const childIndex = flatList.findIndex((c) => c.id === node.children[0].circle.id);
            if (childIndex >= 0) setFocusIndex(childIndex);
          }
        }
      }
    } else if (key.leftArrow) {
      const circle = flatList[focusIndex];
      if (circle) {
        if (expandedSet.has(circle.id)) {
          handleToggleExpand(circle.id);
        } else if (circle.parentId) {
          const parentIndex = flatList.findIndex((c) => c.id === circle.parentId);
          if (parentIndex >= 0) setFocusIndex(parentIndex);
        }
      }
    } else if (key.return) {
      const circle = flatList[focusIndex];
      if (circle) handleSelect(circle.id);
    } else if (key.escape) {
      setInternalSelectedId(undefined);
      onSelectCircle?.(undefined);
    }
  });

  const selectedCircle = selectedId ? findCircle(circles, selectedId) : undefined;

  return (
    <Box flexDirection="column" borderStyle="round">
      <Box>
        <Text bold>Governance Circles</Text>
        <Text dimColor> ({circles.length} circles)</Text>
      </Box>

      <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>

      {/* Tree */}
      {flatList.map((circle, index) => {
        const depth = getDepth(circles, circle.id);
        const isFocused = focusIndex === index;
        const isSelected = selectedId === circle.id;
        const node = findNode(tree, circle.id);
        const hasChildren = node ? node.children.length > 0 : false;
        const isExpanded = expandedSet.has(circle.id);

        const treePrefix = depth > 0
          ? '  '.repeat(depth - 1) + (index < flatList.length - 1 ? '\u251C\u2500\u2500 ' : '\u2514\u2500\u2500 ')
          : '';

        const visibleMembers = circle.members.slice(0, maxAvatars);
        const overflowCount = Math.max(0, circle.members.length - maxAvatars);

        return (
          <Box key={circle.id} flexDirection="column">
            <Box>
              <Text dimColor>{treePrefix}</Text>
              <Text bold={isFocused} inverse={isSelected}>
                {isFocused ? '\u25B6 ' : '  '}
                {hasChildren ? (isExpanded ? '\u25BC ' : '\u25B6 ') : '  '}
                {circle.name}
              </Text>
              <Text dimColor> ({circle.members.length} members)</Text>
            </Box>

            {/* Purpose */}
            <Box>
              <Text dimColor>{'  '.repeat(depth + 1)}    {circle.purpose}</Text>
            </Box>

            {/* Member avatars */}
            {isFocused && (
              <Box>
                <Text dimColor>{'  '.repeat(depth + 1)}    </Text>
                {visibleMembers.map((member, idx) => (
                  <Text key={idx} dimColor>
                    [{member.name.charAt(0)}]
                  </Text>
                ))}
                {overflowCount > 0 && (
                  <Text dimColor> +{overflowCount}</Text>
                )}
              </Box>
            )}

            {/* Policies */}
            {showPolicies && circle.policies && circle.policies.length > 0 && isFocused && (
              <Box>
                <Text dimColor>{'  '.repeat(depth + 1)}    Policies: </Text>
                <Text color="cyan">{circle.policies.join(', ')}</Text>
              </Box>
            )}

            {/* Jurisdiction */}
            {showJurisdiction && circle.jurisdiction && isFocused && (
              <Box>
                <Text dimColor>{'  '.repeat(depth + 1)}    Jurisdiction: </Text>
                <Text color="yellow">{circle.jurisdiction}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Detail panel */}
      {selectedCircle && (
        <>
          <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>
          <Box flexDirection="column">
            <Box>
              <Text bold>{selectedCircle.name}</Text>
              <Text dimColor> - Detail</Text>
            </Box>
            <Box><Text>Purpose: {selectedCircle.purpose}</Text></Box>
            {selectedCircle.jurisdiction && (
              <Box><Text>Jurisdiction: {selectedCircle.jurisdiction}</Text></Box>
            )}
            {selectedCircle.policies && selectedCircle.policies.length > 0 && (
              <Box><Text>Policies: {selectedCircle.policies.join(', ')}</Text></Box>
            )}
            <Box><Text>Members ({selectedCircle.members.length}):</Text></Box>
            {selectedCircle.members.map((member, idx) => (
              <Box key={idx}>
                <Text>  {member.name} - </Text>
                <Text dimColor>{member.role}</Text>
              </Box>
            ))}
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

export default CircleOrgChart;
