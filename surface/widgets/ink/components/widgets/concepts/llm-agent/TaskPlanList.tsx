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

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface TaskItem {
  id: string;
  label: string;
  status?: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  subtasks?: TaskItem[];
}

export interface TaskPlanListProps {
  tasks: TaskItem[];
  goalLabel: string;
  progress: number;
  showProgress?: boolean;
  allowReorder?: boolean;
  expandedTasks?: Array<string>;
  onSelectTask?: (id: string) => void;
  isFocused?: boolean;
}

const TASK_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '\u25CB', color: 'gray' },
  running: { icon: '\u25D4', color: 'yellow' },
  done: { icon: '\u2713', color: 'green' },
  failed: { icon: '\u2717', color: 'red' },
  skipped: { icon: '\u2298', color: 'gray' },
};

function flattenTasks(tasks: TaskItem[], depth = 0): Array<TaskItem & { depth: number }> {
  const result: Array<TaskItem & { depth: number }> = [];
  for (const task of tasks) {
    result.push({ ...task, depth });
    if (task.subtasks) result.push(...flattenTasks(task.subtasks, depth + 1));
  }
  return result;
}

export function TaskPlanList({
  tasks,
  goalLabel,
  progress,
  showProgress = true,
  allowReorder = false,
  onSelectTask,
  isFocused = false,
}: TaskPlanListProps) {
  const [state, send] = useReducer(taskPlanListReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);

  const flat = flattenTasks(tasks);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(flat.length - 1, prev + 1));
    }
    if (key.return) {
      const task = flat[cursorIndex];
      if (task) {
        send({ type: 'SELECT_TASK' });
        onSelectTask?.(task.id);
      }
    }
    if (key.escape) send({ type: 'DESELECT' });
  });

  const barWidth = 20;
  const filled = Math.round((progress / 100) * barWidth);
  const progressBar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Text bold>{goalLabel}</Text>

      {showProgress && (
        <Box marginTop={1}>
          <Text color={progress >= 100 ? 'green' : progress >= 50 ? 'yellow' : 'cyan'}>
            {progressBar}
          </Text>
          <Text> {progress}%</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {flat.map((task, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const { icon, color } = TASK_ICONS[task.status ?? 'pending'];
          const indent = '  '.repeat(task.depth);

          return (
            <Box key={task.id}>
              <Text color={isCursor ? 'cyan' : undefined}>
                {isCursor ? '\u25B6 ' : '  '}
              </Text>
              <Text>{indent}</Text>
              <Text color={color}>{icon} </Text>
              <Text strikethrough={task.status === 'skipped'}>{task.label}</Text>
            </Box>
          );
        })}
      </Box>

      {state === 'reordering' && (
        <Box marginTop={1}>
          <Text color="yellow">[Reordering mode] [{'\u2191\u2193'}] Move [Enter] Drop [Esc] Cancel</Text>
        </Box>
      )}

      {isFocused && state !== 'reordering' && (
        <Box marginTop={1}>
          <Text color="gray">
            [{'\u2191\u2193'}] Navigate [Enter] Select
            {allowReorder ? ' [m] Move' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default TaskPlanList;
