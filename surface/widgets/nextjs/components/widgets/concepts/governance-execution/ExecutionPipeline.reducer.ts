export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent =
  | { type: 'ADVANCE' }
  | { type: 'SELECT_STAGE' }
  | { type: 'FAIL' }
  | { type: 'DESELECT' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'ADVANCE') return 'idle';
      if (event.type === 'SELECT_STAGE') return 'stageSelected';
      if (event.type === 'FAIL') return 'failed';
      return state;
    case 'stageSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'idle';
      if (event.type === 'RESET') return 'idle';
      return state;
    default:
      return state;
  }
}
