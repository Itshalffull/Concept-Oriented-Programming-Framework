// ============================================================
// Clef Surface NativeScript Widget — QueueDashboard
//
// Queue monitoring dashboard showing queue metrics (depth,
// throughput, error rate, latency) and a scrollable list of
// pending and in-progress queue items with retry/remove actions.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Button, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export type QueueItemStatus = 'pending' | 'processing' | 'failed' | 'completed';

export interface QueueItem {
  id: string;
  name: string;
  status: QueueItemStatus;
  attempts?: number;
  addedAt: string;
  error?: string;
}

export interface QueueMetrics {
  depth: number;
  processing: number;
  throughput: number;
  errorRate: number;
  avgLatencyMs: number;
}

// --------------- Props ---------------

export interface QueueDashboardProps {
  /** Queue name/title. */
  queueName?: string;
  /** Aggregate queue metrics. */
  metrics?: QueueMetrics;
  /** Items currently in the queue. */
  items?: QueueItem[];
  /** Called when retry is tapped on a failed item. */
  onRetry?: (id: string) => void;
  /** Called when remove is tapped. */
  onRemove?: (id: string) => void;
  /** Called when purge-all is tapped. */
  onPurge?: () => void;
}

// --------------- Helpers ---------------

const STATUS_COLORS: Record<QueueItemStatus, string> = {
  pending: '#9E9E9E',
  processing: '#2196F3',
  failed: '#F44336',
  completed: '#4CAF50',
};

// --------------- Component ---------------

export function createQueueDashboard(props: QueueDashboardProps = {}): StackLayout {
  const {
    queueName = 'Queue',
    metrics = { depth: 0, processing: 0, throughput: 0, errorRate: 0, avgLatencyMs: 0 },
    items = [],
    onRetry,
    onRemove,
    onPurge,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-queue-dashboard';
  container.padding = 12;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto';
  header.marginBottom = 12;

  const titleLabel = new Label();
  titleLabel.text = queueName;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  if (onPurge) {
    const purgeBtn = new Button();
    purgeBtn.text = 'Purge';
    purgeBtn.fontSize = 11;
    purgeBtn.padding = 4;
    purgeBtn.color = '#F44336' as any;
    GridLayout.setColumn(purgeBtn, 1);
    purgeBtn.on('tap', () => onPurge());
    header.addChild(purgeBtn);
  }

  container.addChild(header);

  // Metrics grid (2 rows x 3 cols)
  const metricsGrid = new GridLayout();
  metricsGrid.columns = '*, *, *';
  metricsGrid.rows = 'auto, auto';
  metricsGrid.marginBottom = 12;

  const metricItems: Array<{ label: string; value: string; row: number; col: number }> = [
    { label: 'Depth', value: `${metrics.depth}`, row: 0, col: 0 },
    { label: 'Processing', value: `${metrics.processing}`, row: 0, col: 1 },
    { label: 'Throughput', value: `${metrics.throughput}/s`, row: 0, col: 2 },
    { label: 'Error Rate', value: `${(metrics.errorRate * 100).toFixed(1)}%`, row: 1, col: 0 },
    { label: 'Avg Latency', value: `${metrics.avgLatencyMs}ms`, row: 1, col: 1 },
    { label: 'Total Items', value: `${items.length}`, row: 1, col: 2 },
  ];

  metricItems.forEach(({ label, value, row, col }) => {
    const cell = new StackLayout();
    cell.horizontalAlignment = 'center';
    cell.padding = 6;

    const valLabel = new Label();
    valLabel.text = value;
    valLabel.fontWeight = 'bold';
    valLabel.fontSize = 16;
    valLabel.horizontalAlignment = 'center';
    cell.addChild(valLabel);

    const descLabel = new Label();
    descLabel.text = label;
    descLabel.opacity = 0.6;
    descLabel.fontSize = 10;
    descLabel.horizontalAlignment = 'center';
    cell.addChild(descLabel);

    GridLayout.setRow(cell as any, row);
    GridLayout.setColumn(cell as any, col);
    metricsGrid.addChild(cell);
  });

  container.addChild(metricsGrid);

  // Items list
  if (items.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'Queue is empty.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 8;
    container.addChild(emptyLabel);
    return container;
  }

  const listTitle = new Label();
  listTitle.text = 'Items';
  listTitle.fontWeight = 'bold';
  listTitle.fontSize = 14;
  listTitle.marginBottom = 4;
  container.addChild(listTitle);

  const scrollView = new ScrollView();
  const list = new StackLayout();

  items.forEach((item) => {
    const row = new GridLayout();
    row.columns = 'auto, *, auto';
    row.padding = 6;
    row.marginBottom = 2;
    row.borderRadius = 4;
    row.borderLeftWidth = 3;
    row.borderColor = STATUS_COLORS[item.status];
    row.backgroundColor = '#FAFAFA' as any;

    // Status dot
    const statusDot = new Label();
    statusDot.text = '\u25CF';
    statusDot.color = STATUS_COLORS[item.status] as any;
    statusDot.fontSize = 10;
    statusDot.verticalAlignment = 'middle';
    statusDot.marginRight = 6;
    GridLayout.setColumn(statusDot, 0);
    row.addChild(statusDot);

    // Content
    const contentStack = new StackLayout();
    GridLayout.setColumn(contentStack, 1);

    const nameLabel = new Label();
    nameLabel.text = item.name;
    nameLabel.fontSize = 12;
    nameLabel.fontWeight = 'bold';
    contentStack.addChild(nameLabel);

    const metaLabel = new Label();
    metaLabel.text = `${item.status} \u2022 ${item.addedAt}${item.attempts ? ` \u2022 ${item.attempts} attempts` : ''}`;
    metaLabel.fontSize = 10;
    metaLabel.opacity = 0.5;
    contentStack.addChild(metaLabel);

    if (item.error) {
      const errorLabel = new Label();
      errorLabel.text = item.error;
      errorLabel.fontSize = 10;
      errorLabel.color = '#F44336' as any;
      errorLabel.textWrap = true;
      contentStack.addChild(errorLabel);
    }

    row.addChild(contentStack);

    // Actions
    const actionsStack = new StackLayout();
    actionsStack.orientation = 'horizontal' as any;
    actionsStack.verticalAlignment = 'middle';
    GridLayout.setColumn(actionsStack, 2);

    if (item.status === 'failed' && onRetry) {
      const retryBtn = new Button();
      retryBtn.text = 'Retry';
      retryBtn.fontSize = 10;
      retryBtn.padding = 2;
      retryBtn.marginRight = 4;
      retryBtn.on('tap', () => onRetry(item.id));
      actionsStack.addChild(retryBtn);
    }

    if (onRemove) {
      const removeBtn = new Button();
      removeBtn.text = '\u2715';
      removeBtn.fontSize = 10;
      removeBtn.padding = 2;
      removeBtn.on('tap', () => onRemove(item.id));
      actionsStack.addChild(removeBtn);
    }

    row.addChild(actionsStack);
    list.addChild(row);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createQueueDashboard.displayName = 'QueueDashboard';
export default createQueueDashboard;
