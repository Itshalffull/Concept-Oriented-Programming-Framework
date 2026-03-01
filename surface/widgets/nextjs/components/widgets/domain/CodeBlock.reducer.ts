/* ---------------------------------------------------------------------------
 * CodeBlock state machine
 * States: idle (initial), hovered, focused, copied
 * ------------------------------------------------------------------------- */

export type CodeBlockState = 'idle' | 'hovered' | 'focused' | 'copied';
export type CodeBlockEvent =
  | { type: 'COPY' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'COPY_TIMEOUT' };

export function codeBlockReducer(state: CodeBlockState, event: CodeBlockEvent): CodeBlockState {
  switch (state) {
    case 'idle':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'idle';
      return state;
    default:
      return state;
  }
}
