/* ---------------------------------------------------------------------------
 * TaskPlanList — Server Component
 *
 * Goal decomposition display showing a hierarchical task list with
 * status indicators, progress bar, and optional subtask nesting.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type TaskStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  result?: string;
  subtasks?: Task[];
}

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: '\u25CB',
  active: '\u25CF',
  complete: '\u2713',
  failed: '\u2717',
  skipped: '\u2298',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  complete: 'Complete',
  failed: 'Failed',
  skipped: 'Skipped',
};

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function countTasks(tasks: Task[]): { complete: number; total: number } {
  let complete = 0;
  let total = 0;
  for (const t of tasks) {
    total += 1;
    if (t.status === 'complete') complete += 1;
    if (t.subtasks) {
      const sub = countTasks(t.subtasks);
      complete += sub.complete;
      total += sub.total;
    }
  }
  return { complete, total };
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TaskPlanListProps {
  /** Ordered list of tasks. */
  tasks: Task[];
  /** Goal description. */
  goalLabel: string;
  /** Progress percentage (0-100). */
  progress: number;
  /** Show the progress bar. */
  showProgress?: boolean;
  /** Allow drag reordering. */
  allowReorder?: boolean;
  /** IDs of tasks that should be expanded. */
  expandedTasks?: string[];
  /** Children rendered after the task list. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * TaskItem — recursive rendering
 * ------------------------------------------------------------------------- */

function TaskItem({
  task,
  depth,
  expandedSet,
  allowReorder,
}: {
  task: Task;
  depth: number;
  expandedSet: Set<string>;
  allowReorder: boolean;
}) {
  const hasSubtasks = !!(task.subtasks && task.subtasks.length > 0);
  const isExpanded = expandedSet.has(task.id);

  return (
    <>
      <div
        role="listitem"
        data-part="task-item"
        data-status={task.status}
        data-expanded={hasSubtasks ? String(isExpanded) : undefined}
        data-depth={depth}
        aria-expanded={hasSubtasks ? isExpanded : undefined}
        aria-label={`${task.label} \u2014 ${STATUS_LABELS[task.status]}`}
        tabIndex={-1}
        style={{ paddingLeft: `${depth * 1.5}rem` }}
      >
        {allowReorder && (
          <span
            data-part="drag-handle"
            data-visible="true"
            aria-hidden="true"
          >
            &#x2630;
          </span>
        )}

        <span
          data-part="task-status"
          data-status={task.status}
          aria-hidden="true"
        >
          {STATUS_ICONS[task.status]}
        </span>

        <span data-part="task-label">
          {task.label}
        </span>
      </div>

      {isExpanded && task.result && (
        <div
          data-part="task-result"
          data-visible="true"
          style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}
        >
          {task.result}
        </div>
      )}

      {isExpanded && hasSubtasks && (
        <div
          data-part="subtasks"
          data-visible="true"
          role="list"
          aria-label={`Subtasks of ${task.label}`}
        >
          {task.subtasks!.map((sub) => (
            <TaskItem
              key={sub.id}
              task={sub}
              depth={depth + 1}
              expandedSet={expandedSet}
              allowReorder={allowReorder}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function TaskPlanList({
  tasks,
  goalLabel,
  progress,
  showProgress = true,
  allowReorder = true,
  expandedTasks = [],
  children,
}: TaskPlanListProps) {
  const expandedSet = new Set(expandedTasks);
  const { complete: completedCount, total: totalCount } = countTasks(tasks);
  const progressPct = Math.min(Math.max(progress, 0), 100);

  return (
    <div
      role="group"
      aria-label={`Task plan: ${goalLabel}`}
      data-surface-widget=""
      data-widget-name="task-plan-list"
      data-part="root"
      data-state="idle"
      tabIndex={0}
    >
      {/* Goal header */}
      <div data-part="goal-header" data-state="idle">
        {goalLabel}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div
          data-part="progress-bar"
          data-visible="true"
          data-state="idle"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${completedCount} of ${totalCount} tasks complete`}
        >
          <div
            data-part="progress-fill"
            style={{ width: `${progressPct}%` }}
            aria-hidden="true"
          />
          <span data-part="progress-text" aria-hidden="true">
            {completedCount} of {totalCount} tasks complete
          </span>
        </div>
      )}

      {/* Task list */}
      <div data-part="task-list" data-state="idle" role="list" aria-label="Tasks">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            depth={0}
            expandedSet={expandedSet}
            allowReorder={allowReorder}
          />
        ))}
      </div>

      {children}
    </div>
  );
}

export { TaskPlanList };
