'use client';

// ============================================================
// Clef Surface Next.js Widget — ScoreImpactPanel
//
// Displays a Score dependency impact graph showing concept nodes
// and their dependency edges. Supports selecting a node to
// highlight its upstream/downstream impact chain. Used in the
// Score analysis layer to visualize cross-concept dependencies
// and blast radius for changes.
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export interface ImpactNode {
  id: string;
  label: string;
  type: 'concept' | 'sync' | 'action' | 'handler';
  status?: 'affected' | 'unaffected' | 'root';
}

export interface ImpactEdge {
  sourceId: string;
  targetId: string;
  label?: string;
  type?: 'depends-on' | 'triggers' | 'reads' | 'writes';
}

// --------------- Props ---------------

export interface ScoreImpactPanelProps {
  /** Nodes in the impact graph. */
  nodes?: ImpactNode[];
  /** Edges in the impact graph. */
  edges?: ImpactEdge[];
  /** Currently selected node ID. */
  selectedNodeId?: string | null;
  /** Title for the panel. */
  title?: string;
  /** Callback when a node is selected. */
  onSelectNode?: (nodeId: string) => void;
  /** Callback when the selection is cleared. */
  onClearSelection?: () => void;
  /** Whether to show upstream dependencies. */
  showUpstream?: boolean;
  /** Whether to show downstream dependents. */
  showDownstream?: boolean;
}

// --------------- State Machine ---------------

type PanelState = 'overview' | 'nodeSelected';

// --------------- Component ---------------

export const ScoreImpactPanel: React.FC<ScoreImpactPanelProps> = ({
  nodes = [],
  edges = [],
  selectedNodeId: selectedNodeIdProp = null,
  title = 'Dependency Impact',
  onSelectNode,
  onClearSelection,
  showUpstream = true,
  showDownstream = true,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(selectedNodeIdProp);
  const [panelState, setPanelState] = useState<PanelState>(
    selectedNodeIdProp ? 'nodeSelected' : 'overview',
  );

  // Sync prop
  React.useEffect(() => {
    setSelectedNodeId(selectedNodeIdProp);
    setPanelState(selectedNodeIdProp ? 'nodeSelected' : 'overview');
  }, [selectedNodeIdProp]);

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setPanelState('nodeSelected');
      onSelectNode?.(nodeId);
    },
    [onSelectNode],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setPanelState('overview');
    onClearSelection?.();
  }, [onClearSelection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && panelState === 'nodeSelected') {
        handleClearSelection();
      }
    },
    [panelState, handleClearSelection],
  );

  // Compute affected nodes when a node is selected
  const getAffectedNodeIds = (): Set<string> => {
    if (!selectedNodeId) return new Set();
    const affected = new Set<string>([selectedNodeId]);

    if (showUpstream) {
      let frontier = [selectedNodeId];
      while (frontier.length > 0) {
        const nextFrontier: string[] = [];
        for (const nodeId of frontier) {
          for (const edge of edges) {
            if (edge.targetId === nodeId && !affected.has(edge.sourceId)) {
              affected.add(edge.sourceId);
              nextFrontier.push(edge.sourceId);
            }
          }
        }
        frontier = nextFrontier;
      }
    }

    if (showDownstream) {
      let frontier = [selectedNodeId];
      while (frontier.length > 0) {
        const nextFrontier: string[] = [];
        for (const nodeId of frontier) {
          for (const edge of edges) {
            if (edge.sourceId === nodeId && !affected.has(edge.targetId)) {
              affected.add(edge.targetId);
              nextFrontier.push(edge.targetId);
            }
          }
        }
        frontier = nextFrontier;
      }
    }

    return affected;
  };

  const affectedIds = getAffectedNodeIds();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div
      role="region"
      aria-label={title}
      data-state={panelState}
      data-part="root"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div data-part="header">
        <span data-part="title">{title}</span>
        {panelState === 'nodeSelected' && (
          <button
            data-part="clear-selection"
            aria-label="Clear selection"
            onClick={handleClearSelection}
            type="button"
          />
        )}
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div data-part="selected-detail" aria-live="polite">
          <span data-part="selected-label">{selectedNode.label}</span>
          <span data-part="selected-type">{selectedNode.type}</span>
          <span data-part="affected-count">
            {affectedIds.size} affected
          </span>
        </div>
      )}

      {/* Graph area — nodes */}
      <div role="list" aria-label="Impact graph nodes" data-part="graph">
        {nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isAffected = affectedIds.has(node.id);

          return (
            <div
              key={node.id}
              role="listitem"
              data-node-id={node.id}
              data-node-type={node.type}
              data-selected={isSelected ? 'true' : 'false'}
              data-affected={isAffected ? 'true' : 'false'}
              data-status={
                isSelected ? 'root' : isAffected ? 'affected' : 'unaffected'
              }
              data-part="node"
              onClick={() => handleSelectNode(node.id)}
              tabIndex={0}
              aria-label={`${node.type}: ${node.label}${isAffected ? ' (affected)' : ''}`}
            >
              <span data-part="node-label">{node.label}</span>
            </div>
          );
        })}
      </div>

      {/* Edges */}
      <div aria-hidden="true" data-part="edges">
        {edges.map((edge, idx) => (
          <div
            key={`${edge.sourceId}-${edge.targetId}-${idx}`}
            data-source={edge.sourceId}
            data-target={edge.targetId}
            data-edge-type={edge.type ?? 'depends-on'}
            data-highlighted={
              affectedIds.has(edge.sourceId) && affectedIds.has(edge.targetId)
                ? 'true'
                : 'false'
            }
            data-part="edge"
          >
            {edge.label && <span data-part="edge-label">{edge.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

ScoreImpactPanel.displayName = 'ScoreImpactPanel';
export default ScoreImpactPanel;
