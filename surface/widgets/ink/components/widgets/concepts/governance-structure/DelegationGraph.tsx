/* ---------------------------------------------------------------------------
 * DelegationGraph — Ink (terminal) implementation
 * Interactive delegation management for governance participants
 * See widget spec: delegation-graph.widget
 * ------------------------------------------------------------------------- */

export type DelegationGraphState = 'browsing' | 'searching' | 'selected' | 'delegating' | 'undelegating';
export type DelegationGraphEvent =
  | { type: 'SEARCH'; query: string }
  | { type: 'SELECT_DELEGATE'; id: string }
  | { type: 'SWITCH_VIEW' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'DESELECT' }
  | { type: 'DELEGATE' }
  | { type: 'UNDELEGATE' }
  | { type: 'DELEGATE_COMPLETE' }
  | { type: 'DELEGATE_ERROR' }
  | { type: 'UNDELEGATE_COMPLETE' }
  | { type: 'UNDELEGATE_ERROR' };

export function delegationGraphReducer(state: DelegationGraphState, event: DelegationGraphEvent): DelegationGraphState {
  switch (state) {
    case 'browsing':
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_DELEGATE') return 'selected';
      if (event.type === 'SWITCH_VIEW') return 'browsing';
      return state;
    case 'searching':
      if (event.type === 'CLEAR_SEARCH') return 'browsing';
      if (event.type === 'SELECT_DELEGATE') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'browsing';
      if (event.type === 'DELEGATE') return 'delegating';
      if (event.type === 'UNDELEGATE') return 'undelegating';
      return state;
    case 'delegating':
      if (event.type === 'DELEGATE_COMPLETE') return 'browsing';
      if (event.type === 'DELEGATE_ERROR') return 'selected';
      return state;
    case 'undelegating':
      if (event.type === 'UNDELEGATE_COMPLETE') return 'browsing';
      if (event.type === 'UNDELEGATE_ERROR') return 'selected';
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

export interface DelegationNode {
  id: string;
  label: string;
  weight?: number;
  avatar?: string;
}

export interface DelegationEdge {
  from: string;
  to: string;
  weight?: number;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function computeEffectiveWeight(
  nodeId: string,
  nodes: DelegationNode[],
  edges: DelegationEdge[],
  visited: Set<string> = new Set(),
): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);
  const node = nodes.find((n) => n.id === nodeId);
  const baseWeight = node?.weight ?? 1;
  const incomingEdges = edges.filter((e) => e.to === nodeId);
  let delegatedWeight = 0;
  for (const edge of incomingEdges) {
    const upstreamWeight = computeEffectiveWeight(edge.from, nodes, edges, new Set(visited));
    delegatedWeight += upstreamWeight * (edge.weight ?? 1);
  }
  return baseWeight + delegatedWeight;
}

function findUpstreamDelegators(nodeId: string, edges: DelegationEdge[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const direct = edges.filter((e) => e.to === id).map((e) => e.from);
    for (const d of direct) {
      result.push(d);
      walk(d);
    }
  }
  walk(nodeId);
  return [...new Set(result)];
}

function formatWeight(weight: number): string {
  if (Number.isInteger(weight)) return String(weight);
  return weight.toFixed(2);
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DelegationGraphProps {
  nodes: DelegationNode[];
  edges: DelegationEdge[];
  currentUserId?: string;
  viewMode?: 'list' | 'graph';
  sortBy?: 'power' | 'participation' | 'name';
  showCurrentDelegation?: boolean;
  onDelegate?: (fromId: string, toId: string) => void;
  onUndelegate?: (fromId: string, toId: string) => void;
  onSelectNode?: (nodeId: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function DelegationGraph({
  nodes,
  edges,
  currentUserId,
  viewMode = 'list',
  sortBy = 'power',
  showCurrentDelegation = true,
  onDelegate,
  onUndelegate,
  onSelectNode,
}: DelegationGraphProps) {
  const [state, send] = useReducer(delegationGraphReducer, 'browsing');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeView, setActiveView] = useState<'list' | 'graph'>(viewMode);

  // Compute effective weights
  const nodeWeights = useMemo(() => {
    const weights = new Map<string, number>();
    for (const node of nodes) {
      weights.set(node.id, computeEffectiveWeight(node.id, nodes, edges));
    }
    return weights;
  }, [nodes, edges]);

  // Sort and list
  const sortedNodes = useMemo(() => {
    const result = [...nodes];
    result.sort((a, b) => {
      switch (sortBy) {
        case 'power': return (nodeWeights.get(b.id) ?? 0) - (nodeWeights.get(a.id) ?? 0);
        case 'name': return a.label.localeCompare(b.label);
        default: return (nodeWeights.get(b.id) ?? 0) - (nodeWeights.get(a.id) ?? 0);
      }
    });
    return result;
  }, [nodes, sortBy, nodeWeights]);

  // Current delegation
  const currentDelegation = useMemo(() => {
    if (!currentUserId) return null;
    const edge = edges.find((e) => e.from === currentUserId);
    if (!edge) return null;
    const delegatee = nodes.find((n) => n.id === edge.to);
    return delegatee ? { id: delegatee.id, label: delegatee.label, weight: edge.weight ?? 1 } : null;
  }, [currentUserId, edges, nodes]);

  const isDelegatedTo = useCallback(
    (nodeId: string) => {
      if (!currentUserId) return false;
      return edges.some((e) => e.from === currentUserId && e.to === nodeId);
    },
    [currentUserId, edges],
  );

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  useInput((input, key) => {
    if (key.downArrow) {
      setFocusedIndex((i) => Math.min(i + 1, sortedNodes.length - 1));
    } else if (key.upArrow) {
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (key.return) {
      const node = sortedNodes[focusedIndex];
      if (node) {
        setSelectedNodeId(node.id);
        send({ type: 'SELECT_DELEGATE', id: node.id });
        onSelectNode?.(node.id);
      }
    } else if (key.escape) {
      setSelectedNodeId(null);
      send({ type: 'DESELECT' });
    } else if (input === 'd' && selectedNodeId && currentUserId) {
      const delegated = isDelegatedTo(selectedNodeId);
      if (delegated) {
        send({ type: 'UNDELEGATE' });
        onUndelegate?.(currentUserId, selectedNodeId);
        setTimeout(() => send({ type: 'UNDELEGATE_COMPLETE' }), 0);
      } else {
        send({ type: 'DELEGATE' });
        onDelegate?.(currentUserId, selectedNodeId);
        setTimeout(() => send({ type: 'DELEGATE_COMPLETE' }), 0);
      }
    } else if (input === 'v') {
      setActiveView((prev) => (prev === 'list' ? 'graph' : 'list'));
      send({ type: 'SWITCH_VIEW' });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      <Box>
        <Text bold>Delegation Graph</Text>
        <Text dimColor> [{activeView}] (v to toggle)</Text>
      </Box>

      {/* Summary */}
      <Box>
        <Text dimColor>
          {nodes.length} participant{nodes.length !== 1 ? 's' : ''}
        </Text>
      </Box>

      {/* Current delegation */}
      {showCurrentDelegation && (
        <Box>
          {currentDelegation ? (
            <Text>
              Delegating to <Text bold>{currentDelegation.label}</Text>
              <Text dimColor> (weight: {formatWeight(currentDelegation.weight)})</Text>
            </Text>
          ) : (
            <Text dimColor>Not currently delegating</Text>
          )}
        </Box>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>

      {/* Delegate list */}
      {activeView === 'list' ? (
        <Box flexDirection="column">
          {sortedNodes.map((node, index) => {
            const effectiveWeight = nodeWeights.get(node.id) ?? 0;
            const isFocused = focusedIndex === index;
            const isSelected = selectedNodeId === node.id;
            const delegated = isDelegatedTo(node.id);
            const upstreamCount = findUpstreamDelegators(node.id, edges).length;

            return (
              <Box key={node.id}>
                <Text inverse={isSelected}>
                  {isFocused ? '\u25B6 ' : '  '}
                </Text>
                <Text bold={isSelected}>{node.label}</Text>
                <Text color="cyan"> {formatWeight(effectiveWeight)}</Text>
                <Text dimColor> ({upstreamCount} delegator{upstreamCount !== 1 ? 's' : ''})</Text>
                {delegated && <Text color="green"> [delegated]</Text>}
              </Box>
            );
          })}
        </Box>
      ) : (
        /* Graph view: adjacency list */
        <Box flexDirection="column">
          {sortedNodes.map((node) => {
            const outgoing = edges.filter((e) => e.from === node.id);
            const incoming = edges.filter((e) => e.to === node.id);
            const effectiveWeight = nodeWeights.get(node.id) ?? 0;

            return (
              <Box key={node.id} flexDirection="column">
                <Box>
                  <Text bold>{node.label}</Text>
                  <Text color="cyan"> ({formatWeight(effectiveWeight)})</Text>
                </Box>
                {outgoing.map((edge) => {
                  const target = nodes.find((n) => n.id === edge.to);
                  return (
                    <Box key={`${edge.from}-${edge.to}`}>
                      <Text dimColor>  \u2192 {target?.label ?? edge.to} (w: {formatWeight(edge.weight ?? 1)})</Text>
                    </Box>
                  );
                })}
                {incoming.map((edge) => {
                  const source = nodes.find((n) => n.id === edge.from);
                  return (
                    <Box key={`${edge.from}-${edge.to}`}>
                      <Text dimColor>  \u2190 {source?.label ?? edge.from} (w: {formatWeight(edge.weight ?? 1)})</Text>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Detail panel */}
      {state === 'selected' && selectedNode && (
        <>
          <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>
          <Box flexDirection="column">
            <Box><Text bold>{selectedNode.label}</Text></Box>
            <Box><Text>Effective power: {formatWeight(nodeWeights.get(selectedNode.id) ?? 0)}</Text></Box>
            <Box><Text>Base weight: {formatWeight(selectedNode.weight ?? 1)}</Text></Box>
            <Box><Text>Upstream: {findUpstreamDelegators(selectedNode.id, edges).length}</Text></Box>
            {currentUserId && selectedNode.id !== currentUserId && (
              <Box>
                <Text color="cyan">
                  d to {isDelegatedTo(selectedNode.id) ? 'undelegate' : 'delegate'}
                </Text>
              </Box>
            )}
          </Box>
        </>
      )}

      {/* Confirmation */}
      {(state === 'delegating' || state === 'undelegating') && (
        <Box>
          <Text color="yellow">
            {state === 'delegating' ? 'Delegating...' : 'Removing delegation...'}
          </Text>
        </Box>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>
      <Box>
        <Text dimColor>\u2191\u2193 navigate  Enter select  d delegate  v view  Esc back</Text>
      </Box>
    </Box>
  );
}

export default DelegationGraph;
