export type FormulaDisplayState = 'idle' | 'copied' | 'rendering';
export type FormulaDisplayEvent =
  | { type: 'COPY' }
  | { type: 'RENDER_LATEX' }
  | { type: 'TIMEOUT' }
  | { type: 'RENDER_COMPLETE' };

export function formulaDisplayReducer(state: FormulaDisplayState, event: FormulaDisplayEvent): FormulaDisplayState {
  switch (state) {
    case 'idle':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'RENDER_LATEX') return 'rendering';
      return state;
    case 'copied':
      if (event.type === 'TIMEOUT') return 'idle';
      return state;
    case 'rendering':
      if (event.type === 'RENDER_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface FormulaDisplayProps { [key: string]: unknown; }

export function createFormulaDisplay(props: FormulaDisplayProps) {
  let state: FormulaDisplayState = 'idle';

  function send(type: string) {
    state = formulaDisplayReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createFormulaDisplay;
