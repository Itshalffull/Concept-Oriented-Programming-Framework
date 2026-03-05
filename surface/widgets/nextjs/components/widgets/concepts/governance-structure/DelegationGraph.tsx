import type { HTMLAttributes, ReactNode } from 'react';

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

function findUpstreamDelegators(nodeId: string, edges: DelegationEdge[], visited: Set<string> = new Set()): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  const directDelegators = edges.filter((e) => e.to === nodeId).map((e) => e.from);
  const result: string[] = [...directDelegators];
  for (const delegator of directDelegators) {
    result.push(...findUpstreamDelegators(delegator, edges, new Set(visited)));
  }
  return [...new Set(result)];
}

function formatWeight(weight: number): string {
  if (Number.isInteger(weight)) return String(weight);
  return weight.toFixed(2);
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DelegationGraphProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  nodes: DelegationNode[];
  edges: DelegationEdge[];
  currentUserId?: string;
  viewMode?: 'list' | 'graph';
  sortBy?: 'power' | 'participation' | 'name';
  showCurrentDelegation?: boolean;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function DelegationGraph({
  nodes,
  edges,
  currentUserId,
  viewMode = 'list',
  sortBy = 'power',
  showCurrentDelegation = true,
  children,
  ...rest
}: DelegationGraphProps) {
  // Compute effective weights
  const nodeWeights = new Map<string, number>();
  for (const node of nodes) {
    nodeWeights.set(node.id, computeEffectiveWeight(node.id, nodes, edges));
  }

  // Summary stats
  const totalParticipants = nodes.length;
  const totalWeightDelegated = edges.reduce((sum, e) => sum + (e.weight ?? 1), 0);

  // Sort and filter nodes
  const sortedNodes = [...nodes].sort((a, b) => {
    switch (sortBy) {
      case 'power':
        return (nodeWeights.get(b.id) ?? 0) - (nodeWeights.get(a.id) ?? 0);
      case 'name':
        return a.label.localeCompare(b.label);
      case 'participation':
      default:
        return (nodeWeights.get(b.id) ?? 0) - (nodeWeights.get(a.id) ?? 0);
    }
  });

  // Current delegation info
  const currentDelegation = (() => {
    if (!currentUserId) return null;
    const edge = edges.find((e) => e.from === currentUserId);
    if (!edge) return null;
    const delegatee = nodes.find((n) => n.id === edge.to);
    return delegatee ? { id: delegatee.id, label: delegatee.label, weight: edge.weight ?? 1 } : null;
  })();

  return (
    <div
      role="region"
      aria-label="Delegation management"
      data-surface-widget=""
      data-widget-name="delegation-graph"
      data-part="root"
      data-state="browsing"
      data-view={viewMode}
      tabIndex={0}
      {...rest}
    >
      {/* Search input (static placeholder) */}
      <div data-part="search-input">
        <input
          type="search"
          placeholder="Search delegates..."
          aria-label="Search delegates by name"
          data-state="browsing"
          readOnly
        />
      </div>

      {/* Sort control */}
      <div data-part="sort-control" data-sort={sortBy} />

      {/* View toggle */}
      <button
        type="button"
        data-part="view-toggle"
        data-mode={viewMode}
        aria-label={`Switch to ${viewMode === 'list' ? 'graph' : 'list'} view`}
      >
        {viewMode === 'list' ? 'Graph' : 'List'}
      </button>

      {/* Summary stats */}
      <div data-part="summary" aria-label="Delegation summary">
        <span data-part="total-participants">
          {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
        </span>
        <span data-part="total-weight">
          {formatWeight(totalWeightDelegated)} weight delegated
        </span>
      </div>

      {/* Current delegation info */}
      {showCurrentDelegation && (
        <div
          data-part="current-info"
          data-visible="true"
          aria-label="Your current delegation"
        >
          {currentDelegation ? (
            <span>
              Delegating to <strong>{currentDelegation.label}</strong> (weight: {formatWeight(currentDelegation.weight)})
            </span>
          ) : (
            <span>Not currently delegating</span>
          )}
        </div>
      )}

      {/* Delegate list view */}
      <ul
        role="tree"
        aria-label="Delegates"
        data-part="delegate-list"
        data-visible={viewMode === 'list' ? 'true' : 'false'}
        style={viewMode !== 'list' ? { display: 'none' } : undefined}
      >
        {sortedNodes.map((node, index) => {
          const effectiveWeight = nodeWeights.get(node.id) ?? 0;
          const upstreamCount = findUpstreamDelegators(node.id, edges).length;
          const delegated = currentUserId
            ? edges.some((e) => e.from === currentUserId && e.to === node.id)
            : false;

          return (
            <li
              key={node.id}
              role="treeitem"
              aria-label={`${node.label} \u2014 voting power: ${formatWeight(effectiveWeight)}`}
              aria-selected={false}
              data-part="delegate-item"
              data-selected="false"
              data-highlighted="false"
              data-state="browsing"
              tabIndex={index === 0 ? 0 : -1}
            >
              <span data-part="avatar" aria-hidden="true">
                {node.avatar ?? node.label.charAt(0).toUpperCase()}
              </span>
              <span data-part="delegate-name">{node.label}</span>
              <span data-part="voting-power" aria-label={`Voting power: ${formatWeight(effectiveWeight)}`}>
                {formatWeight(effectiveWeight)}
              </span>
              <span data-part="participation" aria-label={`${upstreamCount} delegator${upstreamCount !== 1 ? 's' : ''}`}>
                {upstreamCount} delegator{upstreamCount !== 1 ? 's' : ''}
              </span>
              {currentUserId && node.id !== currentUserId && (
                <button
                  type="button"
                  data-part="delegate-action"
                  role="button"
                  aria-label={delegated ? `Undelegate from ${node.label}` : `Delegate to ${node.label}`}
                  tabIndex={0}
                >
                  {delegated ? 'Undelegate' : 'Delegate'}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Graph view: adjacency list */}
      <div
        data-part="graph-view"
        data-visible={viewMode === 'graph' ? 'true' : 'false'}
        aria-label="Delegation graph"
        style={viewMode !== 'graph' ? { display: 'none' } : undefined}
      >
        <ul role="tree" aria-label="Delegation relationships">
          {sortedNodes.map((node) => {
            const outgoing = edges.filter((e) => e.from === node.id);
            const incoming = edges.filter((e) => e.to === node.id);
            const effectiveWeight = nodeWeights.get(node.id) ?? 0;

            return (
              <li
                key={node.id}
                role="treeitem"
                aria-label={`${node.label}: ${formatWeight(effectiveWeight)} effective weight`}
                data-node-id={node.id}
                data-highlighted="false"
              >
                <span data-part="delegate-name">{node.label}</span>
                <span data-part="voting-power">{formatWeight(effectiveWeight)}</span>

                {outgoing.length > 0 && (
                  <ul role="group" aria-label={`${node.label} delegates to`}>
                    {outgoing.map((edge) => {
                      const target = nodes.find((n) => n.id === edge.to);
                      return (
                        <li key={`${edge.from}-${edge.to}`} role="treeitem" aria-label={`Delegates to ${target?.label ?? edge.to}`}>
                          &rarr; {target?.label ?? edge.to} (weight: {formatWeight(edge.weight ?? 1)})
                        </li>
                      );
                    })}
                  </ul>
                )}

                {incoming.length > 0 && (
                  <ul role="group" aria-label="Delegated by">
                    {incoming.map((edge) => {
                      const source = nodes.find((n) => n.id === edge.from);
                      return (
                        <li key={`${edge.from}-${edge.to}`} role="treeitem" aria-label={`Delegated by ${source?.label ?? edge.from}`}>
                          &larr; {source?.label ?? edge.from} (weight: {formatWeight(edge.weight ?? 1)})
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {children}
    </div>
  );
}

export { DelegationGraph };
