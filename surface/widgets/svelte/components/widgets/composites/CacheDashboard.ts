import { uid } from '../shared/uid.js';

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  latency: number;
}

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface CacheKey {
  key: string;
  value?: string;
  ttl?: number;
  size?: number;
  children?: CacheKey[];
}

export interface CacheDashboardProps {
  metrics?: CacheMetrics;
  chartData?: DataPoint[];
  chartTimeRange?: '1m' | '5m' | '15m' | '1h' | '6h' | '24h';
  chartMetric?: 'throughput' | 'latency' | 'hitRate' | 'memory';
  keys?: CacheKey[];
  selectedKey?: string;
  memoryUsed?: number;
  memoryMax?: number;
  autoRefreshEnabled?: boolean;
  autoRefreshInterval?: number;
  loading?: boolean;
  cacheName?: string;
  onFlush?: () => void;
  onDeleteKey?: (key: string) => void;
  onRefresh?: () => void;
  onSelectKey?: (key: string | null) => void;
  onTimeRangeChange?: (range: string) => void;
  onMetricChange?: (metric: string) => void;
  renderChart?: (data: DataPoint[], metric: string) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface CacheDashboardInstance {
  element: HTMLElement;
  update(props: Partial<CacheDashboardProps>): void;
  destroy(): void;
}

export function createCacheDashboard(options: {
  target: HTMLElement;
  props: CacheDashboardProps;
}): CacheDashboardInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'cache-dashboard');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Cache dashboard');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const cacheNameEl = document.createElement('span');
  cacheNameEl.setAttribute('data-part', 'cache-name');
  headerEl.appendChild(cacheNameEl);

  const refreshBtn = document.createElement('button');
  refreshBtn.setAttribute('data-part', 'refresh-button');
  refreshBtn.setAttribute('type', 'button');
  refreshBtn.setAttribute('aria-label', 'Refresh cache data');
  refreshBtn.textContent = 'Refresh';
  headerEl.appendChild(refreshBtn);

  const flushBtn = document.createElement('button');
  flushBtn.setAttribute('data-part', 'flush-button');
  flushBtn.setAttribute('type', 'button');
  flushBtn.setAttribute('aria-label', 'Flush all cache entries');
  flushBtn.textContent = 'Flush';
  headerEl.appendChild(flushBtn);

  const gaugeRowEl = document.createElement('div');
  gaugeRowEl.setAttribute('data-part', 'gauge-row');
  gaugeRowEl.setAttribute('role', 'list');
  gaugeRowEl.setAttribute('aria-label', 'Cache metrics');
  root.appendChild(gaugeRowEl);

  const chartPanelEl = document.createElement('div');
  chartPanelEl.setAttribute('data-part', 'chart-panel');
  root.appendChild(chartPanelEl);

  const timeRangeEl = document.createElement('select');
  timeRangeEl.setAttribute('data-part', 'time-range');
  timeRangeEl.setAttribute('aria-label', 'Chart time range');
  chartPanelEl.appendChild(timeRangeEl);

  const metricSelectorEl = document.createElement('select');
  metricSelectorEl.setAttribute('data-part', 'metric-selector');
  metricSelectorEl.setAttribute('aria-label', 'Chart metric');
  chartPanelEl.appendChild(metricSelectorEl);

  const chartEl = document.createElement('div');
  chartEl.setAttribute('data-part', 'chart');
  chartPanelEl.appendChild(chartEl);

  const memoryBarEl = document.createElement('div');
  memoryBarEl.setAttribute('data-part', 'memory-bar');
  memoryBarEl.setAttribute('role', 'meter');
  memoryBarEl.setAttribute('aria-label', 'Memory usage');
  root.appendChild(memoryBarEl);

  const keyBrowserEl = document.createElement('div');
  keyBrowserEl.setAttribute('data-part', 'key-browser');
  keyBrowserEl.setAttribute('role', 'tree');
  keyBrowserEl.setAttribute('aria-label', 'Key browser');
  root.appendChild(keyBrowserEl);

  refreshBtn.addEventListener('click', () => currentProps.onRefresh?.());
  cleanups.push(() => {});
  flushBtn.addEventListener('click', () => currentProps.onFlush?.());
  timeRangeEl.addEventListener('change', () => currentProps.onTimeRangeChange?.(timeRangeEl.value));
  metricSelectorEl.addEventListener('change', () => currentProps.onMetricChange?.(metricSelectorEl.value));

  function renderGauges() {
    gaugeRowEl.innerHTML = '';
    const m = currentProps.metrics;
    if (!m) return;
    const items = [
      { label: 'Hit Rate', value: (m.hitRate * 100).toFixed(1) + '%' },
      { label: 'Miss Rate', value: (m.missRate * 100).toFixed(1) + '%' },
      { label: 'Eviction', value: (m.evictionRate * 100).toFixed(1) + '%' },
      { label: 'Latency', value: m.latency + 'ms' },
    ];
    items.forEach(item => {
      const g = document.createElement('div');
      g.setAttribute('data-part', 'gauge');
      g.setAttribute('role', 'listitem');
      const lbl = document.createElement('span');
      lbl.setAttribute('data-part', 'gauge-label');
      lbl.textContent = item.label;
      g.appendChild(lbl);
      const val = document.createElement('span');
      val.setAttribute('data-part', 'gauge-value');
      val.textContent = item.value;
      g.appendChild(val);
      gaugeRowEl.appendChild(g);
    });
  }

  function renderKeys() {
    keyBrowserEl.innerHTML = '';
    (currentProps.keys ?? []).forEach(k => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'key-row');
      row.setAttribute('role', 'treeitem');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-selected', k.key === currentProps.selectedKey ? 'true' : 'false');
      row.textContent = k.key;
      row.addEventListener('click', () => currentProps.onSelectKey?.(k.key));
      row.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') currentProps.onSelectKey?.(k.key);
        if ((e as KeyboardEvent).key === 'Delete') currentProps.onDeleteKey?.(k.key);
      });
      keyBrowserEl.appendChild(row);
    });
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    cacheNameEl.textContent = currentProps.cacheName ?? 'Cache';
    renderGauges();
    renderKeys();
    const used = currentProps.memoryUsed ?? 0;
    const max = currentProps.memoryMax ?? 1;
    const pct = max > 0 ? Math.round((used / max) * 100) : 0;
    memoryBarEl.setAttribute('aria-valuenow', String(pct));
    memoryBarEl.setAttribute('aria-valuemin', '0');
    memoryBarEl.setAttribute('aria-valuemax', '100');
    memoryBarEl.style.setProperty('--memory-pct', pct + '%');
    if (currentProps.renderChart) {
      chartEl.innerHTML = '';
      const result = currentProps.renderChart(currentProps.chartData ?? [], currentProps.chartMetric ?? 'throughput');
      if (typeof result === 'string') chartEl.innerHTML = result;
      else chartEl.appendChild(result);
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

export default createCacheDashboard;
