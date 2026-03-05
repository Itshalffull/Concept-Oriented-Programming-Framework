import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type TaskPlanListState = 'idle' | 'taskSelected' | 'reordering';
export type TaskPlanListEvent =
  | { type: 'EXPAND_TASK' }
  | { type: 'COLLAPSE_TASK' }
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

interface TaskItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  result?: string;
  subtasks?: TaskItem[];
}

const STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB', running: '\u25CF', complete: '\u2713', failed: '\u2717', skipped: '\u2014',
};

export const TaskPlanList = defineComponent({
  name: 'TaskPlanList',
  props: {
    tasks: { type: Array as PropType<TaskItem[]>, required: true },
    goalLabel: { type: String, required: true },
    progress: { type: Number, required: true },
    showProgress: { type: Boolean, default: true },
    allowReorder: { type: Boolean, default: true },
    expandedTasks: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: ['selectTask', 'reorder', 'expandTask', 'collapseTask'],
  setup(props, { emit }) {
    const state = ref<TaskPlanListState>('idle');
    const selectedId = ref<string | null>(null);
    const expandedSet = ref(new Set(props.expandedTasks));
    const focusIndex = ref(0);
    const dragId = ref<string | null>(null);

    function send(event: TaskPlanListEvent) {
      state.value = taskPlanListReducer(state.value, event);
    }

    function flattenTasks(tasks: TaskItem[]): TaskItem[] {
      const result: TaskItem[] = [];
      for (const t of tasks) {
        result.push(t);
        if (expandedSet.value.has(t.id) && t.subtasks) result.push(...flattenTasks(t.subtasks));
      }
      return result;
    }

    const flatTasks = computed(() => flattenTasks(props.tasks));
    const progressPercent = computed(() => Math.round(props.progress * 100));

    function toggleExpand(id: string) {
      if (expandedSet.value.has(id)) {
        expandedSet.value.delete(id);
        send({ type: 'COLLAPSE_TASK' });
        emit('collapseTask', id);
      } else {
        expandedSet.value.add(id);
        send({ type: 'EXPAND_TASK' });
        emit('expandTask', id);
      }
    }

    function selectTask(id: string) {
      selectedId.value = id;
      send({ type: 'SELECT_TASK', id });
      emit('selectTask', id);
    }

    function renderTask(task: TaskItem, depth: number): any {
      const isExpanded = expandedSet.value.has(task.id);
      const isSelected = selectedId.value === task.id;
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;

      const taskChildren: any[] = [];

      if (props.allowReorder) {
        taskChildren.push(h('div', {
          'data-part': 'drag-handle', 'aria-hidden': 'true',
          draggable: true,
          onDragstart: () => { dragId.value = task.id; send({ type: 'DRAG_START' }); },
          onDragend: () => { send({ type: 'DROP' }); emit('reorder', dragId.value, task.id); dragId.value = null; },
          style: { cursor: 'grab' },
        }, '\u2630'));
      }

      taskChildren.push(h('div', { 'data-part': 'task-status', 'data-status': task.status }, STATUS_ICONS[task.status]));
      taskChildren.push(h('span', { 'data-part': 'task-label' }, task.label));

      if (hasSubtasks) {
        taskChildren.push(h('span', {
          'data-part': 'expand-toggle', 'aria-hidden': 'true',
          onClick: (e: Event) => { e.stopPropagation(); toggleExpand(task.id); },
          style: { cursor: 'pointer' },
        }, isExpanded ? '\u25BC' : '\u25B6'));
      }

      const items: any[] = [
        h('div', {
          'data-part': 'task-item',
          'data-status': task.status,
          'data-selected': isSelected ? 'true' : 'false',
          role: 'listitem',
          tabindex: -1,
          style: { paddingLeft: `${depth * 16}px` },
          onClick: () => selectTask(task.id),
        }, taskChildren),
      ];

      if (isExpanded && task.result) {
        items.push(h('div', { 'data-part': 'task-result', style: { paddingLeft: `${(depth + 1) * 16}px` } }, task.result));
      }

      if (isExpanded && task.subtasks) {
        items.push(h('div', { 'data-part': 'subtasks', role: 'group' },
          task.subtasks.map((sub) => renderTask(sub, depth + 1))));
      }

      return h('div', { key: task.id }, items);
    }

    function handleKeydown(e: KeyboardEvent) {
      const flat = flatTasks.value;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, flat.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const t = flat[focusIndex.value]; if (t) selectTask(t.id); }
      if (e.key === 'ArrowRight') { e.preventDefault(); const t = flat[focusIndex.value]; if (t) { expandedSet.value.add(t.id); send({ type: 'EXPAND_TASK' }); } }
      if (e.key === 'ArrowLeft') { e.preventDefault(); const t = flat[focusIndex.value]; if (t) { expandedSet.value.delete(t.id); send({ type: 'COLLAPSE_TASK' }); } }
      if (e.key === 'Escape') { e.preventDefault(); selectedId.value = null; send({ type: 'DESELECT' }); }
    }

    return () => {
      const children: any[] = [];

      // Goal header
      children.push(h('div', { 'data-part': 'goal-header' }, [
        h('span', { 'data-part': 'goal-label' }, props.goalLabel),
      ]));

      // Progress bar
      if (props.showProgress) {
        children.push(h('div', {
          'data-part': 'progress-bar', role: 'progressbar',
          'aria-valuenow': progressPercent.value, 'aria-valuemin': 0, 'aria-valuemax': 100,
          'aria-label': `Progress: ${progressPercent.value}%`,
        }, [
          h('div', { 'data-part': 'progress-fill', style: { width: `${progressPercent.value}%` }, 'aria-hidden': 'true' }),
          h('span', { 'data-part': 'progress-label' }, `${progressPercent.value}%`),
        ]));
      }

      // Task list
      children.push(h('div', { 'data-part': 'task-list', role: 'list', 'aria-label': 'Tasks' },
        props.tasks.map((task) => renderTask(task, 0))));

      return h('div', {
        role: 'list',
        'aria-label': `Task plan: ${props.goalLabel}`,
        'data-surface-widget': '',
        'data-widget-name': 'task-plan-list',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default TaskPlanList;
