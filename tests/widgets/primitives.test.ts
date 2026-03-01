import { describe, it, expect } from 'vitest';
import { buttonReducer } from '../../surface/widgets/nextjs/components/widgets/primitives/Button.reducer.js';
import { avatarReducer, getInitials } from '../../surface/widgets/nextjs/components/widgets/primitives/Avatar.reducer.js';
import { checkboxReducer } from '../../surface/widgets/nextjs/components/widgets/primitives/Checkbox.reducer.js';
import { chipReducer } from '../../surface/widgets/nextjs/components/widgets/primitives/Chip.reducer.js';
import { textInputReducer } from '../../surface/widgets/nextjs/components/widgets/primitives/TextInput.reducer.js';
import { presenceReducer, stateToDataState } from '../../surface/widgets/nextjs/components/widgets/primitives/Presence.reducer.js';

// ---------------------------------------------------------------------------
// buttonReducer
// ---------------------------------------------------------------------------
describe('buttonReducer', () => {
  describe('idle state', () => {
    it('transitions to hovered on HOVER', () => {
      expect(buttonReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('transitions to focused on FOCUS', () => {
      expect(buttonReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('ignores UNHOVER', () => {
      expect(buttonReducer('idle', { type: 'UNHOVER' })).toBe('idle');
    });

    it('ignores BLUR', () => {
      expect(buttonReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('ignores PRESS', () => {
      expect(buttonReducer('idle', { type: 'PRESS' })).toBe('idle');
    });

    it('ignores RELEASE', () => {
      expect(buttonReducer('idle', { type: 'RELEASE' })).toBe('idle');
    });
  });

  describe('hovered state', () => {
    it('transitions to idle on UNHOVER', () => {
      expect(buttonReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('transitions to pressed on PRESS', () => {
      expect(buttonReducer('hovered', { type: 'PRESS' })).toBe('pressed');
    });

    it('transitions to focused on FOCUS', () => {
      expect(buttonReducer('hovered', { type: 'FOCUS' })).toBe('focused');
    });

    it('ignores HOVER', () => {
      expect(buttonReducer('hovered', { type: 'HOVER' })).toBe('hovered');
    });

    it('ignores BLUR', () => {
      expect(buttonReducer('hovered', { type: 'BLUR' })).toBe('hovered');
    });

    it('ignores RELEASE', () => {
      expect(buttonReducer('hovered', { type: 'RELEASE' })).toBe('hovered');
    });
  });

  describe('focused state', () => {
    it('transitions to idle on BLUR', () => {
      expect(buttonReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('transitions to pressed on PRESS', () => {
      expect(buttonReducer('focused', { type: 'PRESS' })).toBe('pressed');
    });

    it('stays focused on HOVER', () => {
      expect(buttonReducer('focused', { type: 'HOVER' })).toBe('focused');
    });

    it('ignores UNHOVER', () => {
      expect(buttonReducer('focused', { type: 'UNHOVER' })).toBe('focused');
    });

    it('ignores FOCUS', () => {
      expect(buttonReducer('focused', { type: 'FOCUS' })).toBe('focused');
    });

    it('ignores RELEASE', () => {
      expect(buttonReducer('focused', { type: 'RELEASE' })).toBe('focused');
    });
  });

  describe('pressed state', () => {
    it('transitions to idle on RELEASE', () => {
      expect(buttonReducer('pressed', { type: 'RELEASE' })).toBe('idle');
    });

    it('ignores HOVER', () => {
      expect(buttonReducer('pressed', { type: 'HOVER' })).toBe('pressed');
    });

    it('ignores UNHOVER', () => {
      expect(buttonReducer('pressed', { type: 'UNHOVER' })).toBe('pressed');
    });

    it('ignores FOCUS', () => {
      expect(buttonReducer('pressed', { type: 'FOCUS' })).toBe('pressed');
    });

    it('ignores BLUR', () => {
      expect(buttonReducer('pressed', { type: 'BLUR' })).toBe('pressed');
    });

    it('ignores PRESS', () => {
      expect(buttonReducer('pressed', { type: 'PRESS' })).toBe('pressed');
    });
  });
});

// ---------------------------------------------------------------------------
// avatarReducer
// ---------------------------------------------------------------------------
describe('avatarReducer', () => {
  describe('loading state', () => {
    it('transitions to loaded on LOAD_SUCCESS', () => {
      expect(avatarReducer('loading', { type: 'LOAD_SUCCESS' })).toBe('loaded');
    });

    it('transitions to error on LOAD_ERROR', () => {
      expect(avatarReducer('loading', { type: 'LOAD_ERROR' })).toBe('error');
    });

    it('ignores INVALIDATE', () => {
      expect(avatarReducer('loading', { type: 'INVALIDATE' })).toBe('loading');
    });

    it('ignores RETRY', () => {
      expect(avatarReducer('loading', { type: 'RETRY' })).toBe('loading');
    });
  });

  describe('loaded state', () => {
    it('transitions to loading on INVALIDATE', () => {
      expect(avatarReducer('loaded', { type: 'INVALIDATE' })).toBe('loading');
    });

    it('ignores LOAD_SUCCESS', () => {
      expect(avatarReducer('loaded', { type: 'LOAD_SUCCESS' })).toBe('loaded');
    });

    it('ignores LOAD_ERROR', () => {
      expect(avatarReducer('loaded', { type: 'LOAD_ERROR' })).toBe('loaded');
    });

    it('ignores RETRY', () => {
      expect(avatarReducer('loaded', { type: 'RETRY' })).toBe('loaded');
    });
  });

  describe('error state', () => {
    it('transitions to loading on RETRY', () => {
      expect(avatarReducer('error', { type: 'RETRY' })).toBe('loading');
    });

    it('ignores LOAD_SUCCESS', () => {
      expect(avatarReducer('error', { type: 'LOAD_SUCCESS' })).toBe('error');
    });

    it('ignores LOAD_ERROR', () => {
      expect(avatarReducer('error', { type: 'LOAD_ERROR' })).toBe('error');
    });

    it('ignores INVALIDATE', () => {
      expect(avatarReducer('error', { type: 'INVALIDATE' })).toBe('error');
    });
  });
});

describe('getInitials', () => {
  it('returns first letter of a single-word name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('returns initials of a two-word name', () => {
    expect(getInitials('Alice Bob')).toBe('AB');
  });

  it('truncates to two characters for three-word names', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });

  it('returns uppercase initials', () => {
    expect(getInitials('alice bob')).toBe('AB');
  });

  it('returns empty string for empty input', () => {
    expect(getInitials('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// checkboxReducer
// ---------------------------------------------------------------------------
describe('checkboxReducer', () => {
  const uncheckedUnfocused = { checked: false, focused: false };
  const checkedUnfocused = { checked: true, focused: false };
  const uncheckedFocused = { checked: false, focused: true };
  const checkedFocused = { checked: true, focused: true };

  describe('TOGGLE event', () => {
    it('toggles checked from false to true', () => {
      expect(checkboxReducer(uncheckedUnfocused, { type: 'TOGGLE' })).toEqual(checkedUnfocused);
    });

    it('toggles checked from true to false', () => {
      expect(checkboxReducer(checkedUnfocused, { type: 'TOGGLE' })).toEqual(uncheckedUnfocused);
    });

    it('preserves focused state when toggling', () => {
      expect(checkboxReducer(uncheckedFocused, { type: 'TOGGLE' })).toEqual(checkedFocused);
    });
  });

  describe('FOCUS event', () => {
    it('sets focused to true', () => {
      expect(checkboxReducer(uncheckedUnfocused, { type: 'FOCUS' })).toEqual(uncheckedFocused);
    });

    it('stays focused if already focused', () => {
      expect(checkboxReducer(uncheckedFocused, { type: 'FOCUS' })).toEqual(uncheckedFocused);
    });

    it('preserves checked state when focusing', () => {
      expect(checkboxReducer(checkedUnfocused, { type: 'FOCUS' })).toEqual(checkedFocused);
    });
  });

  describe('BLUR event', () => {
    it('sets focused to false', () => {
      expect(checkboxReducer(uncheckedFocused, { type: 'BLUR' })).toEqual(uncheckedUnfocused);
    });

    it('stays unfocused if already unfocused', () => {
      expect(checkboxReducer(uncheckedUnfocused, { type: 'BLUR' })).toEqual(uncheckedUnfocused);
    });

    it('preserves checked state when blurring', () => {
      expect(checkboxReducer(checkedFocused, { type: 'BLUR' })).toEqual(checkedUnfocused);
    });
  });
});

// ---------------------------------------------------------------------------
// chipReducer
// ---------------------------------------------------------------------------
describe('chipReducer', () => {
  describe('idle state', () => {
    it('transitions to selected on SELECT', () => {
      expect(chipReducer('idle', { type: 'SELECT' })).toBe('selected');
    });

    it('transitions to hovered on HOVER', () => {
      expect(chipReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('transitions to focused on FOCUS', () => {
      expect(chipReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('ignores DESELECT', () => {
      expect(chipReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores UNHOVER', () => {
      expect(chipReducer('idle', { type: 'UNHOVER' })).toBe('idle');
    });

    it('ignores BLUR', () => {
      expect(chipReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('ignores DELETE', () => {
      expect(chipReducer('idle', { type: 'DELETE' })).toBe('idle');
    });
  });

  describe('selected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(chipReducer('selected', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores SELECT', () => {
      expect(chipReducer('selected', { type: 'SELECT' })).toBe('selected');
    });

    it('ignores HOVER', () => {
      expect(chipReducer('selected', { type: 'HOVER' })).toBe('selected');
    });

    it('ignores UNHOVER', () => {
      expect(chipReducer('selected', { type: 'UNHOVER' })).toBe('selected');
    });

    it('ignores FOCUS', () => {
      expect(chipReducer('selected', { type: 'FOCUS' })).toBe('selected');
    });

    it('ignores BLUR', () => {
      expect(chipReducer('selected', { type: 'BLUR' })).toBe('selected');
    });

    it('ignores DELETE', () => {
      expect(chipReducer('selected', { type: 'DELETE' })).toBe('selected');
    });
  });

  describe('hovered state', () => {
    it('transitions to idle on UNHOVER', () => {
      expect(chipReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('transitions to selected on SELECT', () => {
      expect(chipReducer('hovered', { type: 'SELECT' })).toBe('selected');
    });

    it('ignores HOVER', () => {
      expect(chipReducer('hovered', { type: 'HOVER' })).toBe('hovered');
    });

    it('ignores DESELECT', () => {
      expect(chipReducer('hovered', { type: 'DESELECT' })).toBe('hovered');
    });

    it('ignores FOCUS', () => {
      expect(chipReducer('hovered', { type: 'FOCUS' })).toBe('hovered');
    });

    it('ignores BLUR', () => {
      expect(chipReducer('hovered', { type: 'BLUR' })).toBe('hovered');
    });

    it('ignores DELETE', () => {
      expect(chipReducer('hovered', { type: 'DELETE' })).toBe('hovered');
    });
  });

  describe('focused state', () => {
    it('transitions to idle on BLUR', () => {
      expect(chipReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('transitions to selected on SELECT', () => {
      expect(chipReducer('focused', { type: 'SELECT' })).toBe('selected');
    });

    it('transitions to removed on DELETE', () => {
      expect(chipReducer('focused', { type: 'DELETE' })).toBe('removed');
    });

    it('ignores HOVER', () => {
      expect(chipReducer('focused', { type: 'HOVER' })).toBe('focused');
    });

    it('ignores UNHOVER', () => {
      expect(chipReducer('focused', { type: 'UNHOVER' })).toBe('focused');
    });

    it('ignores DESELECT', () => {
      expect(chipReducer('focused', { type: 'DESELECT' })).toBe('focused');
    });

    it('ignores FOCUS', () => {
      expect(chipReducer('focused', { type: 'FOCUS' })).toBe('focused');
    });
  });

  describe('removed state (terminal)', () => {
    it('ignores SELECT', () => {
      expect(chipReducer('removed', { type: 'SELECT' })).toBe('removed');
    });

    it('ignores DESELECT', () => {
      expect(chipReducer('removed', { type: 'DESELECT' })).toBe('removed');
    });

    it('ignores HOVER', () => {
      expect(chipReducer('removed', { type: 'HOVER' })).toBe('removed');
    });

    it('ignores UNHOVER', () => {
      expect(chipReducer('removed', { type: 'UNHOVER' })).toBe('removed');
    });

    it('ignores FOCUS', () => {
      expect(chipReducer('removed', { type: 'FOCUS' })).toBe('removed');
    });

    it('ignores BLUR', () => {
      expect(chipReducer('removed', { type: 'BLUR' })).toBe('removed');
    });

    it('ignores DELETE', () => {
      expect(chipReducer('removed', { type: 'DELETE' })).toBe('removed');
    });
  });
});

// ---------------------------------------------------------------------------
// textInputReducer
// ---------------------------------------------------------------------------
describe('textInputReducer', () => {
  const defaultState = { fill: 'empty' as const, focus: 'idle' as const, validity: 'valid' as const };

  describe('INPUT event', () => {
    it('sets fill to filled when value is non-empty', () => {
      const result = textInputReducer(defaultState, { type: 'INPUT', value: 'hello' });
      expect(result.fill).toBe('filled');
    });

    it('sets fill to empty when value is empty string', () => {
      const filledState = { ...defaultState, fill: 'filled' as const };
      const result = textInputReducer(filledState, { type: 'INPUT', value: '' });
      expect(result.fill).toBe('empty');
    });

    it('preserves focus and validity', () => {
      const state = { fill: 'empty' as const, focus: 'focused' as const, validity: 'invalid' as const };
      const result = textInputReducer(state, { type: 'INPUT', value: 'x' });
      expect(result.focus).toBe('focused');
      expect(result.validity).toBe('invalid');
    });
  });

  describe('CLEAR event', () => {
    it('sets fill to empty', () => {
      const filledState = { ...defaultState, fill: 'filled' as const };
      const result = textInputReducer(filledState, { type: 'CLEAR' });
      expect(result.fill).toBe('empty');
    });

    it('preserves focus and validity', () => {
      const state = { fill: 'filled' as const, focus: 'focused' as const, validity: 'invalid' as const };
      const result = textInputReducer(state, { type: 'CLEAR' });
      expect(result.focus).toBe('focused');
      expect(result.validity).toBe('invalid');
    });
  });

  describe('FOCUS event', () => {
    it('sets focus to focused', () => {
      const result = textInputReducer(defaultState, { type: 'FOCUS' });
      expect(result.focus).toBe('focused');
    });

    it('preserves fill and validity', () => {
      const state = { fill: 'filled' as const, focus: 'idle' as const, validity: 'invalid' as const };
      const result = textInputReducer(state, { type: 'FOCUS' });
      expect(result.fill).toBe('filled');
      expect(result.validity).toBe('invalid');
    });
  });

  describe('BLUR event', () => {
    it('sets focus to idle', () => {
      const focusedState = { ...defaultState, focus: 'focused' as const };
      const result = textInputReducer(focusedState, { type: 'BLUR' });
      expect(result.focus).toBe('idle');
    });

    it('preserves fill and validity', () => {
      const state = { fill: 'filled' as const, focus: 'focused' as const, validity: 'invalid' as const };
      const result = textInputReducer(state, { type: 'BLUR' });
      expect(result.fill).toBe('filled');
      expect(result.validity).toBe('invalid');
    });
  });

  describe('INVALIDATE event', () => {
    it('sets validity to invalid', () => {
      const result = textInputReducer(defaultState, { type: 'INVALIDATE' });
      expect(result.validity).toBe('invalid');
    });

    it('preserves fill and focus', () => {
      const state = { fill: 'filled' as const, focus: 'focused' as const, validity: 'valid' as const };
      const result = textInputReducer(state, { type: 'INVALIDATE' });
      expect(result.fill).toBe('filled');
      expect(result.focus).toBe('focused');
    });
  });

  describe('VALIDATE event', () => {
    it('sets validity to valid', () => {
      const invalidState = { ...defaultState, validity: 'invalid' as const };
      const result = textInputReducer(invalidState, { type: 'VALIDATE' });
      expect(result.validity).toBe('valid');
    });

    it('preserves fill and focus', () => {
      const state = { fill: 'filled' as const, focus: 'focused' as const, validity: 'invalid' as const };
      const result = textInputReducer(state, { type: 'VALIDATE' });
      expect(result.fill).toBe('filled');
      expect(result.focus).toBe('focused');
    });
  });
});

// ---------------------------------------------------------------------------
// presenceReducer
// ---------------------------------------------------------------------------
describe('presenceReducer', () => {
  describe('unmounted state', () => {
    it('transitions to mounting on SHOW', () => {
      expect(presenceReducer('unmounted', { type: 'SHOW' })).toBe('mounting');
    });

    it('ignores HIDE', () => {
      expect(presenceReducer('unmounted', { type: 'HIDE' })).toBe('unmounted');
    });

    it('ignores ANIMATION_END', () => {
      expect(presenceReducer('unmounted', { type: 'ANIMATION_END' })).toBe('unmounted');
    });
  });

  describe('mounting state', () => {
    it('transitions to mounted on ANIMATION_END', () => {
      expect(presenceReducer('mounting', { type: 'ANIMATION_END' })).toBe('mounted');
    });

    it('ignores SHOW', () => {
      expect(presenceReducer('mounting', { type: 'SHOW' })).toBe('mounting');
    });

    it('ignores HIDE', () => {
      expect(presenceReducer('mounting', { type: 'HIDE' })).toBe('mounting');
    });
  });

  describe('mounted state', () => {
    it('transitions to unmounting on HIDE', () => {
      expect(presenceReducer('mounted', { type: 'HIDE' })).toBe('unmounting');
    });

    it('ignores SHOW', () => {
      expect(presenceReducer('mounted', { type: 'SHOW' })).toBe('mounted');
    });

    it('ignores ANIMATION_END', () => {
      expect(presenceReducer('mounted', { type: 'ANIMATION_END' })).toBe('mounted');
    });
  });

  describe('unmounting state', () => {
    it('transitions to unmounted on ANIMATION_END', () => {
      expect(presenceReducer('unmounting', { type: 'ANIMATION_END' })).toBe('unmounted');
    });

    it('transitions to mounting on SHOW (re-entry)', () => {
      expect(presenceReducer('unmounting', { type: 'SHOW' })).toBe('mounting');
    });

    it('ignores HIDE', () => {
      expect(presenceReducer('unmounting', { type: 'HIDE' })).toBe('unmounting');
    });
  });
});

describe('stateToDataState', () => {
  it('maps mounted to open', () => {
    expect(stateToDataState('mounted')).toBe('open');
  });

  it('maps mounting to entering', () => {
    expect(stateToDataState('mounting')).toBe('entering');
  });

  it('maps unmounting to exiting', () => {
    expect(stateToDataState('unmounting')).toBe('exiting');
  });

  it('maps unmounted to closed', () => {
    expect(stateToDataState('unmounted')).toBe('closed');
  });
});
