/* ---------------------------------------------------------------------------
 * State machine
 * Content: empty (initial) -> editing
 * Interaction: idle (initial) -> focused -> selecting -> formatting
 * SlashCommand: hidden (initial) -> visible
 * Events: INPUT, FOCUS, BLUR, SELECT_TEXT, FORMAT_*, SLASH_TRIGGER, etc.
 * ------------------------------------------------------------------------- */

export type ContentState = 'empty' | 'editing';
export type InteractionState = 'idle' | 'focused' | 'selecting' | 'formatting';
export type SlashState = 'hidden' | 'visible';

export interface RichTextMachine {
  content: ContentState;
  interaction: InteractionState;
  slashCommand: SlashState;
  activeFormats: Set<string>;
}

export type RichTextEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'CLEAR' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'SELECT_TEXT' }
  | { type: 'COLLAPSE_SELECTION' }
  | { type: 'FORMAT_BOLD' }
  | { type: 'FORMAT_ITALIC' }
  | { type: 'FORMAT_UNDERLINE' }
  | { type: 'FORMAT_STRIKETHROUGH' }
  | { type: 'FORMAT_CODE' }
  | { type: 'FORMAT_LINK' }
  | { type: 'FORMAT_COMPLETE' }
  | { type: 'SLASH_TRIGGER' }
  | { type: 'SLASH_SELECT' }
  | { type: 'SLASH_DISMISS' }
  | { type: 'ESCAPE' };

export function richTextReducer(state: RichTextMachine, event: RichTextEvent): RichTextMachine {
  const s: RichTextMachine = {
    content: state.content,
    interaction: state.interaction,
    slashCommand: state.slashCommand,
    activeFormats: new Set(state.activeFormats),
  };

  switch (event.type) {
    case 'INPUT':
    case 'PASTE':
      if (s.content === 'empty') s.content = 'editing';
      break;
    case 'CLEAR':
      s.content = 'empty';
      break;
    case 'FOCUS':
      if (s.interaction === 'idle') s.interaction = 'focused';
      break;
    case 'BLUR':
      s.interaction = 'idle';
      s.slashCommand = 'hidden';
      break;
    case 'SELECT_TEXT':
      if (s.interaction === 'focused' || s.interaction === 'formatting') s.interaction = 'selecting';
      break;
    case 'COLLAPSE_SELECTION':
      if (s.interaction === 'selecting' || s.interaction === 'formatting') s.interaction = 'focused';
      break;
    case 'FORMAT_BOLD':
      s.interaction = 'formatting';
      if (s.activeFormats.has('bold')) s.activeFormats.delete('bold');
      else s.activeFormats.add('bold');
      break;
    case 'FORMAT_ITALIC':
      s.interaction = 'formatting';
      if (s.activeFormats.has('italic')) s.activeFormats.delete('italic');
      else s.activeFormats.add('italic');
      break;
    case 'FORMAT_UNDERLINE':
      s.interaction = 'formatting';
      if (s.activeFormats.has('underline')) s.activeFormats.delete('underline');
      else s.activeFormats.add('underline');
      break;
    case 'FORMAT_STRIKETHROUGH':
      s.interaction = 'formatting';
      if (s.activeFormats.has('strikethrough')) s.activeFormats.delete('strikethrough');
      else s.activeFormats.add('strikethrough');
      break;
    case 'FORMAT_CODE':
      s.interaction = 'formatting';
      if (s.activeFormats.has('code')) s.activeFormats.delete('code');
      else s.activeFormats.add('code');
      break;
    case 'FORMAT_LINK':
      s.interaction = 'formatting';
      break;
    case 'FORMAT_COMPLETE':
      if (s.interaction === 'formatting') s.interaction = 'selecting';
      break;
    case 'SLASH_TRIGGER':
      s.slashCommand = 'visible';
      break;
    case 'SLASH_SELECT':
    case 'SLASH_DISMISS':
    case 'ESCAPE':
      s.slashCommand = 'hidden';
      break;
  }

  return s;
}
