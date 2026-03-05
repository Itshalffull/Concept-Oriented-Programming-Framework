import type { HTMLAttributes, ReactNode } from 'react';

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

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<ProofGoal['status'], string> = {
  proved: '\u2713',
  failed: '\u2717',
  open: '\u25CB',
  skipped: '\u2298',
};

const STATUS_LABELS: Record<ProofGoal['status'], string> = {
  proved: 'Proved',
  failed: 'Failed',
  open: 'Open',
  skipped: 'Skipped',
};

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

function siblingInfo(goals: ProofGoal[], targetId: string): { setSize: number; posInSet: number } {
  function search(nodes: ProofGoal[]): { setSize: number; posInSet: number } | undefined {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) return { setSize: nodes.length, posInSet: i + 1 };
      if (nodes[i].children?.length) {
        const found = search(nodes[i].children!);
        if (found) return found;
      }
    }
    return undefined;
  }
  return search(goals) ?? { setSize: 1, posInSet: 1 };
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

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ProofSessionTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  goals: ProofGoal[];
  selectedId?: string | undefined;
  expandedIds?: string[];
}

/* ---------------------------------------------------------------------------
 * Recursive goal renderer
 * ------------------------------------------------------------------------- */

function renderGoalNode(
  goal: ProofGoal,
  allGoals: ProofGoal[],
  depth: number,
  expandedSet: Set<string>,
  selectedId: string | undefined,
): ReactNode {
  const hasChildren = !!(goal.children?.length);
  const isExpanded = expandedSet.has(goal.id);
  const isSelected = selectedId === goal.id;
  const { setSize, posInSet } = siblingInfo(allGoals, goal.id);

  return (
    <div
      key={goal.id}
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
      tabIndex={-1}
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

      {/* Progress bar */}
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
          {goal.children!.map((child) =>
            renderGoalNode(child, allGoals, depth + 1, expandedSet, selectedId),
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function ProofSessionTree({
  goals,
  selectedId,
  expandedIds,
  ...rest
}: ProofSessionTreeProps) {
  const expandedSet = new Set(expandedIds ?? []);
  const { total, proved } = countGoals(goals);
  const displayState = selectedId ? 'selected' : 'idle';
  const selectedGoal = selectedId ? findGoal(goals, selectedId) : undefined;

  return (
    <div
      role="tree"
      aria-label="Proof session tree"
      data-surface-widget=""
      data-widget-name="proof-session-tree"
      data-part="root"
      data-state={displayState}
      data-count={goals.length}
      {...rest}
    >
      {/* Summary */}
      <div data-part="summary" aria-live="polite">
        {`${proved} of ${total} goals proved`}
      </div>

      {/* Tree items */}
      {goals.map((goal) => renderGoalNode(goal, goals, 0, expandedSet, selectedId))}

      {/* Detail panel */}
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
}

export { ProofSessionTree };
