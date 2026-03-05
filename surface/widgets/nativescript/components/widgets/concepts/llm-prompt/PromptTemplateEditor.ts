export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE' }
  | { type: 'REORDER' }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE' }
  | { type: 'DESELECT' }
  | { type: 'COMPILE_COMPLETE' }
  | { type: 'COMPILE_ERROR' };

export function promptTemplateEditorReducer(state: PromptTemplateEditorState, event: PromptTemplateEditorEvent): PromptTemplateEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'ADD_MESSAGE') return 'editing';
      if (event.type === 'REMOVE_MESSAGE') return 'editing';
      if (event.type === 'REORDER') return 'editing';
      if (event.type === 'COMPILE') return 'compiling';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'messageSelected':
      if (event.type === 'DESELECT') return 'editing';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'compiling':
      if (event.type === 'COMPILE_COMPLETE') return 'editing';
      if (event.type === 'COMPILE_ERROR') return 'editing';
      return state;
    default:
      return state;
  }
}

export interface PromptTemplateEditorProps { [key: string]: unknown; }

export function createPromptTemplateEditor(props: PromptTemplateEditorProps) {
  let state: PromptTemplateEditorState = 'editing';

  function send(type: string) {
    state = promptTemplateEditorReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createPromptTemplateEditor;
