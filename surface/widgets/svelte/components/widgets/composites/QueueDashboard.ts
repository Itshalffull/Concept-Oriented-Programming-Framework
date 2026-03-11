import { uid } from '../shared/uid.js';

export interface QueueStats {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
}

export interface JobDef {
  id: string;
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'failed';
  payload?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface QueueDataPoint {
  timestamp: number;
  value: number;
}

export interface QueueDashboardProps {
  stats?: QueueStats;
  jobs?: JobDef[];
  selectedJobId?: string;
  chartData?: QueueDataPoint[];
  chartTimeRange?: '1h' | '6h' | '24h' | '7d';
  activeTab?: string;
  autoRefreshEnabled?: boolean;
  autoRefreshInterval?: number;
  loading?: boolean;
  queueName?: string;
  onRefresh?: () => void;
  onSelectJob?: (jobId: string | null) => void;
  onRetryJob?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
  onTabChange?: (tab: string) => void;
  onTimeRangeChange?: (range: string) => void;
  renderChart?: (data: QueueDataPoint[]) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface QueueDashboardInstance {
  element: HTMLElement;
  update(props: Partial<QueueDashboardProps>): void;
  destroy(): void;
}

export function createQueueDashboard(options: {
  target: HTMLElement;
  props: QueueDashboardProps;
}): QueueDashboardInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'queue-dashboard');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Queue dashboard');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const queueNameEl = document.createElement('span');
  queueNameEl.setAttribute('data-part', 'queue-name');
  headerEl.appendChild(queueNameEl);

  const refreshBtn = document.createElement('button');
  refreshBtn.setAttribute('data-part', 'refresh-button');
  refreshBtn.setAttribute('type', 'button');
  refreshBtn.setAttribute('aria-label', 'Refresh');
  refreshBtn.textContent = 'Refresh';
  headerEl.appendChild(refreshBtn);

  const statRowEl = document.createElement('div');
  statRowEl.setAttribute('data-part', 'stat-row');
  statRowEl.setAttribute('role', 'list');
  statRowEl.setAttribute('aria-label', 'Queue statistics');
  root.appendChild(statRowEl);

  const chartPanelEl = document.createElement('div');
  chartPanelEl.setAttribute('data-part', 'chart-panel');
  root.appendChild(chartPanelEl);

  const timeRangeEl = document.createElement('select');
  timeRangeEl.setAttribute('data-part', 'time-range');
  timeRangeEl.setAttribute('aria-label', 'Chart time range');
  chartPanelEl.appendChild(timeRangeEl);

  const chartEl = document.createElement('div');
  chartEl.setAttribute('data-part', 'chart');
  chartPanelEl.appendChild(chartEl);

  const tabsEl = document.createElement('div');
  tabsEl.setAttribute('data-part', 'tabs');
  tabsEl.setAttribute('role', 'tablist');
  tabsEl.setAttribute('aria-label', 'Filter jobs by status');
  root.appendChild(tabsEl);

  const jobTableEl = document.createElement('div');
  jobTableEl.setAttribute('data-part', 'job-table');
  jobTableEl.setAttribute('role', 'grid');
  root.appendChild(jobTableEl);

  refreshBtn.addEventListener('click', () => currentProps.onRefresh?.());
  cleanups.push(() => {});
  timeRangeEl.addEventListener('change', () => currentProps.onTimeRangeChange?.(timeRangeEl.value));

  function renderStats() {
    statRowEl.innerHTML = '';
    const s = currentProps.stats;
    if (!s) return;
    const items = [
      { label: 'Active', value: s.active },
      { label: 'Waiting', value: s.waiting },
      { label: 'Completed', value: s.completed },
      { label: 'Failed', value: s.failed },
    ];
    items.forEach(item => {
      const card = document.createElement('div');
      card.setAttribute('data-part', 'stat-card');
      card.setAttribute('role', 'listitem');
      const lbl = document.createElement('span');
      lbl.setAttribute('data-part', 'stat-label');
      lbl.textContent = item.label;
      card.appendChild(lbl);
      const val = document.createElement('span');
      val.setAttribute('data-part', 'stat-value');
      val.textContent = String(item.value);
      card.appendChild(val);
      statRowEl.appendChild(card);
    });
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    ['all', 'active', 'waiting', 'completed', 'failed'].forEach(tab => {
      const btn = document.createElement('button');
      btn.setAttribute('data-part', 'tab');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-selected', tab === (currentProps.activeTab ?? 'all') ? 'true' : 'false');
      btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      btn.addEventListener('click', () => currentProps.onTabChange?.(tab));
      tabsEl.appendChild(btn);
    });
  }

  function renderJobs() {
    jobTableEl.innerHTML = '';
    (currentProps.jobs ?? []).forEach(job => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'job-row');
      row.setAttribute('role', 'row');
      row.setAttribute('tabindex', '0');
      row.setAttribute('data-status', job.status);
      row.setAttribute('aria-selected', job.id === currentProps.selectedJobId ? 'true' : 'false');
      const nameCell = document.createElement('span');
      nameCell.textContent = job.name;
      row.appendChild(nameCell);
      const statusCell = document.createElement('span');
      statusCell.textContent = job.status;
      row.appendChild(statusCell);
      const timeCell = document.createElement('span');
      timeCell.textContent = job.createdAt;
      row.appendChild(timeCell);
      const actionsCell = document.createElement('span');
      if (job.status === 'failed') {
        const retryBtn = document.createElement('button');
        retryBtn.setAttribute('type', 'button');
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', (e) => { e.stopPropagation(); currentProps.onRetryJob?.(job.id); });
        actionsCell.appendChild(retryBtn);
      }
      const delBtn = document.createElement('button');
      delBtn.setAttribute('type', 'button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); currentProps.onDeleteJob?.(job.id); });
      actionsCell.appendChild(delBtn);
      row.appendChild(actionsCell);
      row.addEventListener('click', () => currentProps.onSelectJob?.(job.id));
      row.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') currentProps.onSelectJob?.(job.id); });
      jobTableEl.appendChild(row);
    });
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    queueNameEl.textContent = currentProps.queueName ?? 'Queue';
    renderStats();
    renderTabs();
    renderJobs();
    if (currentProps.renderChart) {
      chartEl.innerHTML = '';
      const rendered = currentProps.renderChart(currentProps.chartData ?? []);
      if (typeof rendered === 'string') chartEl.innerHTML = rendered;
      else chartEl.appendChild(rendered);
    }
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createQueueDashboard;
