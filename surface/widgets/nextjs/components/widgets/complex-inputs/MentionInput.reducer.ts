/* ---------------------------------------------------------------------------
 * State machine
 * Trigger: idle (initial) -> triggered -> suggesting
 * Focus: unfocused (initial) -> focused
 * Navigation: none (initial) -> active
 * Events: TRIGGER_CHAR, QUERY_CHANGE, SELECT, ESCAPE, BLUR, etc.
 * ------------------------------------------------------------------------- */

export type TriggerState = 'idle' | 'triggered' | 'suggesting';
export type FocusState = 'unfocused' | 'focused';
export type NavigationState = 'none' | 'active';

export interface MentionMachine {
  trigger: TriggerState;
  focus: FocusState;
  navigation: NavigationState;
  activeTriggerChar: string;
  query: string;
  activeIndex: number;
}

export type MentionEvent =
  | { type: 'TRIGGER_CHAR'; char: string }
  | { type: 'QUERY_CHANGE'; query: string }
  | { type: 'SELECT' }
  | { type: 'ESCAPE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'NO_RESULTS' }
  | { type: 'NAVIGATE_DOWN' }
  | { type: 'NAVIGATE_UP' }
  | { type: 'HIGHLIGHT'; index: number }
  | { type: 'SHOW_SUGGESTIONS' };

export function mentionReducer(state: MentionMachine, event: MentionEvent): MentionMachine {
  const s = { ...state };

  switch (event.type) {
    case 'TRIGGER_CHAR':
      s.trigger = 'triggered';
      s.activeTriggerChar = event.char;
      s.query = '';
      s.activeIndex = 0;
      break;
    case 'QUERY_CHANGE':
      s.query = event.query;
      if (s.trigger === 'triggered' || s.trigger === 'suggesting') {
        s.trigger = 'suggesting';
      }
      s.activeIndex = 0;
      break;
    case 'SHOW_SUGGESTIONS':
      s.trigger = 'suggesting';
      break;
    case 'SELECT':
      s.trigger = 'idle';
      s.navigation = 'none';
      s.query = '';
      s.activeIndex = 0;
      break;
    case 'ESCAPE':
      s.trigger = 'idle';
      s.navigation = 'none';
      s.query = '';
      break;
    case 'FOCUS':
      s.focus = 'focused';
      break;
    case 'BLUR':
      s.focus = 'unfocused';
      s.trigger = 'idle';
      s.navigation = 'none';
      break;
    case 'NO_RESULTS':
      s.trigger = 'idle';
      break;
    case 'NAVIGATE_DOWN':
      s.navigation = 'active';
      s.activeIndex = s.activeIndex + 1;
      break;
    case 'NAVIGATE_UP':
      s.navigation = 'active';
      s.activeIndex = Math.max(0, s.activeIndex - 1);
      break;
    case 'HIGHLIGHT':
      s.navigation = 'active';
      s.activeIndex = event.index;
      break;
  }

  return s;
}
