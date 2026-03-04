// ============================================================
// QueueDashboard -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

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
  renderChart?: (data: QueueDataPoint[]) => VNode | string;
}

export const QueueDashboard = defineComponent({
  name: 'QueueDashboard',

  props: {
    stats: { type: null as unknown as PropType<any>, default: () => ({ active: 0, waiting: 0, completed: 0, failed: 0 }) },
    jobs: { type: Array as PropType<any[]>, default: () => ([]) },
    selectedJobId: { type: String },
    chartData: { type: Array as PropType<any[]>, default: () => ([]) },
    chartTimeRange: { type: String, default: '1h' },
    activeTab: { type: String, default: 'all' },
    autoRefreshEnabled: { type: Boolean, default: false },
    autoRefreshInterval: { type: Number, default: 5000 },
    loading: { type: Boolean, default: false },
    queueName: { type: String, default: 'default' },
    onRefresh: { type: Function as PropType<(...args: any[]) => any> },
    onSelectJob: { type: Function as PropType<(...args: any[]) => any> },
    onRetryJob: { type: Function as PropType<(...args: any[]) => any> },
    onDeleteJob: { type: Function as PropType<(...args: any[]) => any> },
    onTabChange: { type: Function as PropType<(...args: any[]) => any> },
    onTimeRangeChange: { type: Function as PropType<(...args: any[]) => any> },
    renderChart: { type: Array as PropType<any[]> },
  },

  emits: ['refresh', 'time-range-change', 'tab-change', 'select-job', 'retry-job', 'delete-job'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ loading: props.loading ? 'loading' : 'idle', detail: props.selectedJobId ? 'open' : 'closed', autoRefresh: props.autoRefreshEnabled ? 'enabled' : 'disabled', tab: props.activeTab, selectedJobId: props.selectedJobId ?? null, chartTimeRange: props.chartTimeRange, });
    const send = (action: any) => { /* state machine dispatch */ };
    const effectiveJobId = props.selectedJobId ?? state.value.selectedJobId;
    const selectedJob = props.jobs.find((j) => j.id === effectiveJobId);
    const tabOptions = ['all', 'active', 'waiting', 'completed', 'failed'];
    const timeRanges = ['1h', '6h', '24h', '7d'];
    onMounted(() => {
      if (state.value.autoRefresh === 'enabled') {
      intervalRef.value = setInterval(() => {
      props.onRefresh?.();
      }, props.autoRefreshInterval);
      }
    });
    onUnmounted(() => {
      if (intervalRef.value) clearInterval(intervalRef.value);
    });

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': `Queue dashboard: ${queueName}`,
        'aria-busy': props.loading ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'queue-dashboard',
        'data-part': 'root',
        'data-state': props.loading ? 'loading' : 'idle',
        'data-queue': props.queueName,
      }, [
        h('div', {
          'role': 'list',
          'aria-label': 'Queue statistics',
          'data-part': 'stat-row',
        }, [
          ...statCards.map((card) => h('div', {
              'role': 'listitem',
              'data-part': 'stat-card',
              'data-metric': card.metric,
              'data-value': card.value,
              'aria-label': `${card.label}: ${card.value}`,
            }, [
              h('span', { 'data-part': 'stat-label' }, [
                card.label,
              ]),
              h('span', { 'data-part': 'stat-value' }, [
                card.value,
              ]),
            ])),
        ]),
        h('div', {
          'role': 'img',
          'aria-label': `Queue throughput over ${state.chartTimeRange}`,
          'data-part': 'chart-panel',
          'data-range': state.value.chartTimeRange,
        }, [
          h('div', { 'data-part': 'chart-controls' }, [
            h('select', {
              'data-part': 'time-range',
              'value': state.value.chartTimeRange,
              'aria-label': 'Chart time range',
              'onChange': (e) => {
                send({ type: 'SET_TIME_RANGE', value: e.target.value });
                props.onTimeRangeChange?.(e.target.value);
              },
            }, [
              ...timeRanges.map((r) => h('option', { 'value': r }, [
                  r,
                ])),
            ]),
          ]),
          h('div', {
            'data-part': 'chart',
            'data-range': state.value.chartTimeRange,
            'aria-hidden': 'true',
          }, [
            props.renderChart?.(props.chartData),
          ]),
        ]),
        h('div', {
          'data-part': 'tabs',
          'role': 'tablist',
          'aria-label': 'Filter jobs by status',
        }, [
          ...tabOptions.map((tab) => h('button', {
              'type': 'button',
              'role': 'tab',
              'data-part': 'tab',
              'data-tab': tab,
              'aria-selected': state.value.tab === tab ? 'true' : 'false',
              'onClick': () => {
                send({ type: 'CHANGE_TAB', tab });
                props.onTabChange?.(tab);
              },
            }, [
              tab.charAt(0).toUpperCase() + tab.slice(1),
            ])),
        ]),
        h('div', {
          'role': 'grid',
          'aria-label': `Jobs - ${state.tab}`,
          'aria-busy': props.loading ? 'true' : 'false',
          'data-part': 'job-table',
          'data-tab': state.value.tab,
        }, [
          ...filteredJobs.map((job) => h('div', {
              'role': 'row',
              'data-part': 'job-row',
              'data-status': job.status,
              'data-selected': job.id === effectiveJobId ? 'true' : 'false',
              'tabindex': 0,
              'onClick': () => {
                send({ type: 'SELECT_JOB', jobId: job.id });
                props.onSelectJob?.(job.id);
              },
              'onKeyDown': (e) => {
                if (e.key === 'Enter') {
                  send({ type: 'SELECT_JOB', jobId: job.id });
                  props.onSelectJob?.(job.id);
                }
              },
            }, [
              h('span', { 'role': 'gridcell', 'data-part': 'job-name' }, [
                job.name,
              ]),
              h('span', {
                'role': 'gridcell',
                'data-part': 'status-badge',
                'data-status': job.status,
                'aria-label': `Status: ${job.status}`,
              }, [
                job.status,
              ]),
              h('span', { 'role': 'gridcell', 'data-part': 'job-created' }, [
                job.createdAt,
              ]),
            ])),
        ]),
        h('div', {
          'role': 'complementary',
          'aria-label': effectiveJobId ? `Details for job ${effectiveJobId}` : 'Job details',
          'data-part': 'job-detail',
          'data-state': state.value.detail,
          'hidden': state.value.detail === 'closed',
        }, [
          selectedJob ? [
              h('div', { 'data-part': 'job-detail-header', 'data-status': selectedJob.status }, [
                h('span', {}, [
                  'Job:',
                  selectedJob.id,
                ]),
                h('span', { 'data-part': 'status-badge', 'data-status': selectedJob.status }, [
                  selectedJob.status,
                ]),
                h('button', {
                  'type': 'button',
                  'aria-label': 'Close detail',
                  'onClick': () => {
                    send({ type: 'CLOSE_DETAIL' });
                    props.onSelectJob?.(null);
                  },
                }, 'Close'),
              ]),
              h('div', { 'data-part': 'job-detail-body' }, [
                h('pre', {}, [
                  JSON.stringify(selectedJob.payload, null, 2),
                ]),
                selectedJob.error ? h('div', { 'data-part': 'job-error' }, [
                    selectedJob.error,
                  ]) : null,
                selectedJob.status === 'failed' ? h('button', {
                    'type': 'button',
                    'data-part': 'retry-button',
                    'onClick': () => props.onRetryJob?.(selectedJob.id),
                  }, 'Retry') : null,
                h('button', {
                  'type': 'button',
                  'data-part': 'delete-job-button',
                  'onClick': () => {
                    props.onDeleteJob?.(selectedJob.id);
                    send({ type: 'CLOSE_DETAIL' });
                  },
                }, 'Delete'),
              ]),
            ] : null,
        ]),
        h('div', { 'data-part': 'actions' }, [
          h('button', {
            'type': 'button',
            'data-part': 'refresh-button',
            'aria-label': 'Refresh dashboard',
            'disabled': props.loading,
            'onClick': () => {
              send({ type: 'LOAD' });
              props.onRefresh?.();
            },
          }, 'Refresh'),
          h('label', { 'data-part': 'auto-refresh-toggle' }, [
            h('input', {
              'type': 'checkbox',
              'aria-label': 'Auto-refresh',
              'aria-checked': state.value.autoRefresh === 'enabled' ? 'true' : 'false',
              'checked': state.value.autoRefresh === 'enabled',
              'onChange': () =>
                send({ type: state.value.autoRefresh === 'enabled' ? 'DISABLE_REFRESH' : 'ENABLE_REFRESH' }),
              'data-interval': props.autoRefreshInterval,
            }),
            'Auto-refresh',
          ]),
        ]),
        slots.default?.(),
      ]);
  },
});

export default QueueDashboard;