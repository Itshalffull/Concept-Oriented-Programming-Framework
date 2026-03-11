import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  WrapLayout,
  Color,
  View,
} from '@nativescript/core';

export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL' }
  | { type: 'CLICK_CELL' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'LEAVE_CELL' }
  | { type: 'DESELECT' };

export function statusGridReducer(state: StatusGridState, event: StatusGridEvent): StatusGridState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_CELL') return 'cellHovered';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'cellHovered':
      if (event.type === 'LEAVE_CELL') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

export type CellStatus = 'passed' | 'failed' | 'running' | 'pending' | 'timeout';
export type StatusFilterValue = 'all' | 'passed' | 'failed';

export interface StatusGridItem {
  id: string;
  name: string;
  status: CellStatus;
  duration?: number;
}

export interface StatusGridProps {
  items: StatusGridItem[];
  columns?: number;
  showAggregates?: boolean;
  variant?: 'compact' | 'expanded';
  onCellSelect?: (item: StatusGridItem) => void;
  filterStatus?: StatusFilterValue;
}

const STATUS_COLORS: Record<CellStatus, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  running: '#3b82f6',
  pending: '#9ca3af',
  timeout: '#f97316',
};

const STATUS_LABELS: Record<CellStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  running: 'Running',
  pending: 'Pending',
  timeout: 'Timeout',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function createStatusGrid(props: StatusGridProps): { view: View; dispose: () => void } {
  let state: StatusGridState = 'idle';
  let filter: StatusFilterValue = props.filterStatus ?? 'all';
  let selectedIndex: number | null = null;
  const disposers: (() => void)[] = [];
  const isCompact = (props.variant ?? 'expanded') === 'compact';

  function send(event: StatusGridEvent) {
    state = statusGridReducer(state, event);
  }

  const root = new StackLayout();
  root.className = 'clef-status-grid';
  root.automationText = 'Verification status matrix';

  function getFiltered(): StatusGridItem[] {
    if (filter === 'all') return props.items;
    return props.items.filter((i) => i.status === filter);
  }

  function render() {
    root.removeChildren();
    const filtered = getFiltered();

    // Summary counts
    if (props.showAggregates !== false) {
      const counts: Record<CellStatus, number> = { passed: 0, failed: 0, running: 0, pending: 0, timeout: 0 };
      for (const item of props.items) counts[item.status]++;
      const parts: string[] = [];
      if (counts.passed > 0) parts.push(`${counts.passed} passed`);
      if (counts.failed > 0) parts.push(`${counts.failed} failed`);
      if (counts.running > 0) parts.push(`${counts.running} running`);
      if (counts.pending > 0) parts.push(`${counts.pending} pending`);
      if (counts.timeout > 0) parts.push(`${counts.timeout} timeout`);

      const summaryLabel = new Label();
      summaryLabel.text = parts.join(', ');
      summaryLabel.fontSize = isCompact ? 12 : 14;
      summaryLabel.padding = '8 12';
      root.addChild(summaryLabel);
    }

    // Filter bar
    const filterBar = new StackLayout();
    filterBar.orientation = 'horizontal';
    filterBar.padding = '4 12';

    for (const value of ['all', 'passed', 'failed'] as StatusFilterValue[]) {
      const btn = new Button();
      btn.text = value.charAt(0).toUpperCase() + value.slice(1);
      btn.fontSize = isCompact ? 11 : 13;
      btn.padding = isCompact ? '2 8' : '4 12';
      btn.borderWidth = 1;
      btn.borderColor = filter === value ? new Color('#6366f1') : new Color('#d1d5db');
      btn.borderRadius = 4;
      btn.backgroundColor = filter === value ? new Color('#eef2ff') : new Color('transparent');
      btn.fontWeight = filter === value ? 'bold' : 'normal';
      btn.marginRight = 4;

      const handler = () => {
        filter = value;
        selectedIndex = null;
        send({ type: 'FILTER' });
        render();
      };
      btn.on('tap', handler);
      disposers.push(() => btn.off('tap', handler));
      filterBar.addChild(btn);
    }
    root.addChild(filterBar);

    // Grid cells
    const grid = new WrapLayout();
    grid.orientation = 'horizontal';
    grid.padding = '4 12';

    filtered.forEach((item, index) => {
      const cell = new StackLayout();
      cell.width = isCompact ? 80 : 120;
      cell.padding = isCompact ? '4' : '8 12';
      cell.borderRadius = 4;
      cell.margin = '2';
      cell.borderWidth = 2;
      cell.borderColor = selectedIndex === index ? new Color('#6366f1') : new Color('transparent');

      // Status dot
      const dot = new Label();
      dot.text = '\u25CF';
      dot.color = new Color(STATUS_COLORS[item.status]);
      dot.fontSize = isCompact ? 10 : 14;
      cell.addChild(dot);

      // Name
      const nameLabel = new Label();
      nameLabel.text = item.name;
      nameLabel.fontSize = isCompact ? 10 : 12;
      cell.addChild(nameLabel);

      // Duration
      if (!isCompact && item.duration != null) {
        const durLabel = new Label();
        durLabel.text = formatDuration(item.duration);
        durLabel.fontSize = 11;
        durLabel.color = new Color('#6b7280');
        cell.addChild(durLabel);
      }

      cell.automationText = `${item.name}: ${STATUS_LABELS[item.status]}${item.duration != null ? `, ${formatDuration(item.duration)}` : ''}`;

      const cellHandler = () => {
        selectedIndex = index;
        send({ type: 'CLICK_CELL' });
        props.onCellSelect?.(item);
        render();
      };
      cell.on('tap', cellHandler);
      disposers.push(() => cell.off('tap', cellHandler));

      grid.addChild(cell);
    });
    root.addChild(grid);

    // Detail panel for selected cell
    if (selectedIndex != null && filtered[selectedIndex]) {
      const item = filtered[selectedIndex];
      const detail = new StackLayout();
      detail.padding = '12';
      detail.borderTopWidth = 1;
      detail.borderTopColor = new Color('#e5e7eb');

      const nameLabel = new Label();
      nameLabel.text = item.name;
      nameLabel.fontWeight = 'bold';
      nameLabel.fontSize = 14;
      detail.addChild(nameLabel);

      const statusLabel = new Label();
      statusLabel.text = `Status: ${STATUS_LABELS[item.status]}`;
      statusLabel.fontSize = 13;
      detail.addChild(statusLabel);

      if (item.duration != null) {
        const durLabel = new Label();
        durLabel.text = `Duration: ${formatDuration(item.duration)}`;
        durLabel.fontSize = 13;
        durLabel.color = new Color('#6b7280');
        detail.addChild(durLabel);
      }

      root.addChild(detail);
    }
  }

  render();

  return {
    view: root,
    dispose() { disposers.forEach((d) => d()); },
  };
}

export default createStatusGrid;
