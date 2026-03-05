/* ---------------------------------------------------------------------------
 * ProofSessionTree state machine
 * States: idle (initial), selected (goal highlighted with detail panel)
 * Parallel loading states: ready (initial), fetching (loading children)
 * See widget spec: repertoire/concepts/formal-verification/widgets/proof-session-tree.widget
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

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

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

export interface ProofSessionTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Hierarchical proof goals. */
  goals: ProofGoal[];
  /** ID of the currently selected goal. */
  selectedId?: string | undefined;
  /** IDs of expanded goal nodes. */
  expandedIds?: string[];
  /** Callback when a goal is selected. */
  onSelectGoal?: (id: string | undefined) => void;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<ProofGoal['status'], string> = {
  proved: '\u2713',   // check mark
  failed: '\u2717',   // x mark
  open: '\u25CB',     // circle
  skipped: '\u2298',  // circle with slash
};

const STATUS_LABELS: Record<ProofGoal['status'], string> = {
  proved: 'Proved',
  failed: 'Failed',
  open: 'Open',
  skipped: 'Skipped',
};

/** Flatten visible tree nodes for keyboard navigation. */
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

/** Recursively find a goal by ID. */
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

/** Count total goals and proved goals in a tree. */
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

/** Compute the number of siblings for a goal. */
function siblingInfo(goals: ProofGoal[], targetId: string): { setSize: number; posInSet: number } {
  function search(nodes: ProofGoal[]): { setSize: number; posInSet: number } | undefined {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) {
        return { setSize: nodes.length, posInSet: i + 1 };
      }
      if (nodes[i].children?.length) {
        const found = search(nodes[i].children!);
        if (found) return found;
      }
    }
    return undefined;
  }
  return search(goals) ?? { setSize: 1, posInSet: 1 };
}

/* ---------------------------------------------------------------------------
 * GoalNode — recursive tree item
 * ------------------------------------------------------------------------- */

interface GoalNodeProps {
  goal: ProofGoal;
  goals: ProofGoal[];
  depth: number;
  expandedSet: Set<string>;
  selectedId: string | undefined;
  focusedId: string | undefined;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function GoalNode({
  goal,
  goals,
  depth,
  expandedSet,
  selectedId,
  focusedId,
  onToggleExpand,
  onSelect,
  onFocus,
  nodeRefs,
}: GoalNodeProps) {
  const hasChildren = !!(goal.children?.length);
  const isExpanded = expandedSet.has(goal.id);
  const isSelected = selectedId === goal.id;
  const isFocused = focusedId === goal.id;
  const { setSize, posInSet } = siblingInfo(goals, goal.id);

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-label={`${goal.label} - ${STATUS_LABELS[goal.status]}`}
      data-part="tree-item"
      data-status={goal.status}
      data-selected={isSelected ? 'true' : 'false'}
      data-id={goal.id}
      tabIndex={isFocused ? 0 : -1}
      ref={(el) => {
        if (el) nodeRefs.current.set(goal.id, el);
        else nodeRefs.current.delete(goal.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(goal.id);
      }}
      onFocus={() => onFocus(goal.id)}
      style={{ paddingLeft: `${depth * 20}px` }}
    >
      {/* Expand/collapse trigger */}
      <button
        type="button"
        data-part="expand-trigger"
        data-expanded={isExpanded ? 'true' : 'false'}
        data-visible={hasChildren ? 'true' : 'false'}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) onToggleExpand(goal.id);
        }}
        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
      >
        {isExpanded ? '\u25BC' : '\u25B6'}
      </button>

      {/* Status badge */}
      <span data-part="status-badge" data-status={goal.status} aria-hidden="true">
        {STATUS_ICONS[goal.status]}
      </span>

      {/* Label */}
      <span data-part="item-label">{goal.label}</span>

      {/* Progress bar (optional) */}
      {goal.progress != null && (
        <span
          data-part="progress-bar"
          data-visible="true"
          data-value={goal.progress}
          role="progressbar"
          aria-valuenow={goal.progress}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-label={`${Math.round(goal.progress * 100)}% complete`}
        >
          {`${Math.round(goal.progress * 100)}%`}
        </span>
      )}

      {/* Nested children */}
      {hasChildren && isExpanded && (
        <div data-part="children" role="group" data-visible="true">
          {goal.children!.map((child) => (
            <GoalNode
              key={child.id}
              goal={child}
              goals={goals}
              depth={depth + 1}
              expandedSet={expandedSet}
              selectedId={selectedId}
              focusedId={focusedId}
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
 * ProofSessionTree Component
 * ------------------------------------------------------------------------- */

const ProofSessionTree = forwardRef<HTMLDivElement, ProofSessionTreeProps>(function ProofSessionTree(
  {
    goals,
    selectedId: controlledSelectedId,
    expandedIds: controlledExpandedIds,
    onSelectGoal,
    ...rest
  },
  ref,
) {
  /* --- State machine (kept for data-state) --- */
  const [, send] = useReducer(proofSessionTreeReducer, 'idle');

  /* --- Controlled / uncontrolled selection --- */
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  /* --- Expanded set --- */
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(controlledExpandedIds ?? []),
  );
  const expandedSet = controlledExpandedIds
    ? new Set(controlledExpandedIds)
    : internalExpandedIds;

  /* --- Focused goal for roving tabindex --- */
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /* --- Flat list for keyboard navigation --- */
  const flatList = useMemo(
    () => flattenVisible(goals, expandedSet),
    [goals, expandedSet],
  );

  /* --- Summary counts --- */
  const { total, proved } = useMemo(() => countGoals(goals), [goals]);

  /* --- Actions --- */
  const handleSelect = useCallback((id: string) => {
    const nextId = id === selectedId ? undefined : id;
    setInternalSelectedId(nextId);
    onSelectGoal?.(nextId);
    send({ type: nextId ? 'SELECT' : 'DESELECT' });
  }, [selectedId, onSelectGoal]);

  const handleToggleExpand = useCallback((id: string) => {
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        send({ type: 'COLLAPSE' });
      } else {
        next.add(id);
        send({ type: 'EXPAND' });
      }
      return next;
    });
  }, []);

  const focusNode = useCallback((id: string) => {
    setFocusedId(id);
    nodeRefs.current.get(id)?.focus();
  }, []);

  /* --- WAI-ARIA tree keyboard navigation --- */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentIndex = flatList.findIndex((g) => g.id === focusedId);

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
          const goal = findGoal(goals, focusedId);
          if (goal?.children?.length) {
            if (!expandedSet.has(focusedId)) {
              handleToggleExpand(focusedId);
            } else {
              // Move focus to first child
              focusNode(goal.children[0].id);
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
          }
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (focusedId) handleSelect(focusedId);
        break;
      }
      case 'Home': {
        e.preventDefault();
        if (flatList.length) focusNode(flatList[0].id);
        break;
      }
      case 'End': {
        e.preventDefault();
        if (flatList.length) focusNode(flatList[flatList.length - 1].id);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setInternalSelectedId(undefined);
        onSelectGoal?.(undefined);
        send({ type: 'DESELECT' });
        break;
      }
      default:
        break;
    }
  }, [flatList, focusedId, goals, expandedSet, focusNode, handleToggleExpand, handleSelect, onSelectGoal]);

  /* --- Selected goal detail data --- */
  const selectedGoal = selectedId ? findGoal(goals, selectedId) : undefined;

  /* --- Derive display state from selection --- */
  const displayState: ProofSessionTreeState = selectedId ? 'selected' : 'idle';

  return (
    <div
      ref={ref}
      role="tree"
      aria-label="Proof session tree"
      data-surface-widget=""
      data-widget-name="proof-session-tree"
      data-part="root"
      data-state={displayState}
      data-count={goals.length}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Summary */}
      <div data-part="summary" aria-live="polite">
        {`${proved} of ${total} goals proved`}
      </div>

      {/* Tree items */}
      {goals.map((goal) => (
        <GoalNode
          key={goal.id}
          goal={goal}
          goals={goals}
          depth={0}
          expandedSet={expandedSet}
          selectedId={selectedId}
          focusedId={focusedId}
          onToggleExpand={handleToggleExpand}
          onSelect={handleSelect}
          onFocus={setFocusedId}
          nodeRefs={nodeRefs}
        />
      ))}

      {/* Detail panel — visible when a goal is selected */}
      <div
        data-part="detail-panel"
        role="complementary"
        aria-label="Goal details"
        data-visible={selectedGoal ? 'true' : 'false'}
      >
        {selectedGoal && (
          <>
            <div data-part="detail-header">
              <span data-part="detail-status" data-status={selectedGoal.status}>
                {STATUS_ICONS[selectedGoal.status]} {STATUS_LABELS[selectedGoal.status]}
              </span>
              <button
                type="button"
                data-part="detail-close"
                aria-label="Close detail panel"
                tabIndex={0}
                onClick={() => {
                  setInternalSelectedId(undefined);
                  onSelectGoal?.(undefined);
                  send({ type: 'DESELECT' });
                }}
              >
                {'\u2715'}
              </button>
            </div>

            <div data-part="detail-body">
              <div data-part="detail-field">
                <span data-part="detail-label">Goal</span>
                <span data-part="detail-value">{selectedGoal.label}</span>
              </div>
              <div data-part="detail-field">
                <span data-part="detail-label">Status</span>
                <span data-part="detail-value" data-status={selectedGoal.status}>
                  {STATUS_ICONS[selectedGoal.status]} {STATUS_LABELS[selectedGoal.status]}
                </span>
              </div>
              {selectedGoal.tactic && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Tactic</span>
                  <span data-part="detail-value">{selectedGoal.tactic}</span>
                </div>
              )}
              {selectedGoal.progress != null && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Progress</span>
                  <span data-part="detail-value">{`${Math.round(selectedGoal.progress * 100)}%`}</span>
                </div>
              )}
              {selectedGoal.children && selectedGoal.children.length > 0 && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Sub-goals</span>
                  <span data-part="detail-value">{selectedGoal.children.length} goals</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

ProofSessionTree.displayName = 'ProofSessionTree';
export { ProofSessionTree };
export default ProofSessionTree;
