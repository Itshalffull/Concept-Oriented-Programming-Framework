/* ---------------------------------------------------------------------------
 * QueueDashboard reducer — extracted state machine
 * States: loading, detail, autoRefresh, tab
 * ------------------------------------------------------------------------- */

export interface QueueDashboardState {
  loading: 'idle' | 'loading' | 'error';
  detail: 'closed' | 'open';
  autoRefresh: 'disabled' | 'enabled';
  tab: string;
  selectedJobId: string | null;
  chartTimeRange: string;
}

export type QueueDashboardEvent =
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' }
  | { type: 'SELECT_JOB'; jobId: string }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'DESELECT' }
  | { type: 'ENABLE_REFRESH' }
  | { type: 'DISABLE_REFRESH' }
  | { type: 'CHANGE_TAB'; tab: string }
  | { type: 'SET_TIME_RANGE'; value: string };

export function queueDashboardReducer(
  state: QueueDashboardState,
  event: QueueDashboardEvent,
): QueueDashboardState {
  switch (event.type) {
    case 'LOAD':
      return { ...state, loading: 'loading' };
    case 'LOAD_COMPLETE':
      return { ...state, loading: 'idle' };
    case 'LOAD_ERROR':
      return { ...state, loading: 'error' };
    case 'SELECT_JOB':
      return { ...state, detail: 'open', selectedJobId: event.jobId };
    case 'CLOSE_DETAIL':
      return { ...state, detail: 'closed', selectedJobId: null };
    case 'DESELECT':
      return { ...state, detail: 'closed', selectedJobId: null };
    case 'ENABLE_REFRESH':
      return { ...state, autoRefresh: 'enabled' };
    case 'DISABLE_REFRESH':
      return { ...state, autoRefresh: 'disabled' };
    case 'CHANGE_TAB':
      return { ...state, tab: event.tab };
    case 'SET_TIME_RANGE':
      return { ...state, chartTimeRange: event.value };
    default:
      return state;
  }
}
