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

export interface TaskPlanListProps { [key: string]: unknown; class?: string; }
export interface TaskPlanListResult { element: HTMLElement; dispose: () => void; }

export function TaskPlanList(props: TaskPlanListProps): TaskPlanListResult {
  const sig = surfaceCreateSignal<TaskPlanListState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(taskPlanListReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'task-plan-list');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Task plan');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'taskSelected') send('DESELECT');
      if (s === 'reordering') send('CANCEL_DRAG');
    }
  });

  const goalHeaderEl = document.createElement('div');
  goalHeaderEl.setAttribute('data-part', 'goal-header');
  root.appendChild(goalHeaderEl);

  const progressBarEl = document.createElement('div');
  progressBarEl.setAttribute('data-part', 'progress-bar');
  progressBarEl.setAttribute('role', 'progressbar');
  progressBarEl.setAttribute('aria-label', 'Task completion progress');
  root.appendChild(progressBarEl);

  const taskListEl = document.createElement('div');
  taskListEl.setAttribute('data-part', 'task-list');
  taskListEl.setAttribute('role', 'group');
  root.appendChild(taskListEl);

  const taskItemEl = document.createElement('div');
  taskItemEl.setAttribute('data-part', 'task-item');
  taskItemEl.setAttribute('role', 'listitem');
  taskItemEl.setAttribute('tabindex', '-1');
  taskItemEl.addEventListener('click', () => send('SELECT_TASK'));
  taskListEl.appendChild(taskItemEl);

  const taskStatusEl = document.createElement('span');
  taskStatusEl.setAttribute('data-part', 'task-status');
  taskStatusEl.setAttribute('role', 'status');
  taskItemEl.appendChild(taskStatusEl);

  const taskLabelEl = document.createElement('span');
  taskLabelEl.setAttribute('data-part', 'task-label');
  taskItemEl.appendChild(taskLabelEl);

  const taskResultEl = document.createElement('div');
  taskResultEl.setAttribute('data-part', 'task-result');
  taskItemEl.appendChild(taskResultEl);

  const subtasksEl = document.createElement('div');
  subtasksEl.setAttribute('data-part', 'subtasks');
  subtasksEl.setAttribute('role', 'group');
  subtasksEl.style.display = 'none';
  taskItemEl.appendChild(subtasksEl);

  const dragHandleEl = document.createElement('div');
  dragHandleEl.setAttribute('data-part', 'drag-handle');
  dragHandleEl.setAttribute('aria-hidden', 'true');
  dragHandleEl.style.cursor = 'grab';
  dragHandleEl.textContent = '\u2630';
  dragHandleEl.addEventListener('pointerdown', () => send('DRAG_START'));
  taskItemEl.appendChild(dragHandleEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    taskItemEl.setAttribute('data-selected', s === 'taskSelected' ? 'true' : 'false');
    subtasksEl.style.display = s === 'taskSelected' ? '' : 'none';
    subtasksEl.setAttribute('data-visible', s === 'taskSelected' ? 'true' : 'false');
    dragHandleEl.style.cursor = s === 'reordering' ? 'grabbing' : 'grab';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default TaskPlanList;
