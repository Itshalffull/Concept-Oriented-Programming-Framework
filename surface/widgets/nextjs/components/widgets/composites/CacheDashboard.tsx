'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cacheDashboardReducer, formatBytes, gaugeStatus } from './CacheDashboard.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from cache-dashboard.widget spec props
 * ------------------------------------------------------------------------- */

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

export interface CacheDashboardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
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
  renderChart?: (data: DataPoint[], metric: string) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const CacheDashboard = forwardRef<HTMLDivElement, CacheDashboardProps>(
  function CacheDashboard(
    {
      metrics = { hitRate: 0, missRate: 0, evictionRate: 0, latency: 0 },
      chartData = [],
      chartTimeRange: controlledTimeRange = '15m',
      chartMetric: controlledMetric = 'throughput',
      keys = [],
      selectedKey: controlledSelectedKey,
      memoryUsed = 0,
      memoryMax = 0,
      autoRefreshEnabled = false,
      autoRefreshInterval = 5000,
      loading = false,
      cacheName = 'default',
      onFlush,
      onDeleteKey,
      onRefresh,
      onSelectKey,
      onTimeRangeChange,
      onMetricChange,
      renderChart,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(cacheDashboardReducer, {
      loading: loading ? 'loading' : 'idle',
      keySelection: controlledSelectedKey ? 'selected' : 'none',
      flushConfirm: 'closed',
      autoRefresh: autoRefreshEnabled ? 'enabled' : 'disabled',
      selectedKey: controlledSelectedKey ?? null,
      keySearch: '',
      chartTimeRange: controlledTimeRange,
      chartMetric: controlledMetric,
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
      if (state.autoRefresh === 'enabled') {
        intervalRef.current = setInterval(() => {
          onRefresh?.();
        }, autoRefreshInterval);
      }
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [state.autoRefresh, autoRefreshInterval, onRefresh]);

    const effectiveSelectedKey = controlledSelectedKey ?? state.selectedKey;
    const selectedKeyData = keys.find((k) => k.key === effectiveSelectedKey);
    const memPercent = memoryMax > 0 ? Math.round((memoryUsed / memoryMax) * 100) : 0;
    const memStatus = memoryMax > 0 && memoryUsed / memoryMax >= 0.9 ? 'critical' : memoryMax > 0 && memoryUsed / memoryMax >= 0.7 ? 'warning' : 'good';

    const filteredKeys = state.keySearch
      ? keys.filter((k) => k.key.toLowerCase().includes(state.keySearch.toLowerCase()))
      : keys;

    const gauges = [
      { key: 'hitRate', name: 'Hit Rate', value: metrics.hitRate },
      { key: 'missRate', name: 'Miss Rate', value: metrics.missRate },
      { key: 'evictionRate', name: 'Eviction Rate', value: metrics.evictionRate },
    ];

    const timeRanges = ['1m', '5m', '15m', '1h', '6h', '24h'];
    const metricOptions = ['throughput', 'latency', 'hitRate', 'memory'];

    return (
      <div
        ref={ref}
        role="region"
        aria-label={`Cache dashboard: ${cacheName}`}
        aria-busy={loading ? 'true' : 'false'}
        data-surface-widget=""
        data-widget-name="cache-dashboard"
        data-part="root"
        data-state={loading ? 'loading' : 'idle'}
        data-cache={cacheName}
        {...rest}
      >
        {/* Gauge Row */}
        <div role="list" aria-label="Cache metrics" data-part="gauge-row">
          {gauges.map((g) => (
            <div
              key={g.key}
              role="meter"
              aria-label={g.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={g.value}
              data-part="gauge"
              data-metric={g.key}
              data-status={gaugeStatus(g.value)}
            >
              <span data-part="gauge-label" aria-hidden="true">{g.name}</span>
              <span data-part="gauge-value" aria-hidden="true">{g.value}%</span>
            </div>
          ))}
        </div>

        {/* Chart Panel */}
        <div data-part="chart-panel" data-metric={state.chartMetric} data-range={state.chartTimeRange}>
          <div data-part="chart-controls">
            <select
              data-part="time-range"
              value={state.chartTimeRange}
              aria-label="Chart time range"
              onChange={(e) => {
                send({ type: 'SET_TIME_RANGE', value: e.target.value });
                onTimeRangeChange?.(e.target.value);
              }}
            >
              {timeRanges.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              data-part="metric-selector"
              value={state.chartMetric}
              aria-label="Chart metric"
              onChange={(e) => {
                send({ type: 'SET_METRIC', value: e.target.value });
                onMetricChange?.(e.target.value);
              }}
            >
              {metricOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div data-part="chart" data-metric={state.chartMetric} aria-hidden="true">
            {renderChart?.(chartData, state.chartMetric)}
          </div>
        </div>

        {/* Memory Bar */}
        <div
          role="meter"
          aria-label="Memory usage"
          aria-valuemin={0}
          aria-valuemax={memoryMax}
          aria-valuenow={memoryUsed}
          data-part="memory-bar"
          data-percent={memPercent}
          data-status={memStatus}
        />
        <span data-part="memory-label" aria-hidden="true">
          {formatBytes(memoryUsed)} / {formatBytes(memoryMax)}
        </span>

        {/* Key Browser */}
        <div role="region" aria-label="Key browser" data-part="key-browser">
          <input
            type="search"
            data-part="key-search"
            placeholder="Search keys..."
            aria-label="Search cache keys"
            value={state.keySearch}
            onChange={(e) => send({ type: 'SET_KEY_SEARCH', value: e.target.value })}
          />
          <div role="tree" aria-label="Cache keys" data-part="key-tree" data-count={filteredKeys.length}>
            {filteredKeys.map((k) => (
              <div
                key={k.key}
                role="treeitem"
                data-part="key-item"
                data-selected={k.key === effectiveSelectedKey ? 'true' : 'false'}
                tabIndex={0}
                onClick={() => {
                  send({ type: 'SELECT_KEY', key: k.key });
                  onSelectKey?.(k.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    send({ type: 'SELECT_KEY', key: k.key });
                    onSelectKey?.(k.key);
                  }
                }}
              >
                {k.key}
              </div>
            ))}
          </div>
        </div>

        {/* Key Detail */}
        <div
          role="complementary"
          aria-label={effectiveSelectedKey ? `Details for key ${effectiveSelectedKey}` : 'Key details'}
          data-part="key-detail"
          data-state={effectiveSelectedKey ? 'visible' : 'hidden'}
          hidden={!effectiveSelectedKey}
        >
          <span data-part="key-detail-label">{effectiveSelectedKey}</span>
          <span data-part="key-detail-value">{selectedKeyData?.value}</span>
          <span data-part="key-detail-ttl" aria-label={`Time to live: ${selectedKeyData?.ttl}`}>
            TTL: {selectedKeyData?.ttl}
          </span>
          <span data-part="key-detail-size">
            Size: {selectedKeyData?.size != null ? formatBytes(selectedKeyData.size) : 'N/A'}
          </span>
          <button
            type="button"
            data-part="delete-key-button"
            aria-label={effectiveSelectedKey ? `Delete key ${effectiveSelectedKey}` : 'Delete key'}
            disabled={!effectiveSelectedKey}
            hidden={!effectiveSelectedKey}
            onClick={() => {
              if (effectiveSelectedKey) {
                onDeleteKey?.(effectiveSelectedKey);
                send({ type: 'DELETE_KEY_COMPLETE' });
              }
            }}
          >
            Delete key
          </button>
        </div>

        {/* Actions */}
        <button
          type="button"
          data-part="flush-button"
          aria-label={`Flush all entries in ${cacheName}`}
          disabled={state.flushConfirm === 'flushing'}
          data-state={state.flushConfirm === 'flushing' ? 'flushing' : 'idle'}
          onClick={() => send({ type: 'REQUEST_FLUSH' })}
        >
          Flush cache
        </button>

        <button
          type="button"
          data-part="refresh-button"
          aria-label="Refresh dashboard"
          disabled={loading}
          onClick={onRefresh}
        >
          Refresh
        </button>

        {/* Confirm Dialog */}
        <div
          role="alertdialog"
          aria-label="Confirm cache flush"
          data-part="confirm-dialog"
          data-state={state.flushConfirm}
          hidden={state.flushConfirm === 'closed'}
        >
          <p>Are you sure you want to flush all cache entries?</p>
          <button
            type="button"
            onClick={() => {
              send({ type: 'CONFIRM_FLUSH' });
              onFlush?.();
              send({ type: 'FLUSH_COMPLETE' });
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => send({ type: 'CANCEL_FLUSH' })}
          >
            Cancel
          </button>
        </div>

        {children}
      </div>
    );
  },
);

CacheDashboard.displayName = 'CacheDashboard';
export default CacheDashboard;
