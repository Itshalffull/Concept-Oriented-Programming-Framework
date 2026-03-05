export type TaskPlanListState = 'idle' | 'taskSelected' | 'reordering';
export type TaskPlanListEvent =
  | { type: 'EXPAND_TASK'; id?: string }
  | { type: 'COLLAPSE_TASK'; id?: string }
  | { type: 'SELECT_TASK'; id?: string }
  | { type: 'DRAG_START' }
  | { type: 'DESELECT' }
  | { type: 'DROP' }
  | { type: 'CANCEL_DRAG' };

export function taskPlanListReducer(state: TaskPlanListState, event: TaskPlanListEvent): TaskPlanListState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_TASK') return 'idle';
      if (event.type === 'COLLAPSE_TASK') return 'idle';
      if (event.type === 'SELECT_TASK') return 'taskSelected';
      if (event.type === 'DRAG_START') return 'reordering';
      return state;
    case 'taskSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_TASK') return 'taskSelected';
      return state;
    case 'reordering':
      if (event.type === 'DROP') return 'idle';
      if (event.type === 'CANCEL_DRAG') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TaskStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  result?: string;
  subtasks?: Task[];
}

export interface TaskPlanListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  tasks: Task[];
  goalLabel: string;
  progress: number;
  showProgress?: boolean;
  allowReorder?: boolean;
  expandedTasks?: string[];
  onReorder?: (tasks: Task[]) => void;
  children?: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Status indicators                                                  */
/* ------------------------------------------------------------------ */

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: '\u25CB',   // ○
  active: '\u25CF',    // ●
  complete: '\u2713',  // ✓
  failed: '\u2717',    // ✗
  skipped: '\u2298',   // ⊘
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  complete: 'Complete',
  failed: 'Failed',
  skipped: 'Skipped',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Flatten all tasks (including subtasks) into an ordered id list for roving focus. */
function collectVisibleIds(tasks: Task[], expandedSet: Set<string>): string[] {
  const ids: string[] = [];
  for (const task of tasks) {
    ids.push(task.id);
    if (task.subtasks && task.subtasks.length > 0 && expandedSet.has(task.id)) {
      ids.push(...collectVisibleIds(task.subtasks, expandedSet));
    }
  }
  return ids;
}

/** Count completed / total across all tasks and subtasks. */
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

/* ------------------------------------------------------------------ */
/*  TaskItem                                                           */
/* ------------------------------------------------------------------ */

interface TaskItemProps {
  task: Task;
  depth: number;
  expanded: boolean;
  selected: boolean;
  focusedId: string | null;
  expandedSet: Set<string>;
  selectedId: string | null;
  widgetState: TaskPlanListState;
  allowReorder: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onDragStart: () => void;
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}

function TaskItem({
  task,
  depth,
  expanded,
  selected,
  focusedId,
  expandedSet,
  selectedId,
  widgetState,
  allowReorder,
  onToggleExpand,
  onSelect,
  onDragStart,
  itemRefs,
}: TaskItemProps) {
  const hasSubtasks = !!(task.subtasks && task.subtasks.length > 0);
  const isFocused = focusedId === task.id;

  return (
    <>
      <div
        ref={(el) => {
          if (el) itemRefs.current.set(task.id, el);
          else itemRefs.current.delete(task.id);
        }}
        role="listitem"
        data-part="task-item"
        data-status={task.status}
        data-expanded={hasSubtasks ? String(expanded) : undefined}
        data-selected={selected ? 'true' : undefined}
        data-state={widgetState}
        data-depth={depth}
        aria-expanded={hasSubtasks ? expanded : undefined}
        aria-label={`${task.label} \u2014 ${STATUS_LABELS[task.status]}`}
        tabIndex={isFocused ? 0 : -1}
        onClick={() => onSelect(task.id)}
        style={{ paddingLeft: `${depth * 1.5}rem` }}
      >
        {/* Drag handle */}
        {allowReorder && (
          <span
            data-part="drag-handle"
            data-visible="true"
            data-state={widgetState}
            aria-hidden="true"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', task.id);
              onDragStart();
            }}
          >
            &#x2630;
          </span>
        )}

        {/* Status indicator */}
        <span
          data-part="task-status"
          data-status={task.status}
          data-state={widgetState}
          aria-hidden="true"
          className={task.status === 'active' ? 'task-status-active-pulse' : undefined}
        >
          {STATUS_ICONS[task.status]}
        </span>

        {/* Label */}
        <span data-part="task-label" data-state={widgetState}>
          {task.label}
        </span>
      </div>

      {/* Result accordion */}
      {expanded && task.result && (
        <div
          data-part="task-result"
          data-visible="true"
          data-state={widgetState}
          style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}
        >
          {task.result}
        </div>
      )}

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div
          data-part="subtasks"
          data-visible="true"
          data-state={widgetState}
          role="list"
          aria-label={`Subtasks of ${task.label}`}
        >
          {task.subtasks!.map((sub) => (
            <TaskItem
              key={sub.id}
              task={sub}
              depth={depth + 1}
              expanded={expandedSet.has(sub.id)}
              selected={selectedId === sub.id}
              focusedId={focusedId}
              expandedSet={expandedSet}
              selectedId={selectedId}
              widgetState={widgetState}
              allowReorder={allowReorder}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onDragStart={onDragStart}
              itemRefs={itemRefs}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskPlanList                                                       */
/* ------------------------------------------------------------------ */

const TaskPlanList = forwardRef<HTMLDivElement, TaskPlanListProps>(function TaskPlanList(
  {
    tasks,
    goalLabel,
    progress,
    showProgress = true,
    allowReorder = true,
    expandedTasks: expandedTasksProp = [],
    onReorder,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(taskPlanListReducer, 'idle');

  /* Expanded task ids (internal state seeded from prop) */
  const [expandedSet, setExpandedSet] = useState<Set<string>>(
    () => new Set(expandedTasksProp),
  );

  /* Currently selected task id */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Roving focus index */
  const [focusedId, setFocusedId] = useState<string | null>(null);

  /* Refs for each task item DOM node */
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const visibleIds = collectVisibleIds(tasks, expandedSet);

  /* Focus a task item by id */
  const focusItem = useCallback((id: string) => {
    setFocusedId(id);
    const el = itemRefs.current.get(id);
    if (el) el.focus();
  }, []);

  /* Toggle expansion */
  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedSet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          send({ type: 'COLLAPSE_TASK', id });
        } else {
          next.add(id);
          send({ type: 'EXPAND_TASK', id });
        }
        return next;
      });
    },
    [],
  );

  /* Select a task */
  const selectTask = useCallback(
    (id: string) => {
      setSelectedId((prev) => {
        if (prev === id) {
          send({ type: 'DESELECT' });
          return null;
        }
        send({ type: 'SELECT_TASK', id });
        return id;
      });
      setFocusedId(id);
    },
    [],
  );

  /* Keyboard handler (roving tabindex) */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = focusedId ? visibleIds.indexOf(focusedId) : -1;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIdx = currentIndex < visibleIds.length - 1 ? currentIndex + 1 : 0;
          focusItem(visibleIds[nextIdx]);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIdx = currentIndex > 0 ? currentIndex - 1 : visibleIds.length - 1;
          focusItem(visibleIds[prevIdx]);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusedId && !expandedSet.has(focusedId)) {
            toggleExpand(focusedId);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedId && expandedSet.has(focusedId)) {
            toggleExpand(focusedId);
          }
          break;
        }
        case ' ': {
          e.preventDefault();
          if (focusedId) {
            toggleExpand(focusedId);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (focusedId) {
            selectTask(focusedId);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          if (selectedId) {
            setSelectedId(null);
            send({ type: 'DESELECT' });
          }
          break;
        }
        default:
          break;
      }
    },
    [focusedId, visibleIds, expandedSet, selectedId, focusItem, toggleExpand, selectTask],
  );

  /* Progress counts */
  const { complete: completedCount, total: totalCount } = countTasks(tasks);
  const progressPct = Math.min(Math.max(progress, 0), 100);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`Task plan: ${goalLabel}`}
      data-surface-widget=""
      data-widget-name="task-plan-list"
      data-part="root"
      data-state={state}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        if (!focusedId && visibleIds.length > 0) {
          setFocusedId(visibleIds[0]);
        }
      }}
      tabIndex={focusedId ? -1 : 0}
      {...rest}
    >
      {/* Goal header */}
      <div data-part="goal-header" data-state={state}>
        {goalLabel}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div
          data-part="progress-bar"
          data-visible="true"
          data-state={state}
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
      <div data-part="task-list" data-state={state} role="list" aria-label="Tasks">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            depth={0}
            expanded={expandedSet.has(task.id)}
            selected={selectedId === task.id}
            focusedId={focusedId}
            expandedSet={expandedSet}
            selectedId={selectedId}
            widgetState={state}
            allowReorder={allowReorder}
            onToggleExpand={toggleExpand}
            onSelect={selectTask}
            onDragStart={() => send({ type: 'DRAG_START' })}
            itemRefs={itemRefs}
          />
        ))}
      </div>

      {children}
    </div>
  );
});

TaskPlanList.displayName = 'TaskPlanList';
export { TaskPlanList };
export default TaskPlanList;
