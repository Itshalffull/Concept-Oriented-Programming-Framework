/* ---------------------------------------------------------------------------
 * TaskPlanList — Vanilla implementation
 *
 * Displays a task plan with goal header, progress bar, task items with
 * status icons, subtasks, and keyboard navigation.
 * ------------------------------------------------------------------------- */

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

type TaskStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  result?: string;
  subtasks?: Task[];
}

const STATUS_ICONS: Record<string, string> = { pending: '\u25CB', running: '\u25CF', complete: '\u2713', failed: '\u2717', skipped: '\u2014' };

export interface TaskPlanListProps {
  [key: string]: unknown;
  className?: string;
  goal?: string;
  tasks?: Task[];
  onSelectTask?: (id: string) => void;
}
export interface TaskPlanListOptions { target: HTMLElement; props: TaskPlanListProps; }

let _taskPlanListUid = 0;

export class TaskPlanList {
  private el: HTMLElement;
  private props: TaskPlanListProps;
  private state: TaskPlanListState = 'idle';
  private disposers: Array<() => void> = [];
  private selectedTaskId: string | null = null;
  private expandedIds = new Set<string>();
  private focusIndex = 0;

  constructor(options: TaskPlanListOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'task-plan-list');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'list');
    this.el.setAttribute('aria-label', 'Task plan');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'task-plan-list-' + (++_taskPlanListUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = taskPlanListReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<TaskPlanListProps>): void { Object.assign(this.props, props); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private flattenTasks(tasks: Task[]): Task[] {
    const r: Task[] = [];
    for (const t of tasks) { r.push(t); if (this.expandedIds.has(t.id) && t.subtasks) r.push(...this.flattenTasks(t.subtasks)); }
    return r;
  }

  private render(): void {
    const { goal = '', tasks = [] } = this.props as { goal: string; tasks: Task[] };
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;
    const flatTasks = this.flattenTasks(tasks);

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, flatTasks.length - 1); this.updateFocus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.updateFocus(); }
      if (e.key === 'Enter') { e.preventDefault(); const t = flatTasks[this.focusIndex]; if (t) this.selectTask(t); }
      if (e.key === 'Escape') { e.preventDefault(); this.selectedTaskId = null; this.send('DESELECT'); this.rerender(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); const t = flatTasks[this.focusIndex]; if (t?.subtasks?.length) { this.expandedIds.add(t.id); this.rerender(); } }
      if (e.key === 'ArrowLeft') { e.preventDefault(); const t = flatTasks[this.focusIndex]; if (t && this.expandedIds.has(t.id)) { this.expandedIds.delete(t.id); this.rerender(); } }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Goal
    if (goal) {
      const goalHeader = document.createElement('div');
      goalHeader.setAttribute('data-part', 'goal-header');
      goalHeader.textContent = goal;
      this.el.appendChild(goalHeader);
    }

    // Progress bar
    const completedCount = tasks.filter(t => t.status === 'complete').length;
    const totalCount = tasks.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const progressBar = document.createElement('div');
    progressBar.setAttribute('data-part', 'progress-bar');
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuenow', String(pct));
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-label', `${pct}% complete`);
    const fill = document.createElement('div');
    fill.setAttribute('data-part', 'progress-fill');
    fill.style.width = `${pct}%`;
    progressBar.appendChild(fill);
    const label = document.createElement('span');
    label.setAttribute('data-part', 'progress-label');
    label.textContent = `${completedCount}/${totalCount}`;
    progressBar.appendChild(label);
    this.el.appendChild(progressBar);

    // Task list
    const taskList = document.createElement('div');
    taskList.setAttribute('data-part', 'task-list');
    taskList.setAttribute('role', 'list');
    this.renderTasks(taskList, tasks, 0, flatTasks);
    this.el.appendChild(taskList);
  }

  private renderTasks(container: HTMLElement, tasks: Task[], depth: number, flatTasks: Task[]): void {
    for (const task of tasks) {
      const flatIdx = flatTasks.indexOf(task);
      const isExpanded = this.expandedIds.has(task.id);
      const isSelected = this.selectedTaskId === task.id;

      const item = document.createElement('div');
      item.setAttribute('data-part', 'task-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('data-status', task.status);
      item.setAttribute('data-selected', isSelected ? 'true' : 'false');
      item.setAttribute('tabindex', flatIdx === this.focusIndex ? '0' : '-1');
      item.style.paddingLeft = `${depth * 16}px`;

      const statusEl = document.createElement('span');
      statusEl.setAttribute('data-part', 'task-status');
      statusEl.setAttribute('data-status', task.status);
      statusEl.textContent = STATUS_ICONS[task.status] ?? '\u25CB';
      item.appendChild(statusEl);

      const labelEl = document.createElement('span');
      labelEl.setAttribute('data-part', 'task-label');
      labelEl.textContent = task.label;
      item.appendChild(labelEl);

      if (task.result && isExpanded) {
        const resultEl = document.createElement('div');
        resultEl.setAttribute('data-part', 'task-result');
        resultEl.textContent = task.result;
        item.appendChild(resultEl);
      }

      const onClick = () => this.selectTask(task);
      item.addEventListener('click', onClick);
      this.disposers.push(() => item.removeEventListener('click', onClick));
      container.appendChild(item);

      if (isExpanded && task.subtasks?.length) {
        const subtasks = document.createElement('div');
        subtasks.setAttribute('data-part', 'subtasks');
        this.renderTasks(subtasks, task.subtasks, depth + 1, flatTasks);
        container.appendChild(subtasks);
      }
    }
  }

  private selectTask(task: Task): void {
    this.selectedTaskId = task.id;
    if (task.subtasks?.length) {
      if (this.expandedIds.has(task.id)) this.expandedIds.delete(task.id); else this.expandedIds.add(task.id);
    }
    this.send('SELECT_TASK');
    this.props.onSelectTask?.(task.id);
    this.rerender();
  }

  private updateFocus(): void {
    const nodes = this.el.querySelectorAll('[data-part="task-item"]');
    nodes.forEach((n, i) => {
      (n as HTMLElement).setAttribute('tabindex', i === this.focusIndex ? '0' : '-1');
      if (i === this.focusIndex) (n as HTMLElement).focus();
    });
  }
}

export default TaskPlanList;
