/* ---------------------------------------------------------------------------
 * GraphAnalysisPanel state machine
 * Parallel regions: workflow, overlays
 * Workflow: idle (initial), configuring, running, showingResults,
 *           showingReport, comparing
 * Overlays: overlaysOff (initial), overlaysOn (parallel)
 * ------------------------------------------------------------------------- */

export type WorkflowState =
  | 'idle'
  | 'configuring'
  | 'running'
  | 'showingResults'
  | 'showingReport'
  | 'comparing';

export type OverlaysState = 'overlaysOff' | 'overlaysOn';

export interface GraphAnalysisPanelState {
  workflow: WorkflowState;
  overlays: OverlaysState;
}

export type GraphAnalysisPanelEvent =
  | { type: 'SELECT_CATEGORY'; category: string }
  | { type: 'SELECT_ALGORITHM'; algorithm: string }
  | { type: 'RUN' }
  | { type: 'COMPLETE'; resultId?: string }
  | { type: 'ERROR'; message?: string }
  | { type: 'CANCEL' }
  | { type: 'GENERATE_REPORT' }
  | { type: 'BACK_TO_RESULTS' }
  | { type: 'EXPORT' }
  | { type: 'COMPARE' }
  | { type: 'LOAD_PREVIOUS_RESULT' }
  | { type: 'ENABLE_OVERLAYS' }
  | { type: 'DISABLE_OVERLAYS' }
  | { type: 'TOGGLE_OVERLAY' };

export const initialGraphAnalysisPanelState: GraphAnalysisPanelState = {
  workflow: 'idle',
  overlays: 'overlaysOff',
};

export function graphAnalysisPanelReducer(
  state: GraphAnalysisPanelState,
  event: GraphAnalysisPanelEvent,
): GraphAnalysisPanelState {
  /* --- Overlays region (parallel, independent of workflow) --- */
  switch (event.type) {
    case 'ENABLE_OVERLAYS':
      if (state.overlays === 'overlaysOff') {
        return { ...state, overlays: 'overlaysOn' };
      }
      return state;

    case 'DISABLE_OVERLAYS':
      if (state.overlays === 'overlaysOn') {
        return { ...state, overlays: 'overlaysOff' };
      }
      return state;

    case 'TOGGLE_OVERLAY':
      return {
        ...state,
        overlays: state.overlays === 'overlaysOff' ? 'overlaysOn' : 'overlaysOff',
      };
  }

  /* --- Workflow region --- */
  switch (state.workflow) {
    case 'idle':
      if (event.type === 'SELECT_CATEGORY') return { ...state, workflow: 'configuring' };
      if (event.type === 'LOAD_PREVIOUS_RESULT') return { ...state, workflow: 'showingResults' };
      return state;

    case 'configuring':
      if (event.type === 'SELECT_CATEGORY') return state; // stay in configuring
      if (event.type === 'SELECT_ALGORITHM') return state; // stay in configuring
      if (event.type === 'RUN') return { ...state, workflow: 'running' };
      if (event.type === 'CANCEL') return { ...state, workflow: 'idle' };
      return state;

    case 'running':
      if (event.type === 'COMPLETE') return { ...state, workflow: 'showingResults' };
      if (event.type === 'ERROR') return { ...state, workflow: 'configuring' };
      if (event.type === 'CANCEL') return { ...state, workflow: 'configuring' };
      return state;

    case 'showingResults':
      if (event.type === 'GENERATE_REPORT') return { ...state, workflow: 'showingReport' };
      if (event.type === 'COMPARE') return { ...state, workflow: 'comparing' };
      if (event.type === 'EXPORT') return state; // stays in showingResults
      if (event.type === 'SELECT_CATEGORY') return { ...state, workflow: 'configuring' };
      if (event.type === 'RUN') return { ...state, workflow: 'running' };
      return state;

    case 'showingReport':
      if (event.type === 'BACK_TO_RESULTS') return { ...state, workflow: 'showingResults' };
      if (event.type === 'EXPORT') return state; // stays in showingReport
      if (event.type === 'SELECT_CATEGORY') return { ...state, workflow: 'configuring' };
      return state;

    case 'comparing':
      if (event.type === 'BACK_TO_RESULTS') return { ...state, workflow: 'showingResults' };
      if (event.type === 'SELECT_CATEGORY') return { ...state, workflow: 'configuring' };
      if (event.type === 'LOAD_PREVIOUS_RESULT') return state; // stays in comparing
      return state;

    default:
      return state;
  }
}
