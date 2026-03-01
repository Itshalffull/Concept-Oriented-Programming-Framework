/* ---------------------------------------------------------------------------
 * CacheDashboard reducer — extracted state machine
 * States: loading, keySelection, flushConfirm, autoRefresh
 * ------------------------------------------------------------------------- */

export interface CacheDashboardState {
  loading: 'idle' | 'loading' | 'error';
  keySelection: 'none' | 'selected';
  flushConfirm: 'closed' | 'open' | 'flushing';
  autoRefresh: 'disabled' | 'enabled';
  selectedKey: string | null;
  keySearch: string;
  chartTimeRange: string;
  chartMetric: string;
}

export type CacheDashboardEvent =
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' }
  | { type: 'SELECT_KEY'; key: string }
  | { type: 'DESELECT' }
  | { type: 'REQUEST_FLUSH' }
  | { type: 'CONFIRM_FLUSH' }
  | { type: 'CANCEL_FLUSH' }
  | { type: 'FLUSH_COMPLETE' }
  | { type: 'FLUSH_ERROR' }
  | { type: 'DELETE_KEY_COMPLETE' }
  | { type: 'ENABLE_REFRESH' }
  | { type: 'DISABLE_REFRESH' }
  | { type: 'SET_KEY_SEARCH'; value: string }
  | { type: 'SET_TIME_RANGE'; value: string }
  | { type: 'SET_METRIC'; value: string };

export function cacheDashboardReducer(
  state: CacheDashboardState,
  event: CacheDashboardEvent,
): CacheDashboardState {
  switch (event.type) {
    case 'LOAD':
      return { ...state, loading: 'loading' };
    case 'LOAD_COMPLETE':
      return { ...state, loading: 'idle' };
    case 'LOAD_ERROR':
      return { ...state, loading: 'error' };
    case 'SELECT_KEY':
      return { ...state, keySelection: 'selected', selectedKey: event.key };
    case 'DESELECT':
      return { ...state, keySelection: 'none', selectedKey: null };
    case 'DELETE_KEY_COMPLETE':
      return { ...state, keySelection: 'none', selectedKey: null };
    case 'REQUEST_FLUSH':
      return { ...state, flushConfirm: 'open' };
    case 'CONFIRM_FLUSH':
      return { ...state, flushConfirm: 'flushing' };
    case 'CANCEL_FLUSH':
      return { ...state, flushConfirm: 'closed' };
    case 'FLUSH_COMPLETE':
      return { ...state, flushConfirm: 'closed' };
    case 'FLUSH_ERROR':
      return { ...state, flushConfirm: 'open' };
    case 'ENABLE_REFRESH':
      return { ...state, autoRefresh: 'enabled' };
    case 'DISABLE_REFRESH':
      return { ...state, autoRefresh: 'disabled' };
    case 'SET_KEY_SEARCH':
      return { ...state, keySearch: event.value };
    case 'SET_TIME_RANGE':
      return { ...state, chartTimeRange: event.value };
    case 'SET_METRIC':
      return { ...state, chartMetric: event.value };
    default:
      return state;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function gaugeStatus(value: number): 'good' | 'warning' | 'critical' {
  if (value >= 90) return 'good';
  if (value >= 50) return 'warning';
  return 'critical';
}
