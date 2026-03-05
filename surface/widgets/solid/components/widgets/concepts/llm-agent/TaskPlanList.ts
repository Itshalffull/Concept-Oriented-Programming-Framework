import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type TaskPlanListState = 'idle' | 'taskSelected' | 'reordering';
export type TaskPlanListEvent =
  | { type: 'EXPAND_TASK' }
  | { type: 'COLLAPSE_TASK' }
  | { type: 'SELECT_TASK' }
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

type TaskStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  result?: string;
  subtasks?: Task[];
}

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: '\u25CB', active: '\u25CF', complete: '\u2713', failed: '\u2717', skipped: '\u2298',
};
const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending', active: 'Active', complete: 'Complete', failed: 'Failed', skipped: 'Skipped',
};

function countTasks(tasks: Task[]): { complete: number; total: number } {
  let complete = 0, total = 0;
  for (const t of tasks) {
    total += 1;
    if (t.status === 'complete') complete += 1;
    if (t.subtasks) { const sub = countTasks(t.subtasks); complete += sub.complete; total += sub.total; }
  }
  return { complete, total };
}

export interface TaskPlanListProps { [key: string]: unknown; class?: string; }
export interface TaskPlanListResult { element: HTMLElement; dispose: () => void; }

export function TaskPlanList(props: TaskPlanListProps): TaskPlanListResult {
  const sig = surfaceCreateSignal<TaskPlanListState>('idle');
  const send = (event: TaskPlanListEvent) => { sig.set(taskPlanListReducer(sig.get(), event)); };

  const tasks = (props.tasks ?? []) as Task[];
  const goalLabel = String(props.goalLabel ?? '');
  const progress = Number(props.progress ?? 0);
  const showProgress = props.showProgress !== false;
  const allowReorder = props.allowReorder !== false;

  const expandedSet = new Set<string>((props.expandedTasks as string[]) ?? []);
  let selectedId: string | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'task-plan-list');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', `Task plan: ${goalLabel}`);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Goal header
  const goalHeaderEl = document.createElement('div');
  goalHeaderEl.setAttribute('data-part', 'goal-header');
  goalHeaderEl.setAttribute('data-state', sig.get());
  goalHeaderEl.textContent = goalLabel;
  root.appendChild(goalHeaderEl);

  // Progress bar
  const progressBarEl = document.createElement('div');
  const { complete: completedCount, total: totalCount } = countTasks(tasks);
  const progressPct = Math.min(Math.max(progress, 0), 100);
  if (showProgress) {
    progressBarEl.setAttribute('data-part', 'progress-bar');
    progressBarEl.setAttribute('data-visible', 'true');
    progressBarEl.setAttribute('data-state', sig.get());
    progressBarEl.setAttribute('role', 'progressbar');
    progressBarEl.setAttribute('aria-valuenow', String(progressPct));
    progressBarEl.setAttribute('aria-valuemin', '0');
    progressBarEl.setAttribute('aria-valuemax', '100');
    progressBarEl.setAttribute('aria-label', `${completedCount} of ${totalCount} tasks complete`);

    const fillEl = document.createElement('div');
    fillEl.setAttribute('data-part', 'progress-fill');
    fillEl.setAttribute('aria-hidden', 'true');
    fillEl.style.width = `${progressPct}%`;
    progressBarEl.appendChild(fillEl);

    const textEl = document.createElement('span');
    textEl.setAttribute('data-part', 'progress-text');
    textEl.setAttribute('aria-hidden', 'true');
    textEl.textContent = `${completedCount} of ${totalCount} tasks complete`;
    progressBarEl.appendChild(textEl);
    root.appendChild(progressBarEl);
  }

  // Task list
  const taskListEl = document.createElement('div');
  taskListEl.setAttribute('data-part', 'task-list');
  taskListEl.setAttribute('data-state', sig.get());
  taskListEl.setAttribute('role', 'list');
  taskListEl.setAttribute('aria-label', 'Tasks');
  root.appendChild(taskListEl);

  const renderTaskItem = (task: Task, depth: number, container: HTMLElement) => {
    const hasSubtasks = !!(task.subtasks && task.subtasks.length > 0);
    const isExpanded = expandedSet.has(task.id);
    const isSelected = selectedId === task.id;

    const itemEl = document.createElement('div');
    itemEl.setAttribute('role', 'listitem');
    itemEl.setAttribute('data-part', 'task-item');
    itemEl.setAttribute('data-status', task.status);
    if (hasSubtasks) itemEl.setAttribute('data-expanded', String(isExpanded));
    if (isSelected) itemEl.setAttribute('data-selected', 'true');
    itemEl.setAttribute('data-state', sig.get());
    itemEl.setAttribute('data-depth', String(depth));
    if (hasSubtasks) itemEl.setAttribute('aria-expanded', String(isExpanded));
    itemEl.setAttribute('aria-label', `${task.label} \u2014 ${STATUS_LABELS[task.status]}`);
    itemEl.setAttribute('tabindex', '-1');
    itemEl.style.paddingLeft = `${depth * 1.5}rem`;

    if (allowReorder) {
      const dragHandle = document.createElement('span');
      dragHandle.setAttribute('data-part', 'drag-handle');
      dragHandle.setAttribute('data-visible', 'true');
      dragHandle.setAttribute('data-state', sig.get());
      dragHandle.setAttribute('aria-hidden', 'true');
      dragHandle.setAttribute('draggable', 'true');
      dragHandle.innerHTML = '&#x2630;';
      dragHandle.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('text/plain', task.id);
        send({ type: 'DRAG_START' });
      });
      itemEl.appendChild(dragHandle);
    }

    const statusSpan = document.createElement('span');
    statusSpan.setAttribute('data-part', 'task-status');
    statusSpan.setAttribute('data-status', task.status);
    statusSpan.setAttribute('data-state', sig.get());
    statusSpan.setAttribute('aria-hidden', 'true');
    statusSpan.textContent = STATUS_ICONS[task.status];
    itemEl.appendChild(statusSpan);

    const labelSpan = document.createElement('span');
    labelSpan.setAttribute('data-part', 'task-label');
    labelSpan.setAttribute('data-state', sig.get());
    labelSpan.textContent = task.label;
    itemEl.appendChild(labelSpan);

    itemEl.addEventListener('click', () => {
      if (selectedId === task.id) { selectedId = null; send({ type: 'DESELECT' }); }
      else { selectedId = task.id; send({ type: 'SELECT_TASK' }); }
      if (expandedSet.has(task.id)) { expandedSet.delete(task.id); send({ type: 'COLLAPSE_TASK' }); }
      else { expandedSet.add(task.id); send({ type: 'EXPAND_TASK' }); }
      renderTasks();
    });

    container.appendChild(itemEl);

    if (isExpanded && task.result) {
      const resultEl = document.createElement('div');
      resultEl.setAttribute('data-part', 'task-result');
      resultEl.setAttribute('data-visible', 'true');
      resultEl.setAttribute('data-state', sig.get());
      resultEl.style.paddingLeft = `${(depth + 1) * 1.5}rem`;
      resultEl.textContent = task.result;
      container.appendChild(resultEl);
    }

    if (isExpanded && hasSubtasks) {
      const subtasksEl = document.createElement('div');
      subtasksEl.setAttribute('data-part', 'subtasks');
      subtasksEl.setAttribute('data-visible', 'true');
      subtasksEl.setAttribute('data-state', sig.get());
      subtasksEl.setAttribute('role', 'list');
      subtasksEl.setAttribute('aria-label', `Subtasks of ${task.label}`);
      for (const sub of task.subtasks!) {
        renderTaskItem(sub, depth + 1, subtasksEl);
      }
      container.appendChild(subtasksEl);
    }
  };

  const renderTasks = () => {
    taskListEl.innerHTML = '';
    for (const task of tasks) {
      renderTaskItem(task, 0, taskListEl);
    }
  };

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && selectedId) { e.preventDefault(); selectedId = null; send({ type: 'DESELECT' }); renderTasks(); }
  });

  renderTasks();

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default TaskPlanList;
