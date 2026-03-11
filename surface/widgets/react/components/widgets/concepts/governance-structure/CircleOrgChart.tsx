/* ---------------------------------------------------------------------------
 * CircleOrgChart state machine
 * States: idle (initial), circleSelected (with detail panel)
 * See widget spec: repertoire/concepts/governance-structure/widgets/circle-org-chart.widget
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

import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

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

export interface CircleOrgChartProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Flat list of circles with parentId references forming the hierarchy. */
  circles: Circle[];
  /** ID of the currently selected circle (controlled). */
  selectedCircleId?: string | undefined;
  /** Callback when a circle is selected or deselected. */
  onSelectCircle?: (id: string | undefined) => void;
  /** Layout mode for the chart. */
  layout?: 'tree' | 'nested' | 'radial';
  /** Show policy badges on each circle. */
  showPolicies?: boolean;
  /** Show jurisdiction labels on each circle. */
  showJurisdiction?: boolean;
  /** Maximum number of member avatars before truncation. */
  maxAvatars?: number;
  /** IDs of expanded circles (controlled). */
  expandedIds?: string[];
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

interface CircleTreeNode {
  circle: Circle;
  children: CircleTreeNode[];
}

/** Build tree structure from flat circle array. */
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

/** Flatten tree into ordered list for keyboard navigation, respecting expanded state. */
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

/** Find a circle by ID. */
function findCircle(circles: Circle[], id: string): Circle | undefined {
  return circles.find((c) => c.id === id);
}

/** Find a tree node by ID. */
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

/* ---------------------------------------------------------------------------
 * CircleNode — recursive tree item
 * ------------------------------------------------------------------------- */

interface CircleNodeProps {
  node: CircleTreeNode;
  depth: number;
  expandedSet: Set<string>;
  selectedId: string | undefined;
  focusedId: string | undefined;
  showPolicies: boolean;
  showJurisdiction: boolean;
  maxAvatars: number;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function CircleNode({
  node,
  depth,
  expandedSet,
  selectedId,
  focusedId,
  showPolicies,
  showJurisdiction,
  maxAvatars,
  onToggleExpand,
  onSelect,
  onFocus,
  nodeRefs,
}: CircleNodeProps) {
  const { circle, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedSet.has(circle.id);
  const isSelected = selectedId === circle.id;
  const isFocused = focusedId === circle.id;
  const visibleMembers = circle.members.slice(0, maxAvatars);
  const overflowCount = Math.max(0, circle.members.length - maxAvatars);

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-label={`${circle.name}: ${circle.purpose}`}
      aria-level={depth + 1}
      data-part="circle-node"
      data-selected={isSelected ? 'true' : 'false'}
      data-id={circle.id}
      tabIndex={isFocused ? 0 : -1}
      ref={(el) => {
        if (el) nodeRefs.current.set(circle.id, el);
        else nodeRefs.current.delete(circle.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(circle.id);
      }}
      onFocus={() => onFocus(circle.id)}
      style={{ paddingLeft: `${depth * 24}px` }}
    >
      {/* Expand/collapse indicator */}
      {hasChildren && (
        <span
          data-part="expand-toggle"
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(circle.id);
          }}
        >
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      )}

      {/* Circle label */}
      <span data-part="circle-label">
        {circle.name}
      </span>

      {/* Purpose (shown inline, truncated) */}
      <span data-part="circle-purpose" aria-hidden="true">
        {circle.purpose}
      </span>

      {/* Member count */}
      <span data-part="member-count">
        {`${circle.members.length} member${circle.members.length !== 1 ? 's' : ''}`}
      </span>

      {/* Member avatars row */}
      <div data-part="member-avatars">
        {visibleMembers.map((member, idx) => (
          <span
            key={idx}
            data-part="member-avatar"
            aria-label={`${member.name}, ${member.role}`}
            title={`${member.name} (${member.role})`}
          >
            {member.name.charAt(0).toUpperCase()}
          </span>
        ))}
        {overflowCount > 0 && (
          <span data-part="member-overflow" aria-label={`${overflowCount} more members`}>
            {`+${overflowCount}`}
          </span>
        )}
      </div>

      {/* Policy badges */}
      {showPolicies && circle.policies && circle.policies.length > 0 && (
        <div data-part="policies" data-visible="true">
          {circle.policies.map((policy, idx) => (
            <span key={idx} data-part="policy-badge">
              {policy}
            </span>
          ))}
        </div>
      )}

      {/* Jurisdiction tag */}
      {showJurisdiction && circle.jurisdiction && (
        <span data-part="jurisdiction" data-visible="true">
          {circle.jurisdiction}
        </span>
      )}

      {/* Nested child circles */}
      {hasChildren && isExpanded && (
        <div data-part="children" role="group" data-visible="true">
          {children.map((child) => (
            <CircleNode
              key={child.circle.id}
              node={child}
              depth={depth + 1}
              expandedSet={expandedSet}
              selectedId={selectedId}
              focusedId={focusedId}
              showPolicies={showPolicies}
              showJurisdiction={showJurisdiction}
              maxAvatars={maxAvatars}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onFocus={onFocus}
              nodeRefs={nodeRefs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * CircleOrgChart Component
 * ------------------------------------------------------------------------- */

const CircleOrgChart = forwardRef<HTMLDivElement, CircleOrgChartProps>(function CircleOrgChart(
  {
    circles,
    selectedCircleId: controlledSelectedId,
    onSelectCircle,
    layout = 'tree',
    showPolicies = true,
    showJurisdiction = true,
    maxAvatars = 5,
    expandedIds: controlledExpandedIds,
    ...rest
  },
  ref,
) {
  /* --- Controlled / uncontrolled selection --- */
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  const state: CircleOrgChartState = selectedId ? 'circleSelected' : 'idle';

  /* --- Expanded set --- */
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(controlledExpandedIds ?? []),
  );
  const expandedSet = controlledExpandedIds
    ? new Set(controlledExpandedIds)
    : internalExpandedIds;

  /* --- Focused circle for roving tabindex --- */
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /* --- Build tree structure --- */
  const tree = useMemo(() => buildTree(circles), [circles]);

  /* --- Flat list for keyboard navigation --- */
  const flatList = useMemo(
    () => flattenVisible(tree, expandedSet),
    [tree, expandedSet],
  );

  /* --- Actions --- */
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

  const focusNode = useCallback((id: string) => {
    setFocusedId(id);
    nodeRefs.current.get(id)?.focus();
  }, []);

  /* --- WAI-ARIA tree keyboard navigation --- */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentIndex = flatList.findIndex((c) => c.id === focusedId);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, flatList.length - 1);
        if (flatList[nextIndex]) focusNode(flatList[nextIndex].id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (flatList[prevIndex]) focusNode(flatList[prevIndex].id);
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (focusedId) {
          const node = findNode(tree, focusedId);
          if (node && node.children.length > 0) {
            if (!expandedSet.has(focusedId)) {
              handleToggleExpand(focusedId);
            } else {
              // Move to first child
              focusNode(node.children[0].circle.id);
            }
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (focusedId) {
          if (expandedSet.has(focusedId)) {
            handleToggleExpand(focusedId);
          } else {
            // Move to parent
            const circle = findCircle(circles, focusedId);
            if (circle?.parentId) {
              focusNode(circle.parentId);
            }
          }
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (focusedId) handleSelect(focusedId);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setInternalSelectedId(undefined);
        onSelectCircle?.(undefined);
        break;
      }
      default:
        break;
    }
  }, [flatList, focusedId, tree, circles, expandedSet, focusNode, handleToggleExpand, handleSelect, onSelectCircle]);

  /* --- Selected circle detail data --- */
  const selectedCircle = selectedId ? findCircle(circles, selectedId) : undefined;

  return (
    <div
      ref={ref}
      role="tree"
      aria-label="Governance circles"
      data-surface-widget=""
      data-widget-name="circle-org-chart"
      data-part="root"
      data-state={state}
      data-layout={layout}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Tree — circle hierarchy */}
      {tree.map((rootNode) => (
        <CircleNode
          key={rootNode.circle.id}
          node={rootNode}
          depth={0}
          expandedSet={expandedSet}
          selectedId={selectedId}
          focusedId={focusedId}
          showPolicies={showPolicies}
          showJurisdiction={showJurisdiction}
          maxAvatars={maxAvatars}
          onToggleExpand={handleToggleExpand}
          onSelect={handleSelect}
          onFocus={setFocusedId}
          nodeRefs={nodeRefs}
        />
      ))}

      {/* Detail panel — visible when a circle is selected */}
      <div
        data-part="detail-panel"
        role="complementary"
        aria-label="Circle details"
        data-visible={state === 'circleSelected' ? 'true' : 'false'}
      >
        {selectedCircle && (
          <>
            <div data-part="detail-header">
              <span data-part="detail-title">{selectedCircle.name}</span>
              <button
                type="button"
                data-part="detail-close"
                aria-label="Close detail panel"
                tabIndex={0}
                onClick={() => {
                  setInternalSelectedId(undefined);
                  onSelectCircle?.(undefined);
                }}
              >
                {'\u2715'}
              </button>
            </div>

            <div data-part="detail-body">
              <div data-part="detail-field">
                <span data-part="detail-label">Purpose</span>
                <span data-part="detail-value">{selectedCircle.purpose}</span>
              </div>

              {selectedCircle.jurisdiction && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Jurisdiction</span>
                  <span data-part="detail-value">{selectedCircle.jurisdiction}</span>
                </div>
              )}

              {selectedCircle.policies && selectedCircle.policies.length > 0 && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Policies</span>
                  <span data-part="detail-value">{selectedCircle.policies.join(', ')}</span>
                </div>
              )}

              <div data-part="detail-field">
                <span data-part="detail-label">Members</span>
                <span data-part="detail-value">
                  {`${selectedCircle.members.length} member${selectedCircle.members.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Full member list in detail panel */}
              <div data-part="detail-members">
                {selectedCircle.members.map((member, idx) => (
                  <div key={idx} data-part="detail-member">
                    <span data-part="detail-member-name">{member.name}</span>
                    <span data-part="detail-member-role">{member.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

CircleOrgChart.displayName = 'CircleOrgChart';
export { CircleOrgChart };
export default CircleOrgChart;
