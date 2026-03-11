import { StackLayout, Label, ScrollView, FlexboxLayout, Progress } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * TaskPlanList state machine
 * ------------------------------------------------------------------------- */

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

export interface TaskPlanListProps {
  tasks: Task[];
  goalLabel: string;
  progress: number;
  showProgress?: boolean;
  allowReorder?: boolean;
  expandedTasks?: string[];
  onReorder?: (tasks: Task[]) => void;
}

/* ---------------------------------------------------------------------------
 * Helpers
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
 * Widget
 * ------------------------------------------------------------------------- */

export function createTaskPlanList(props: TaskPlanListProps): { view: StackLayout; dispose: () => void } {
  const {
    tasks,
    goalLabel,
    progress,
    showProgress = true,
    expandedTasks: expandedTasksProp = [],
  } = props;

  let widgetState: TaskPlanListState = 'idle';
  let expandedSet = new Set<string>(expandedTasksProp);
  let selectedId: string | null = null;
  const disposers: (() => void)[] = [];

  function send(event: TaskPlanListEvent) {
    widgetState = taskPlanListReducer(widgetState, event);
  }

  const root = new StackLayout();
  root.className = 'task-plan-list';
  root.automationText = `Task plan: ${goalLabel}`;

  // Goal header
  const goalHeader = new Label();
  goalHeader.className = 'task-plan-list-goal';
  goalHeader.text = goalLabel;
  root.addChild(goalHeader);

  // Progress bar
  if (showProgress) {
    const { complete: completedCount, total: totalCount } = countTasks(tasks);
    const progressPct = Math.min(Math.max(progress, 0), 100);

    const progressBar = new Progress();
    progressBar.className = 'task-plan-list-progress';
    progressBar.value = progressPct;
    progressBar.maxValue = 100;
    progressBar.automationText = `${completedCount} of ${totalCount} tasks complete`;
    root.addChild(progressBar);

    const progressText = new Label();
    progressText.className = 'task-plan-list-progress-text';
    progressText.text = `${completedCount} of ${totalCount} tasks complete`;
    root.addChild(progressText);
  }

  // Task list area
  const scrollView = new ScrollView();
  const taskContainer = new StackLayout();
  taskContainer.className = 'task-plan-list-tasks';
  scrollView.content = taskContainer;
  root.addChild(scrollView);

  function renderTask(task: Task, depth: number, container: StackLayout) {
    const hasSubtasks = !!(task.subtasks && task.subtasks.length > 0);
    const isExpanded = expandedSet.has(task.id);
    const isSelected = selectedId === task.id;

    const taskItem = new FlexboxLayout();
    taskItem.className = isSelected ? 'task-plan-list-item-selected' : 'task-plan-list-item';
    taskItem.flexDirection = 'row' as any;
    taskItem.alignItems = 'center' as any;
    taskItem.paddingLeft = depth * 24;
    taskItem.automationText = `${task.label} \u2014 ${STATUS_LABELS[task.status]}`;

    const statusIcon = new Label();
    statusIcon.className = `task-plan-list-status task-plan-list-status-${task.status}`;
    statusIcon.text = STATUS_ICONS[task.status];
    taskItem.addChild(statusIcon);

    const taskLabel = new Label();
    taskLabel.className = 'task-plan-list-task-label';
    taskLabel.text = task.label;
    taskItem.addChild(taskLabel);

    if (hasSubtasks) {
      const expandIcon = new Label();
      expandIcon.className = 'task-plan-list-expand-icon';
      expandIcon.text = isExpanded ? '\u25BC' : '\u25B6';
      taskItem.addChild(expandIcon);
    }

    const tapHandler = () => {
      if (selectedId === task.id) {
        selectedId = null;
        send({ type: 'DESELECT' });
      } else {
        selectedId = task.id;
        send({ type: 'SELECT_TASK', id: task.id });
      }

      if (hasSubtasks) {
        if (expandedSet.has(task.id)) {
          expandedSet.delete(task.id);
          send({ type: 'COLLAPSE_TASK', id: task.id });
        } else {
          expandedSet.add(task.id);
          send({ type: 'EXPAND_TASK', id: task.id });
        }
      }
      rebuildTasks();
    };
    taskItem.on('tap', tapHandler);

    container.addChild(taskItem);

    if (isExpanded && task.result) {
      const resultLabel = new Label();
      resultLabel.className = 'task-plan-list-result';
      resultLabel.text = task.result;
      resultLabel.textWrap = true;
      resultLabel.paddingLeft = (depth + 1) * 24;
      container.addChild(resultLabel);
    }

    if (isExpanded && hasSubtasks) {
      for (const sub of task.subtasks!) {
        renderTask(sub, depth + 1, container);
      }
    }
  }

  function rebuildTasks() {
    taskContainer.removeChildren();
    for (const task of tasks) {
      renderTask(task, 0, taskContainer);
    }
  }

  rebuildTasks();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createTaskPlanList;
