export type ChartState = {
  current: 'loading' | 'rendered' | 'highlighted';
  highlightedSeries: string | null;
  highlightedIndex: number;
};

export type ChartAction =
  | { type: 'RENDER_COMPLETE' }
  | { type: 'RELOAD' }
  | { type: 'HOVER_SEGMENT'; series: string; index: number }
  | { type: 'UNHOVER_SEGMENT' }
  | { type: 'FOCUS_SEGMENT'; series: string; index: number }
  | { type: 'BLUR_SEGMENT' }
  | { type: 'NAVIGATE_SEGMENT_PREV' }
  | { type: 'NAVIGATE_SEGMENT_NEXT' };

export function chartReducer(state: ChartState, action: ChartAction): ChartState {
  switch (action.type) {
    case 'RENDER_COMPLETE':
      return { ...state, current: 'rendered' };
    case 'RELOAD':
      return { ...state, current: 'loading', highlightedSeries: null, highlightedIndex: -1 };
    case 'HOVER_SEGMENT':
    case 'FOCUS_SEGMENT':
      return {
        ...state,
        current: 'highlighted',
        highlightedSeries: action.series,
        highlightedIndex: action.index,
      };
    case 'UNHOVER_SEGMENT':
    case 'BLUR_SEGMENT':
      return { ...state, current: 'rendered', highlightedSeries: null, highlightedIndex: -1 };
    case 'NAVIGATE_SEGMENT_PREV':
      return { ...state, highlightedIndex: Math.max(0, state.highlightedIndex - 1) };
    case 'NAVIGATE_SEGMENT_NEXT':
      return { ...state, highlightedIndex: state.highlightedIndex + 1 };
    default:
      return state;
  }
}

export const chartInitialState: ChartState = {
  current: 'rendered',
  highlightedSeries: null,
  highlightedIndex: -1,
};
