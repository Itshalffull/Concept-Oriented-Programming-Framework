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

import React, { forwardRef, useReducer, useCallback, useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

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
  children?: ReactNode;
}

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: '\u25CB',
  active: '\u25CF',
  complete: '\u2713',
  failed: '\u2717',
  skipped: '\u2298',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#9ca3af',
  active: '#3b82f6',
  complete: '#22c55e',
  failed: '#ef4444',
  skipped: '#6b7280',
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

interface TaskItemProps {
  task: Task;
  depth: number;
  expandedSet: Set<string>;
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}

function TaskItem({ task, depth, expandedSet, selectedId, onToggleExpand, onSelect }: TaskItemProps) {
  const hasSubtasks = !!(task.subtasks && task.subtasks.length > 0);
  const isExpanded = expandedSet.has(task.id);
  const isSelected = selectedId === task.id;

  return (
    <View>
      <Pressable
        onPress={() => onSelect(task.id)}
        accessibilityRole="button"
        accessibilityLabel={`${task.label} \u2014 ${task.status}`}
        accessibilityState={{ selected: isSelected, expanded: hasSubtasks ? isExpanded : undefined }}
        style={[s.taskItem, isSelected && s.taskItemSel, { paddingLeft: 12 + depth * 20 }]}
      >
        {hasSubtasks && (
          <Pressable onPress={() => onToggleExpand(task.id)} hitSlop={8}>
            <Text style={s.expandIcon}>{isExpanded ? '\u25BC' : '\u25B6'}</Text>
          </Pressable>
        )}
        <Text style={[s.statusIcon, { color: STATUS_COLORS[task.status] }]}>{STATUS_ICONS[task.status]}</Text>
        <Text style={[s.taskLabel, task.status === 'complete' && s.taskLabelDone]}>{task.label}</Text>
      </Pressable>
      {isExpanded && task.result && (
        <View style={[s.taskResult, { paddingLeft: 12 + (depth + 1) * 20 }]}>
          <Text style={s.taskResultText}>{task.result}</Text>
        </View>
      )}
      {isExpanded && hasSubtasks && task.subtasks!.map((sub) => (
        <TaskItem key={sub.id} task={sub} depth={depth + 1} expandedSet={expandedSet}
          selectedId={selectedId} onToggleExpand={onToggleExpand} onSelect={onSelect} />
      ))}
    </View>
  );
}

const TaskPlanList = forwardRef<View, TaskPlanListProps>(function TaskPlanList(
  { tasks, goalLabel, progress, showProgress = true, allowReorder = true, expandedTasks: expandedTasksProp = [], onReorder, children },
  ref,
) {
  const [state, send] = useReducer(taskPlanListReducer, 'idle');
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => new Set(expandedTasksProp));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); send({ type: 'COLLAPSE_TASK', id }); }
      else { next.add(id); send({ type: 'EXPAND_TASK', id }); }
      return next;
    });
  }, []);

  const selectTask = useCallback((id: string) => {
    setSelectedId((prev) => {
      if (prev === id) { send({ type: 'DESELECT' }); return null; }
      send({ type: 'SELECT_TASK', id }); return id;
    });
  }, []);

  const { complete: completedCount, total: totalCount } = countTasks(tasks);
  const progressPct = Math.min(Math.max(progress, 0), 100);

  return (
    <View ref={ref} testID="task-plan-list" accessibilityRole="none" accessibilityLabel={`Task plan: ${goalLabel}`} style={s.root}>
      <Text style={s.goalHeader}>{goalLabel}</Text>
      {showProgress && (
        <View style={s.progressContainer}>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={s.progressText}>{completedCount} of {totalCount} tasks complete</Text>
        </View>
      )}
      <ScrollView style={s.taskList}>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} depth={0} expandedSet={expandedSet}
            selectedId={selectedId} onToggleExpand={toggleExpand} onSelect={selectTask} />
        ))}
      </ScrollView>
      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  goalHeader: { fontSize: 15, fontWeight: '700', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  progressContainer: { padding: 12 },
  progressBar: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 3 },
  progressText: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  taskList: { flex: 1 },
  taskItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  taskItemSel: { backgroundColor: '#dbeafe' },
  expandIcon: { fontSize: 10, color: '#6b7280', width: 16 },
  statusIcon: { fontSize: 14 },
  taskLabel: { fontSize: 13, flex: 1 },
  taskLabelDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  taskResult: { paddingVertical: 4, paddingRight: 12 },
  taskResultText: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },
});

TaskPlanList.displayName = 'TaskPlanList';
export { TaskPlanList };
export default TaskPlanList;
