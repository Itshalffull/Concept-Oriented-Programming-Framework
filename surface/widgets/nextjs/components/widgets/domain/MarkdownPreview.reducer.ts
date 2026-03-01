/* ---------------------------------------------------------------------------
 * MarkdownPreview state machine
 * States: static (initial), rendering
 * ------------------------------------------------------------------------- */

export type MarkdownState = 'static' | 'rendering';
export type MarkdownEvent =
  | { type: 'SOURCE_CHANGE' }
  | { type: 'RENDER_COMPLETE' };

export function markdownReducer(state: MarkdownState, event: MarkdownEvent): MarkdownState {
  switch (state) {
    case 'static':
      if (event.type === 'SOURCE_CHANGE') return 'rendering';
      return state;
    case 'rendering':
      if (event.type === 'RENDER_COMPLETE') return 'static';
      return state;
    default:
      return state;
  }
}
