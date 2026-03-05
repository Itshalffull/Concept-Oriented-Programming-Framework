export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent =
  | { type: 'SELECT_CIRCLE' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'circleSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CIRCLE') return 'circleSelected';
      return state;
    default:
      return state;
  }
}

export interface CircleOrgChartProps { [key: string]: unknown; }

export function createCircleOrgChart(props: CircleOrgChartProps) {
  let state: CircleOrgChartState = 'idle';

  function send(type: string) {
    state = circleOrgChartReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createCircleOrgChart;
