/* ---------------------------------------------------------------------------
 * DelegationGraph state machine
 * States: browsing (initial), searching, selected, delegating, undelegating
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

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

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
 * Props
 * ------------------------------------------------------------------------- */

export interface DelegationGraphProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of governance participants. */
  nodes: DelegationNode[];
  /** Delegation relationships between participants. */
  edges: DelegationEdge[];
  /** The current user's ID (to determine current delegation). */
  currentUserId?: string;
  /** View mode: list or graph (headless graph renders as adjacency list). */
  viewMode?: 'list' | 'graph';
  /** Sort order for the delegate list. */
  sortBy?: 'power' | 'participation' | 'name';
  /** Whether to show the current delegation info panel. */
  showCurrentDelegation?: boolean;
  /** Callback fired when a delegation action is requested. */
  onDelegate?: (fromId: string, toId: string) => void;
  /** Callback fired when an undelegation action is requested. */
  onUndelegate?: (fromId: string, toId: string) => void;
  /** Callback fired when a node is selected. */
  onSelectNode?: (nodeId: string) => void;
  /** Slot content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Compute effective voting weight for a node, including transitive delegations. */
function computeEffectiveWeight(
  nodeId: string,
  nodes: DelegationNode[],
  edges: DelegationEdge[],
  visited: Set<string> = new Set(),
): number {
  if (visited.has(nodeId)) return 0; // prevent cycles
  visited.add(nodeId);

  const node = nodes.find((n) => n.id === nodeId);
  const baseWeight = node?.weight ?? 1;

  // Sum weight from all nodes that delegate TO this node
  const incomingEdges = edges.filter((e) => e.to === nodeId);
  let delegatedWeight = 0;
  for (const edge of incomingEdges) {
    const upstreamWeight = computeEffectiveWeight(edge.from, nodes, edges, new Set(visited));
    delegatedWeight += upstreamWeight * (edge.weight ?? 1);
  }

  return baseWeight + delegatedWeight;
}

/** Find all upstream delegators (nodes that delegate to this node, transitively). */
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

/** Find all downstream delegatees (nodes this node delegates to, transitively). */
function findDownstreamDelegatees(nodeId: string, edges: DelegationEdge[], visited: Set<string> = new Set()): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);

  const directDelegatees = edges.filter((e) => e.from === nodeId).map((e) => e.to);
  const result: string[] = [...directDelegatees];
  for (const delegatee of directDelegatees) {
    result.push(...findDownstreamDelegatees(delegatee, edges, new Set(visited)));
  }
  return [...new Set(result)];
}

/** Format a weight value for display. */
function formatWeight(weight: number): string {
  if (Number.isInteger(weight)) return String(weight);
  return weight.toFixed(2);
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const DelegationGraph = forwardRef<HTMLDivElement, DelegationGraphProps>(function DelegationGraph(
  {
    nodes,
    edges,
    currentUserId,
    viewMode = 'list',
    sortBy = 'power',
    showCurrentDelegation = true,
    onDelegate,
    onUndelegate,
    onSelectNode,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(delegationGraphReducer, 'browsing');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeView, setActiveView] = useState<'list' | 'graph'>(viewMode);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Compute effective weights for all nodes
  const nodeWeights = useMemo(() => {
    const weights = new Map<string, number>();
    for (const node of nodes) {
      weights.set(node.id, computeEffectiveWeight(node.id, nodes, edges));
    }
    return weights;
  }, [nodes, edges]);

  // Summary stats
  const totalParticipants = nodes.length;
  const totalWeightDelegated = useMemo(() => {
    return edges.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  }, [edges]);

  // Delegation chain for selected node
  const selectedChain = useMemo(() => {
    if (!selectedNodeId) return { upstream: [] as string[], downstream: [] as string[] };
    return {
      upstream: findUpstreamDelegators(selectedNodeId, edges),
      downstream: findDownstreamDelegatees(selectedNodeId, edges),
    };
  }, [selectedNodeId, edges]);

  // Filter nodes by search query
  const filteredNodes = useMemo(() => {
    let result = [...nodes];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) => n.label.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
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

    return result;
  }, [nodes, searchQuery, sortBy, nodeWeights]);

  // Current user's delegation info
  const currentDelegation = useMemo(() => {
    if (!currentUserId) return null;
    const edge = edges.find((e) => e.from === currentUserId);
    if (!edge) return null;
    const delegatee = nodes.find((n) => n.id === edge.to);
    return delegatee ? { id: delegatee.id, label: delegatee.label, weight: edge.weight ?? 1 } : null;
  }, [currentUserId, edges, nodes]);

  // Check if a node is delegated to by the current user
  const isDelegatedTo = useCallback(
    (nodeId: string) => {
      if (!currentUserId) return false;
      return edges.some((e) => e.from === currentUserId && e.to === nodeId);
    },
    [currentUserId, edges],
  );

  // Determine chain membership for highlighting
  const isInChain = useCallback(
    (nodeId: string) => {
      if (!selectedNodeId) return false;
      if (nodeId === selectedNodeId) return true;
      return selectedChain.upstream.includes(nodeId) || selectedChain.downstream.includes(nodeId);
    },
    [selectedNodeId, selectedChain],
  );

  // Node selection handler
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      send({ type: 'SELECT_DELEGATE', id: nodeId });
      onSelectNode?.(nodeId);
    },
    [onSelectNode],
  );

  // Deselect handler
  const handleDeselect = useCallback(() => {
    setSelectedNodeId(null);
    send({ type: 'DESELECT' });
  }, []);

  // Delegate handler
  const handleDelegate = useCallback(
    (toId: string) => {
      if (!currentUserId) return;
      send({ type: 'DELEGATE' });
      onDelegate?.(currentUserId, toId);
      // Simulate completion (consumer should call back)
      setTimeout(() => send({ type: 'DELEGATE_COMPLETE' }), 0);
    },
    [currentUserId, onDelegate],
  );

  // Undelegate handler
  const handleUndelegate = useCallback(
    (toId: string) => {
      if (!currentUserId) return;
      send({ type: 'UNDELEGATE' });
      onUndelegate?.(currentUserId, toId);
      setTimeout(() => send({ type: 'UNDELEGATE_COMPLETE' }), 0);
    },
    [currentUserId, onUndelegate],
  );

  // Search handler
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      if (value && state === 'browsing') {
        send({ type: 'SEARCH', query: value });
      } else if (!value && state === 'searching') {
        send({ type: 'CLEAR_SEARCH' });
      }
    },
    [state],
  );

  // View toggle handler
  const handleViewToggle = useCallback(() => {
    setActiveView((prev) => (prev === 'list' ? 'graph' : 'list'));
    send({ type: 'SWITCH_VIEW' });
  }, []);

  // Focus management for roving tabindex
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLLIElement>('[role="treeitem"]');
      if (items[focusedIndex]) {
        items[focusedIndex].focus();
      }
    }
  }, [focusedIndex]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, filteredNodes.length - 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const node = filteredNodes[focusedIndex];
          if (node) handleSelectNode(node.id);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          handleDeselect();
          break;
        }
        case 'f': {
          if (e.ctrlKey) {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          break;
        }
      }
    },
    [filteredNodes, focusedIndex, handleSelectNode, handleDeselect],
  );

  // Selected node detail
  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [selectedNodeId, nodes],
  );

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Delegation management"
      data-surface-widget=""
      data-widget-name="delegation-graph"
      data-part="root"
      data-state={state}
      data-view={activeView}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Search input */}
      <div data-part="search-input">
        <input
          ref={searchInputRef}
          type="search"
          placeholder="Search delegates..."
          value={searchQuery}
          onChange={handleSearchChange}
          aria-label="Search delegates by name"
          data-state={state}
        />
      </div>

      {/* Sort control */}
      <div data-part="sort-control" data-sort={sortBy}>
        {/* Sort options rendered by consumer via CSS or compose slot */}
      </div>

      {/* View toggle */}
      <button
        type="button"
        data-part="view-toggle"
        data-mode={activeView}
        aria-label={`Switch to ${activeView === 'list' ? 'graph' : 'list'} view`}
        onClick={handleViewToggle}
      >
        {activeView === 'list' ? 'Graph' : 'List'}
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
          data-visible={showCurrentDelegation ? 'true' : 'false'}
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

      {/* Delegate list view (tree role for hierarchy) */}
      <ul
        ref={listRef}
        role="tree"
        aria-label="Delegates"
        data-part="delegate-list"
        data-visible={activeView === 'list' ? 'true' : 'false'}
        style={activeView !== 'list' ? { display: 'none' } : undefined}
      >
        {filteredNodes.map((node, index) => {
          const effectiveWeight = nodeWeights.get(node.id) ?? 0;
          const inChain = isInChain(node.id);
          const isSelected = selectedNodeId === node.id;
          const delegated = isDelegatedTo(node.id);
          const upstreamCount = findUpstreamDelegators(node.id, edges).length;

          return (
            <li
              key={node.id}
              role="treeitem"
              aria-label={`${node.label} \u2014 voting power: ${formatWeight(effectiveWeight)}`}
              aria-selected={isSelected}
              aria-expanded={isSelected ? true : undefined}
              data-part="delegate-item"
              data-selected={isSelected ? 'true' : 'false'}
              data-highlighted={inChain ? 'true' : 'false'}
              data-state={state}
              tabIndex={index === focusedIndex ? 0 : -1}
              onClick={() => handleSelectNode(node.id)}
            >
              {/* Avatar */}
              <span data-part="avatar" aria-hidden="true">
                {node.avatar ?? node.label.charAt(0).toUpperCase()}
              </span>

              {/* Delegate name */}
              <span data-part="delegate-name">{node.label}</span>

              {/* Voting power */}
              <span data-part="voting-power" aria-label={`Voting power: ${formatWeight(effectiveWeight)}`}>
                {formatWeight(effectiveWeight)}
              </span>

              {/* Delegation count */}
              <span data-part="participation" aria-label={`${upstreamCount} delegator${upstreamCount !== 1 ? 's' : ''}`}>
                {upstreamCount} delegator{upstreamCount !== 1 ? 's' : ''}
              </span>

              {/* Delegate/Undelegate action */}
              {currentUserId && node.id !== currentUserId && (
                <button
                  type="button"
                  data-part="delegate-action"
                  role="button"
                  aria-label={delegated ? `Undelegate from ${node.label}` : `Delegate to ${node.label}`}
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (delegated) {
                      handleUndelegate(node.id);
                    } else {
                      handleDelegate(node.id);
                    }
                  }}
                >
                  {delegated ? 'Undelegate' : 'Delegate'}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Graph view: headless adjacency list representation */}
      <div
        data-part="graph-view"
        data-visible={activeView === 'graph' ? 'true' : 'false'}
        aria-label="Delegation graph"
        style={activeView !== 'graph' ? { display: 'none' } : undefined}
      >
        <ul role="tree" aria-label="Delegation relationships">
          {filteredNodes.map((node) => {
            const outgoing = edges.filter((e) => e.from === node.id);
            const incoming = edges.filter((e) => e.to === node.id);
            const effectiveWeight = nodeWeights.get(node.id) ?? 0;

            return (
              <li
                key={node.id}
                role="treeitem"
                aria-label={`${node.label}: ${formatWeight(effectiveWeight)} effective weight`}
                data-node-id={node.id}
                data-highlighted={isInChain(node.id) ? 'true' : 'false'}
                onClick={() => handleSelectNode(node.id)}
              >
                <span data-part="delegate-name">{node.label}</span>
                <span data-part="voting-power">{formatWeight(effectiveWeight)}</span>

                {outgoing.length > 0 && (
                  <ul role="group" aria-label={`${node.label} delegates to`}>
                    {outgoing.map((edge) => {
                      const target = nodes.find((n) => n.id === edge.to);
                      return (
                        <li key={`${edge.from}-${edge.to}`} role="treeitem" aria-label={`Delegates to ${target?.label ?? edge.to}, weight: ${formatWeight(edge.weight ?? 1)}`}>
                          &rarr; {target?.label ?? edge.to} (weight: {formatWeight(edge.weight ?? 1)})
                        </li>
                      );
                    })}
                  </ul>
                )}

                {incoming.length > 0 && (
                  <ul role="group" aria-label={`Delegated by`}>
                    {incoming.map((edge) => {
                      const source = nodes.find((n) => n.id === edge.from);
                      return (
                        <li key={`${edge.from}-${edge.to}`} role="treeitem" aria-label={`Delegated by ${source?.label ?? edge.from}, weight: ${formatWeight(edge.weight ?? 1)}`}>
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

      {/* Detail panel for selected node */}
      {state === 'selected' && selectedNode && (
        <div
          data-part="detail-panel"
          role="complementary"
          aria-label={`Delegation details for ${selectedNode.label}`}
        >
          <div data-part="detail-header">
            <span data-part="avatar" aria-hidden="true">
              {selectedNode.avatar ?? selectedNode.label.charAt(0).toUpperCase()}
            </span>
            <h3 data-part="delegate-name">{selectedNode.label}</h3>
            <button
              type="button"
              aria-label="Close detail panel"
              onClick={handleDeselect}
            >
              Close
            </button>
          </div>

          <dl data-part="detail-stats">
            <dt>Effective voting power</dt>
            <dd data-part="voting-power">{formatWeight(nodeWeights.get(selectedNode.id) ?? 0)}</dd>

            <dt>Base weight</dt>
            <dd>{formatWeight(selectedNode.weight ?? 1)}</dd>

            <dt>Upstream delegators</dt>
            <dd>{selectedChain.upstream.length}</dd>

            <dt>Downstream delegatees</dt>
            <dd>{selectedChain.downstream.length}</dd>
          </dl>

          {/* Upstream delegators list */}
          {selectedChain.upstream.length > 0 && (
            <div data-part="chain-upstream" aria-label="Upstream delegators">
              <h4>Delegates from</h4>
              <ul>
                {selectedChain.upstream.map((id) => {
                  const n = nodes.find((node) => node.id === id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => handleSelectNode(id)}
                        aria-label={`Select ${n?.label ?? id}`}
                      >
                        {n?.label ?? id}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Downstream delegatees list */}
          {selectedChain.downstream.length > 0 && (
            <div data-part="chain-downstream" aria-label="Downstream delegatees">
              <h4>Delegates to</h4>
              <ul>
                {selectedChain.downstream.map((id) => {
                  const n = nodes.find((node) => node.id === id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => handleSelectNode(id)}
                        aria-label={`Select ${n?.label ?? id}`}
                      >
                        {n?.label ?? id}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Confirmation dialog for delegating/undelegating states */}
      {(state === 'delegating' || state === 'undelegating') && (
        <div
          data-part="confirmation"
          role="alertdialog"
          aria-label={state === 'delegating' ? 'Confirm delegation' : 'Confirm undelegation'}
        >
          <p>
            {state === 'delegating'
              ? `Delegating to ${selectedNode?.label ?? 'delegate'}...`
              : `Removing delegation from ${selectedNode?.label ?? 'delegate'}...`}
          </p>
        </div>
      )}

      {children}
    </div>
  );
});

DelegationGraph.displayName = 'DelegationGraph';
export { DelegationGraph };
export default DelegationGraph;
