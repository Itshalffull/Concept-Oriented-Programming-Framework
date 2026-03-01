'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { queueDashboardReducer } from './QueueDashboard.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from queue-dashboard.widget spec props
 * ------------------------------------------------------------------------- */

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

export interface QueueDashboardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
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
  renderChart?: (data: QueueDataPoint[]) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const QueueDashboard = forwardRef<HTMLDivElement, QueueDashboardProps>(
  function QueueDashboard(
    {
      stats = { active: 0, waiting: 0, completed: 0, failed: 0 },
      jobs = [],
      selectedJobId: controlledSelectedJobId,
      chartData = [],
      chartTimeRange: controlledTimeRange = '1h',
      activeTab: controlledTab = 'all',
      autoRefreshEnabled = false,
      autoRefreshInterval = 5000,
      loading = false,
      queueName = 'default',
      onRefresh,
      onSelectJob,
      onRetryJob,
      onDeleteJob,
      onTabChange,
      onTimeRangeChange,
      renderChart,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(queueDashboardReducer, {
      loading: loading ? 'loading' : 'idle',
      detail: controlledSelectedJobId ? 'open' : 'closed',
      autoRefresh: autoRefreshEnabled ? 'enabled' : 'disabled',
      tab: controlledTab,
      selectedJobId: controlledSelectedJobId ?? null,
      chartTimeRange: controlledTimeRange,
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

    const effectiveJobId = controlledSelectedJobId ?? state.selectedJobId;
    const selectedJob = jobs.find((j) => j.id === effectiveJobId);

    const filteredJobs = jobs.filter((j) => {
      if (state.tab === 'all') return true;
      return j.status === state.tab;
    });

    const statCards: { metric: string; label: string; value: number }[] = [
      { metric: 'active', label: 'Active', value: stats.active },
      { metric: 'waiting', label: 'Waiting', value: stats.waiting },
      { metric: 'completed', label: 'Completed', value: stats.completed },
      { metric: 'failed', label: 'Failed', value: stats.failed },
    ];

    const tabOptions = ['all', 'active', 'waiting', 'completed', 'failed'];
    const timeRanges = ['1h', '6h', '24h', '7d'];

    return (
      <div
        ref={ref}
        role="region"
        aria-label={`Queue dashboard: ${queueName}`}
        aria-busy={loading ? 'true' : 'false'}
        data-surface-widget=""
        data-widget-name="queue-dashboard"
        data-part="root"
        data-state={loading ? 'loading' : 'idle'}
        data-queue={queueName}
        {...rest}
      >
        {/* Stat Row */}
        <div role="list" aria-label="Queue statistics" data-part="stat-row">
          {statCards.map((card) => (
            <div
              key={card.metric}
              role="listitem"
              data-part="stat-card"
              data-metric={card.metric}
              data-value={card.value}
              aria-label={`${card.label}: ${card.value}`}
            >
              <span data-part="stat-label">{card.label}</span>
              <span data-part="stat-value">{card.value}</span>
            </div>
          ))}
        </div>

        {/* Chart Panel */}
        <div
          role="img"
          aria-label={`Queue throughput over ${state.chartTimeRange}`}
          data-part="chart-panel"
          data-range={state.chartTimeRange}
        >
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
          </div>
          <div data-part="chart" data-range={state.chartTimeRange} aria-hidden="true">
            {renderChart?.(chartData)}
          </div>
        </div>

        {/* Tabs */}
        <div data-part="tabs" role="tablist" aria-label="Filter jobs by status">
          {tabOptions.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              data-part="tab"
              data-tab={tab}
              aria-selected={state.tab === tab ? 'true' : 'false'}
              onClick={() => {
                send({ type: 'CHANGE_TAB', tab });
                onTabChange?.(tab);
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Job Table */}
        <div
          role="grid"
          aria-label={`Jobs - ${state.tab}`}
          aria-busy={loading ? 'true' : 'false'}
          data-part="job-table"
          data-tab={state.tab}
        >
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              role="row"
              data-part="job-row"
              data-status={job.status}
              data-selected={job.id === effectiveJobId ? 'true' : 'false'}
              tabIndex={0}
              onClick={() => {
                send({ type: 'SELECT_JOB', jobId: job.id });
                onSelectJob?.(job.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  send({ type: 'SELECT_JOB', jobId: job.id });
                  onSelectJob?.(job.id);
                }
              }}
            >
              <span role="gridcell" data-part="job-name">{job.name}</span>
              <span role="gridcell" data-part="status-badge" data-status={job.status} aria-label={`Status: ${job.status}`}>
                {job.status}
              </span>
              <span role="gridcell" data-part="job-created">{job.createdAt}</span>
            </div>
          ))}
        </div>

        {/* Job Detail */}
        <div
          role="complementary"
          aria-label={effectiveJobId ? `Details for job ${effectiveJobId}` : 'Job details'}
          data-part="job-detail"
          data-state={state.detail}
          hidden={state.detail === 'closed'}
        >
          {selectedJob && (
            <>
              <div data-part="job-detail-header" data-status={selectedJob.status}>
                <span>Job: {selectedJob.id}</span>
                <span data-part="status-badge" data-status={selectedJob.status}>
                  {selectedJob.status}
                </span>
                <button
                  type="button"
                  aria-label="Close detail"
                  onClick={() => {
                    send({ type: 'CLOSE_DETAIL' });
                    onSelectJob?.(null);
                  }}
                >
                  Close
                </button>
              </div>
              <div data-part="job-detail-body">
                <pre>{JSON.stringify(selectedJob.payload, null, 2)}</pre>
                {selectedJob.error && (
                  <div data-part="job-error">{selectedJob.error}</div>
                )}
                {selectedJob.status === 'failed' && (
                  <button
                    type="button"
                    data-part="retry-button"
                    onClick={() => onRetryJob?.(selectedJob.id)}
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  data-part="delete-job-button"
                  onClick={() => {
                    onDeleteJob?.(selectedJob.id);
                    send({ type: 'CLOSE_DETAIL' });
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div data-part="actions">
          <button
            type="button"
            data-part="refresh-button"
            aria-label="Refresh dashboard"
            disabled={loading}
            onClick={() => {
              send({ type: 'LOAD' });
              onRefresh?.();
            }}
          >
            Refresh
          </button>

          <label data-part="auto-refresh-toggle">
            <input
              type="checkbox"
              aria-label="Auto-refresh"
              aria-checked={state.autoRefresh === 'enabled' ? 'true' : 'false'}
              checked={state.autoRefresh === 'enabled'}
              onChange={() =>
                send({ type: state.autoRefresh === 'enabled' ? 'DISABLE_REFRESH' : 'ENABLE_REFRESH' })
              }
              data-interval={autoRefreshInterval}
            />
            Auto-refresh
          </label>
        </div>

        {children}
      </div>
    );
  },
);

QueueDashboard.displayName = 'QueueDashboard';
export default QueueDashboard;
