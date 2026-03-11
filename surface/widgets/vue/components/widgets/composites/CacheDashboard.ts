// ============================================================
// CacheDashboard -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

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
  renderChart?: (data: DataPoint[], metric: string) => VNode | string;
}

export const CacheDashboard = defineComponent({
  name: 'CacheDashboard',

  props: {
    metrics: { type: null as unknown as PropType<any>, default: () => ({ hitRate: 0, missRate: 0, evictionRate: 0, latency: 0 }) },
    chartData: { type: Array as PropType<any[]>, default: () => ([]) },
    chartTimeRange: { type: String, default: '15m' },
    chartMetric: { type: String, default: 'throughput' },
    keys: { type: Array as PropType<any[]>, default: () => ([]) },
    selectedKey: { type: String },
    memoryUsed: { type: Number, default: 0 },
    memoryMax: { type: Number, default: 0 },
    autoRefreshEnabled: { type: Boolean, default: false },
    autoRefreshInterval: { type: Number, default: 5000 },
    loading: { type: Boolean, default: false },
    cacheName: { type: String, default: 'default' },
    onFlush: { type: Function as PropType<(...args: any[]) => any> },
    onDeleteKey: { type: Function as PropType<(...args: any[]) => any> },
    onRefresh: { type: Function as PropType<(...args: any[]) => any> },
    onSelectKey: { type: Function as PropType<(...args: any[]) => any> },
    onTimeRangeChange: { type: Function as PropType<(...args: any[]) => any> },
    onMetricChange: { type: Function as PropType<(...args: any[]) => any> },
    renderChart: { type: Array as PropType<any[]> },
  },

  emits: ['refresh', 'time-range-change', 'metric-change', 'select-key', 'delete-key', 'flush'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ loading: props.loading ? 'loading' : 'idle', keySelection: props.selectedKey ? 'selected' : 'none', flushConfirm: 'closed', autoRefresh: props.autoRefreshEnabled ? 'enabled' : 'disabled', selectedKey: props.selectedKey ?? null, keySearch: '', chartTimeRange: props.chartTimeRange, chartMetric: props.chartMetric, });
    const send = (action: any) => { /* state machine dispatch */ };
    const effectiveSelectedKey = props.selectedKey ?? state.value.selectedKey;
    const selectedKeyData = props.keys.find((k) => k.key === effectiveSelectedKey);
    const memPercent = props.memoryMax > 0 ? Math.round((props.memoryUsed / props.memoryMax) * 100) : 0;
    const memStatus = props.memoryMax > 0 && props.memoryUsed / props.memoryMax >= 0.9 ? 'critical' : props.memoryMax > 0 && props.memoryUsed / props.memoryMax >= 0.7 ? 'warning' : 'good';
    const timeRanges = ['1m', '5m', '15m', '1h', '6h', '24h'];
    const metricOptions = ['throughput', 'latency', 'hitRate', 'memory'];
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
        'aria-label': `Cache dashboard: ${cacheName}`,
        'aria-busy': props.loading ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'cache-dashboard',
        'data-part': 'root',
        'data-state': props.loading ? 'loading' : 'idle',
        'data-cache': props.cacheName,
      }, [
        h('div', {
          'role': 'list',
          'aria-label': 'Cache metrics',
          'data-part': 'gauge-row',
        }, [
          ...gauges.map((g) => h('div', {
              'role': 'meter',
              'aria-label': g.name,
              'aria-valuemin': 0,
              'aria-valuemax': 100,
              'aria-valuenow': g.value,
              'data-part': 'gauge',
              'data-metric': g.key,
              'data-status': gaugeStatus(g.value),
            }, [
              h('span', { 'data-part': 'gauge-label', 'aria-hidden': 'true' }, [
                g.name,
              ]),
              h('span', { 'data-part': 'gauge-value', 'aria-hidden': 'true' }, [
                g.value,
                '%',
              ]),
            ])),
        ]),
        h('div', {
          'data-part': 'chart-panel',
          'data-metric': state.value.chartMetric,
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
            h('select', {
              'data-part': 'metric-selector',
              'value': state.value.chartMetric,
              'aria-label': 'Chart metric',
              'onChange': (e) => {
                send({ type: 'SET_METRIC', value: e.target.value });
                props.onMetricChange?.(e.target.value);
              },
            }, [
              ...metricOptions.map((m) => h('option', { 'value': m }, [
                  m,
                ])),
            ]),
          ]),
          h('div', {
            'data-part': 'chart',
            'data-metric': state.value.chartMetric,
            'aria-hidden': 'true',
          }, [
            props.renderChart?.(props.chartData, state.value.chartMetric),
          ]),
        ]),
        h('div', {
          'role': 'meter',
          'aria-label': 'Memory usage',
          'aria-valuemin': 0,
          'aria-valuemax': props.memoryMax,
          'aria-valuenow': props.memoryUsed,
          'data-part': 'memory-bar',
          'data-percent': memPercent,
          'data-status': memStatus,
        }),
        h('span', { 'data-part': 'memory-label', 'aria-hidden': 'true' }, [
          formatBytes(props.memoryUsed),
          '/',
          formatBytes(props.memoryMax),
        ]),
        h('div', {
          'role': 'region',
          'aria-label': 'Key browser',
          'data-part': 'key-browser',
        }, [
          h('input', {
            'type': 'search',
            'data-part': 'key-search',
            'placeholder': 'Search keys...',
            'aria-label': 'Search cache keys',
            'value': state.value.keySearch,
            'onChange': (e) => send({ type: 'SET_KEY_SEARCH', value: e.target.value }),
          }),
          h('div', {
            'role': 'tree',
            'aria-label': 'Cache keys',
            'data-part': 'key-tree',
            'data-count': filteredKeys.length,
          }, [
            ...filteredKeys.map((k) => h('div', {
                'role': 'treeitem',
                'data-part': 'key-item',
                'data-selected': k.key === effectiveSelectedKey ? 'true' : 'false',
                'tabindex': 0,
                'onClick': () => {
                  send({ type: 'SELECT_KEY', key: k.key });
                  props.onSelectKey?.(k.key);
                },
                'onKeyDown': (e) => {
                  if (e.key === 'Enter') {
                    send({ type: 'SELECT_KEY', key: k.key });
                    props.onSelectKey?.(k.key);
                  }
                },
              }, [
                k.key,
              ])),
          ]),
        ]),
        h('div', {
          'role': 'complementary',
          'aria-label': effectiveSelectedKey ? `Details for key ${effectiveSelectedKey}` : 'Key details',
          'data-part': 'key-detail',
          'data-state': effectiveSelectedKey ? 'visible' : 'hidden',
          'hidden': !effectiveSelectedKey,
        }, [
          h('span', { 'data-part': 'key-detail-label' }, [
            effectiveSelectedKey,
          ]),
          h('span', { 'data-part': 'key-detail-value' }, [
            selectedKeyData?.value,
          ]),
          h('span', { 'data-part': 'key-detail-ttl', 'aria-label': `Time to live: ${selectedKeyData?.ttl}` }, [
            'TTL:',
            selectedKeyData?.ttl,
          ]),
          h('span', { 'data-part': 'key-detail-size' }, [
            'Size:',
            selectedKeyData?.size != null ? formatBytes(selectedKeyData.size) : 'N/A',
          ]),
          h('button', {
            'type': 'button',
            'data-part': 'delete-key-button',
            'aria-label': effectiveSelectedKey ? `Delete key ${effectiveSelectedKey}` : 'Delete key',
            'disabled': !effectiveSelectedKey,
            'hidden': !effectiveSelectedKey,
            'onClick': () => {
              if (effectiveSelectedKey) {
                props.onDeleteKey?.(effectiveSelectedKey);
                send({ type: 'DELETE_KEY_COMPLETE' });
              }
            },
          }, 'Delete key'),
        ]),
        h('button', {
          'type': 'button',
          'data-part': 'flush-button',
          'aria-label': `Flush all entries in ${cacheName}`,
          'disabled': state.value.flushConfirm === 'flushing',
          'data-state': state.value.flushConfirm === 'flushing' ? 'flushing' : 'idle',
          'onClick': () => send({ type: 'REQUEST_FLUSH' }),
        }, 'Flush cache'),
        h('button', {
          'type': 'button',
          'data-part': 'refresh-button',
          'aria-label': 'Refresh dashboard',
          'disabled': props.loading,
          'onClick': props.onRefresh,
        }, 'Refresh'),
        h('div', {
          'role': 'alertdialog',
          'aria-label': 'Confirm cache flush',
          'data-part': 'confirm-dialog',
          'data-state': state.value.flushConfirm,
          'hidden': state.value.flushConfirm === 'closed',
        }, [
          h('p', {}, 'Are you sure you want to flush all cache entries?'),
          h('button', { 'type': 'button', 'onClick': () => {
              send({ type: 'CONFIRM_FLUSH' });
              props.onFlush?.();
              send({ type: 'FLUSH_COMPLETE' });
            } }, 'Confirm'),
          h('button', { 'type': 'button', 'onClick': () => send({ type: 'CANCEL_FLUSH' }) }, 'Cancel'),
        ]),
        slots.default?.(),
      ]);
  },
});

export default CacheDashboard;