import { describe, it, expect } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Badge                                                              */
/* ------------------------------------------------------------------ */

import {
  displayReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/Badge.reducer.js';

describe('Badge', () => {
  describe('displayReducer', () => {
    it('returns "dot" on SET_DOT from "static"', () => {
      expect(displayReducer('static', { type: 'SET_DOT' })).toBe('dot');
    });

    it('returns "dot" on SET_DOT from "dot" (idempotent)', () => {
      expect(displayReducer('dot', { type: 'SET_DOT' })).toBe('dot');
    });

    it('returns "static" on SET_LABEL from "dot"', () => {
      expect(displayReducer('dot', { type: 'SET_LABEL' })).toBe('static');
    });

    it('returns "static" on SET_LABEL from "static" (idempotent)', () => {
      expect(displayReducer('static', { type: 'SET_LABEL' })).toBe('static');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(displayReducer('static', { type: 'UNKNOWN' })).toBe('static');
      // @ts-expect-error testing unknown action
      expect(displayReducer('dot', { type: 'UNKNOWN' })).toBe('dot');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  CheckboxGroup                                                      */
/* ------------------------------------------------------------------ */

import {
  itemReducer as checkboxItemReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/CheckboxGroup.reducer.js';

describe('CheckboxGroup', () => {
  describe('itemReducer', () => {
    it('returns "checked" on CHECK from "unchecked"', () => {
      expect(checkboxItemReducer('unchecked', { type: 'CHECK' })).toBe('checked');
    });

    it('returns "checked" on CHECK from "checked" (idempotent)', () => {
      expect(checkboxItemReducer('checked', { type: 'CHECK' })).toBe('checked');
    });

    it('returns "unchecked" on UNCHECK from "checked"', () => {
      expect(checkboxItemReducer('checked', { type: 'UNCHECK' })).toBe('unchecked');
    });

    it('returns "unchecked" on UNCHECK from "unchecked" (idempotent)', () => {
      expect(checkboxItemReducer('unchecked', { type: 'UNCHECK' })).toBe('unchecked');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(checkboxItemReducer('unchecked', { type: 'UNKNOWN' })).toBe('unchecked');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  ChipInput                                                          */
/* ------------------------------------------------------------------ */

import {
  interactionReducer as chipInteractionReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/ChipInput.reducer.js';

describe('ChipInput', () => {
  describe('interactionReducer', () => {
    // Transitions from 'idle'
    it('transitions from idle to typing on FOCUS', () => {
      expect(chipInteractionReducer('idle', { type: 'FOCUS' })).toBe('typing');
    });

    it('ignores BLUR in idle state', () => {
      expect(chipInteractionReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('ignores SUGGEST in idle state', () => {
      expect(chipInteractionReducer('idle', { type: 'SUGGEST' })).toBe('idle');
    });

    it('ignores SELECT_SUGGESTION in idle state', () => {
      expect(chipInteractionReducer('idle', { type: 'SELECT_SUGGESTION' })).toBe('idle');
    });

    it('ignores CREATE in idle state', () => {
      expect(chipInteractionReducer('idle', { type: 'CREATE' })).toBe('idle');
    });

    it('ignores CLOSE in idle state', () => {
      expect(chipInteractionReducer('idle', { type: 'CLOSE' })).toBe('idle');
    });

    // Transitions from 'typing'
    it('transitions from typing to suggesting on SUGGEST', () => {
      expect(chipInteractionReducer('typing', { type: 'SUGGEST' })).toBe('suggesting');
    });

    it('transitions from typing to idle on BLUR', () => {
      expect(chipInteractionReducer('typing', { type: 'BLUR' })).toBe('idle');
    });

    it('transitions from typing to idle on CREATE', () => {
      expect(chipInteractionReducer('typing', { type: 'CREATE' })).toBe('idle');
    });

    it('ignores FOCUS in typing state', () => {
      expect(chipInteractionReducer('typing', { type: 'FOCUS' })).toBe('typing');
    });

    it('ignores SELECT_SUGGESTION in typing state', () => {
      expect(chipInteractionReducer('typing', { type: 'SELECT_SUGGESTION' })).toBe('typing');
    });

    it('ignores CLOSE in typing state', () => {
      expect(chipInteractionReducer('typing', { type: 'CLOSE' })).toBe('typing');
    });

    // Transitions from 'suggesting'
    it('transitions from suggesting to typing on SELECT_SUGGESTION', () => {
      expect(chipInteractionReducer('suggesting', { type: 'SELECT_SUGGESTION' })).toBe('typing');
    });

    it('transitions from suggesting to idle on BLUR', () => {
      expect(chipInteractionReducer('suggesting', { type: 'BLUR' })).toBe('idle');
    });

    it('transitions from suggesting to typing on CLOSE', () => {
      expect(chipInteractionReducer('suggesting', { type: 'CLOSE' })).toBe('typing');
    });

    it('ignores FOCUS in suggesting state', () => {
      expect(chipInteractionReducer('suggesting', { type: 'FOCUS' })).toBe('suggesting');
    });

    it('ignores SUGGEST in suggesting state', () => {
      expect(chipInteractionReducer('suggesting', { type: 'SUGGEST' })).toBe('suggesting');
    });

    it('ignores CREATE in suggesting state', () => {
      expect(chipInteractionReducer('suggesting', { type: 'CREATE' })).toBe('suggesting');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Combobox                                                           */
/* ------------------------------------------------------------------ */

import {
  openCloseReducer as comboboxOpenCloseReducer,
  filterReducer as comboboxFilterReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/Combobox.reducer.js';

describe('Combobox', () => {
  describe('openCloseReducer', () => {
    // From 'closed'
    it('transitions from closed to open on OPEN', () => {
      expect(comboboxOpenCloseReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('transitions from closed to open on INPUT', () => {
      expect(comboboxOpenCloseReducer('closed', { type: 'INPUT' })).toBe('open');
    });

    it('ignores CLOSE in closed state', () => {
      expect(comboboxOpenCloseReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('ignores SELECT in closed state', () => {
      expect(comboboxOpenCloseReducer('closed', { type: 'SELECT' })).toBe('closed');
    });

    it('ignores BLUR in closed state', () => {
      expect(comboboxOpenCloseReducer('closed', { type: 'BLUR' })).toBe('closed');
    });

    // From 'open'
    it('transitions from open to closed on CLOSE', () => {
      expect(comboboxOpenCloseReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from open to closed on SELECT', () => {
      expect(comboboxOpenCloseReducer('open', { type: 'SELECT' })).toBe('closed');
    });

    it('transitions from open to closed on BLUR', () => {
      expect(comboboxOpenCloseReducer('open', { type: 'BLUR' })).toBe('closed');
    });

    it('ignores OPEN in open state', () => {
      expect(comboboxOpenCloseReducer('open', { type: 'OPEN' })).toBe('open');
    });

    it('ignores INPUT in open state', () => {
      expect(comboboxOpenCloseReducer('open', { type: 'INPUT' })).toBe('open');
    });
  });

  describe('filterReducer', () => {
    // From 'idle'
    it('transitions from idle to filtering on BEGIN_FILTER', () => {
      expect(comboboxFilterReducer('idle', { type: 'BEGIN_FILTER' })).toBe('filtering');
    });

    it('ignores END_FILTER in idle state', () => {
      expect(comboboxFilterReducer('idle', { type: 'END_FILTER' })).toBe('idle');
    });

    it('ignores INPUT in idle state', () => {
      expect(comboboxFilterReducer('idle', { type: 'INPUT' })).toBe('idle');
    });

    // From 'filtering'
    it('transitions from filtering to idle on END_FILTER', () => {
      expect(comboboxFilterReducer('filtering', { type: 'END_FILTER' })).toBe('idle');
    });

    it('remains in filtering on INPUT', () => {
      expect(comboboxFilterReducer('filtering', { type: 'INPUT' })).toBe('filtering');
    });

    it('ignores BEGIN_FILTER in filtering state', () => {
      expect(comboboxFilterReducer('filtering', { type: 'BEGIN_FILTER' })).toBe('filtering');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  ComboboxMulti                                                      */
/* ------------------------------------------------------------------ */

import {
  openCloseReducer as comboboxMultiOpenCloseReducer,
  filterReducer as comboboxMultiFilterReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/ComboboxMulti.reducer.js';

describe('ComboboxMulti', () => {
  describe('openCloseReducer', () => {
    // From 'closed'
    it('transitions from closed to open on OPEN', () => {
      expect(comboboxMultiOpenCloseReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('transitions from closed to open on INPUT', () => {
      expect(comboboxMultiOpenCloseReducer('closed', { type: 'INPUT' })).toBe('open');
    });

    it('ignores CLOSE in closed state', () => {
      expect(comboboxMultiOpenCloseReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('ignores BLUR in closed state', () => {
      expect(comboboxMultiOpenCloseReducer('closed', { type: 'BLUR' })).toBe('closed');
    });

    // From 'open'
    it('transitions from open to closed on CLOSE', () => {
      expect(comboboxMultiOpenCloseReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from open to closed on BLUR', () => {
      expect(comboboxMultiOpenCloseReducer('open', { type: 'BLUR' })).toBe('closed');
    });

    it('ignores OPEN in open state', () => {
      expect(comboboxMultiOpenCloseReducer('open', { type: 'OPEN' })).toBe('open');
    });

    it('ignores INPUT in open state', () => {
      expect(comboboxMultiOpenCloseReducer('open', { type: 'INPUT' })).toBe('open');
    });
  });

  describe('filterReducer', () => {
    // From 'idle'
    it('transitions from idle to filtering on BEGIN_FILTER', () => {
      expect(comboboxMultiFilterReducer('idle', { type: 'BEGIN_FILTER' })).toBe('filtering');
    });

    it('ignores END_FILTER in idle state', () => {
      expect(comboboxMultiFilterReducer('idle', { type: 'END_FILTER' })).toBe('idle');
    });

    it('ignores INPUT in idle state', () => {
      expect(comboboxMultiFilterReducer('idle', { type: 'INPUT' })).toBe('idle');
    });

    // From 'filtering'
    it('transitions from filtering to idle on END_FILTER', () => {
      expect(comboboxMultiFilterReducer('filtering', { type: 'END_FILTER' })).toBe('idle');
    });

    it('remains in filtering on INPUT', () => {
      expect(comboboxMultiFilterReducer('filtering', { type: 'INPUT' })).toBe('filtering');
    });

    it('ignores BEGIN_FILTER in filtering state', () => {
      expect(comboboxMultiFilterReducer('filtering', { type: 'BEGIN_FILTER' })).toBe('filtering');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  MultiSelect                                                        */
/* ------------------------------------------------------------------ */

import {
  openCloseReducer as multiSelectOpenCloseReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/MultiSelect.reducer.js';

describe('MultiSelect', () => {
  describe('openCloseReducer', () => {
    // From 'closed'
    it('transitions from closed to open on OPEN', () => {
      expect(multiSelectOpenCloseReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('transitions from closed to open on TOGGLE', () => {
      expect(multiSelectOpenCloseReducer('closed', { type: 'TOGGLE' })).toBe('open');
    });

    it('ignores CLOSE in closed state', () => {
      expect(multiSelectOpenCloseReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('ignores BLUR in closed state', () => {
      expect(multiSelectOpenCloseReducer('closed', { type: 'BLUR' })).toBe('closed');
    });

    // From 'open'
    it('transitions from open to closed on CLOSE', () => {
      expect(multiSelectOpenCloseReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from open to closed on TOGGLE', () => {
      expect(multiSelectOpenCloseReducer('open', { type: 'TOGGLE' })).toBe('closed');
    });

    it('transitions from open to closed on BLUR', () => {
      expect(multiSelectOpenCloseReducer('open', { type: 'BLUR' })).toBe('closed');
    });

    it('ignores OPEN in open state', () => {
      expect(multiSelectOpenCloseReducer('open', { type: 'OPEN' })).toBe('open');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  NumberInput                                                        */
/* ------------------------------------------------------------------ */

import {
  focusReducer as numberFocusReducer,
  validationReducer as numberValidationReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/NumberInput.reducer.js';

describe('NumberInput', () => {
  describe('focusReducer', () => {
    it('returns "focused" on FOCUS from "idle"', () => {
      expect(numberFocusReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('returns "focused" on FOCUS from "focused" (idempotent)', () => {
      expect(numberFocusReducer('focused', { type: 'FOCUS' })).toBe('focused');
    });

    it('returns "idle" on BLUR from "focused"', () => {
      expect(numberFocusReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('returns "idle" on BLUR from "idle" (idempotent)', () => {
      expect(numberFocusReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(numberFocusReducer('idle', { type: 'UNKNOWN' })).toBe('idle');
    });
  });

  describe('validationReducer', () => {
    it('returns "invalid" on INVALIDATE from "valid"', () => {
      expect(numberValidationReducer('valid', { type: 'INVALIDATE' })).toBe('invalid');
    });

    it('returns "invalid" on INVALIDATE from "invalid" (idempotent)', () => {
      expect(numberValidationReducer('invalid', { type: 'INVALIDATE' })).toBe('invalid');
    });

    it('returns "valid" on VALIDATE from "invalid"', () => {
      expect(numberValidationReducer('invalid', { type: 'VALIDATE' })).toBe('valid');
    });

    it('returns "valid" on VALIDATE from "valid" (idempotent)', () => {
      expect(numberValidationReducer('valid', { type: 'VALIDATE' })).toBe('valid');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(numberValidationReducer('valid', { type: 'UNKNOWN' })).toBe('valid');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  ProgressBar                                                        */
/* ------------------------------------------------------------------ */

import {
  modeReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/ProgressBar.reducer.js';

describe('ProgressBar', () => {
  describe('modeReducer', () => {
    it('returns "determinate" on SET_VALUE from "indeterminate"', () => {
      expect(modeReducer('indeterminate', { type: 'SET_VALUE' })).toBe('determinate');
    });

    it('returns "determinate" on SET_VALUE from "complete"', () => {
      expect(modeReducer('complete', { type: 'SET_VALUE' })).toBe('determinate');
    });

    it('returns "determinate" on SET_VALUE from "determinate" (idempotent)', () => {
      expect(modeReducer('determinate', { type: 'SET_VALUE' })).toBe('determinate');
    });

    it('returns "indeterminate" on CLEAR_VALUE from "determinate"', () => {
      expect(modeReducer('determinate', { type: 'CLEAR_VALUE' })).toBe('indeterminate');
    });

    it('returns "indeterminate" on CLEAR_VALUE from "complete"', () => {
      expect(modeReducer('complete', { type: 'CLEAR_VALUE' })).toBe('indeterminate');
    });

    it('returns "complete" on COMPLETE from "determinate"', () => {
      expect(modeReducer('determinate', { type: 'COMPLETE' })).toBe('complete');
    });

    it('returns "complete" on COMPLETE from "indeterminate"', () => {
      expect(modeReducer('indeterminate', { type: 'COMPLETE' })).toBe('complete');
    });

    it('returns "indeterminate" on RESET from "complete"', () => {
      expect(modeReducer('complete', { type: 'RESET' })).toBe('indeterminate');
    });

    it('returns "indeterminate" on RESET from "determinate"', () => {
      expect(modeReducer('determinate', { type: 'RESET' })).toBe('indeterminate');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(modeReducer('determinate', { type: 'UNKNOWN' })).toBe('determinate');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  RadioCard                                                          */
/* ------------------------------------------------------------------ */

import {
  cardReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/RadioCard.reducer.js';

describe('RadioCard', () => {
  describe('cardReducer', () => {
    it('returns "selected" on SELECT from "unselected"', () => {
      expect(cardReducer('unselected', { type: 'SELECT' })).toBe('selected');
    });

    it('returns "selected" on SELECT from "selected" (idempotent)', () => {
      expect(cardReducer('selected', { type: 'SELECT' })).toBe('selected');
    });

    it('returns "unselected" on DESELECT from "selected"', () => {
      expect(cardReducer('selected', { type: 'DESELECT' })).toBe('unselected');
    });

    it('returns "unselected" on DESELECT from "unselected" (idempotent)', () => {
      expect(cardReducer('unselected', { type: 'DESELECT' })).toBe('unselected');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(cardReducer('unselected', { type: 'UNKNOWN' })).toBe('unselected');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  RadioGroup                                                         */
/* ------------------------------------------------------------------ */

import {
  itemReducer as radioItemReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/RadioGroup.reducer.js';

describe('RadioGroup', () => {
  describe('itemReducer', () => {
    it('returns "selected" on SELECT from "unselected"', () => {
      expect(radioItemReducer('unselected', { type: 'SELECT' })).toBe('selected');
    });

    it('returns "selected" on SELECT from "selected" (idempotent)', () => {
      expect(radioItemReducer('selected', { type: 'SELECT' })).toBe('selected');
    });

    it('returns "unselected" on DESELECT from "selected"', () => {
      expect(radioItemReducer('selected', { type: 'DESELECT' })).toBe('unselected');
    });

    it('returns "unselected" on DESELECT from "unselected" (idempotent)', () => {
      expect(radioItemReducer('unselected', { type: 'DESELECT' })).toBe('unselected');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(radioItemReducer('unselected', { type: 'UNKNOWN' })).toBe('unselected');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  SegmentedControl                                                   */
/* ------------------------------------------------------------------ */

import {
  itemReducer as segmentItemReducer,
  indicatorReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/SegmentedControl.reducer.js';

describe('SegmentedControl', () => {
  describe('itemReducer', () => {
    it('returns "selected" on SELECT from "unselected"', () => {
      expect(segmentItemReducer('unselected', { type: 'SELECT' })).toBe('selected');
    });

    it('returns "selected" on SELECT from "selected" (idempotent)', () => {
      expect(segmentItemReducer('selected', { type: 'SELECT' })).toBe('selected');
    });

    it('returns "unselected" on DESELECT from "selected"', () => {
      expect(segmentItemReducer('selected', { type: 'DESELECT' })).toBe('unselected');
    });

    it('returns "unselected" on DESELECT from "unselected" (idempotent)', () => {
      expect(segmentItemReducer('unselected', { type: 'DESELECT' })).toBe('unselected');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(segmentItemReducer('unselected', { type: 'UNKNOWN' })).toBe('unselected');
    });
  });

  describe('indicatorReducer', () => {
    it('returns "animating" on ANIMATE from "idle"', () => {
      expect(indicatorReducer('idle', { type: 'ANIMATE' })).toBe('animating');
    });

    it('returns "animating" on ANIMATE from "animating" (idempotent)', () => {
      expect(indicatorReducer('animating', { type: 'ANIMATE' })).toBe('animating');
    });

    it('returns "idle" on ANIMATION_END from "animating"', () => {
      expect(indicatorReducer('animating', { type: 'ANIMATION_END' })).toBe('idle');
    });

    it('returns "idle" on ANIMATION_END from "idle" (idempotent)', () => {
      expect(indicatorReducer('idle', { type: 'ANIMATION_END' })).toBe('idle');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(indicatorReducer('idle', { type: 'UNKNOWN' })).toBe('idle');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Select                                                             */
/* ------------------------------------------------------------------ */

import {
  openCloseReducer as selectOpenCloseReducer,
  focusReducer as selectFocusReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/Select.reducer.js';

describe('Select', () => {
  describe('openCloseReducer', () => {
    // From 'closed'
    it('transitions from closed to open on OPEN', () => {
      expect(selectOpenCloseReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('transitions from closed to open on TOGGLE', () => {
      expect(selectOpenCloseReducer('closed', { type: 'TOGGLE' })).toBe('open');
    });

    it('ignores CLOSE in closed state', () => {
      expect(selectOpenCloseReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('ignores SELECT in closed state', () => {
      expect(selectOpenCloseReducer('closed', { type: 'SELECT' })).toBe('closed');
    });

    // From 'open'
    it('transitions from open to closed on CLOSE', () => {
      expect(selectOpenCloseReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from open to closed on TOGGLE', () => {
      expect(selectOpenCloseReducer('open', { type: 'TOGGLE' })).toBe('closed');
    });

    it('transitions from open to closed on SELECT', () => {
      expect(selectOpenCloseReducer('open', { type: 'SELECT' })).toBe('closed');
    });

    it('ignores OPEN in open state', () => {
      expect(selectOpenCloseReducer('open', { type: 'OPEN' })).toBe('open');
    });
  });

  describe('focusReducer', () => {
    it('returns "focused" on FOCUS from "idle"', () => {
      expect(selectFocusReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('returns "focused" on FOCUS from "focused" (idempotent)', () => {
      expect(selectFocusReducer('focused', { type: 'FOCUS' })).toBe('focused');
    });

    it('returns "idle" on BLUR from "focused"', () => {
      expect(selectFocusReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('returns "idle" on BLUR from "idle" (idempotent)', () => {
      expect(selectFocusReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(selectFocusReducer('idle', { type: 'UNKNOWN' })).toBe('idle');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Slider                                                             */
/* ------------------------------------------------------------------ */

import {
  interactionReducer as sliderInteractionReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/Slider.reducer.js';

describe('Slider', () => {
  describe('interactionReducer', () => {
    // Transitions from 'idle'
    it('transitions from idle to dragging on POINTER_DOWN', () => {
      expect(sliderInteractionReducer('idle', { type: 'POINTER_DOWN' })).toBe('dragging');
    });

    it('transitions from idle to focused on FOCUS', () => {
      expect(sliderInteractionReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('ignores POINTER_UP in idle state', () => {
      expect(sliderInteractionReducer('idle', { type: 'POINTER_UP' })).toBe('idle');
    });

    it('ignores BLUR in idle state', () => {
      expect(sliderInteractionReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    // Transitions from 'focused'
    it('transitions from focused to idle on BLUR', () => {
      expect(sliderInteractionReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('transitions from focused to dragging on POINTER_DOWN', () => {
      expect(sliderInteractionReducer('focused', { type: 'POINTER_DOWN' })).toBe('dragging');
    });

    it('ignores POINTER_UP in focused state', () => {
      expect(sliderInteractionReducer('focused', { type: 'POINTER_UP' })).toBe('focused');
    });

    it('ignores FOCUS in focused state', () => {
      expect(sliderInteractionReducer('focused', { type: 'FOCUS' })).toBe('focused');
    });

    // Transitions from 'dragging'
    it('transitions from dragging to idle on POINTER_UP', () => {
      expect(sliderInteractionReducer('dragging', { type: 'POINTER_UP' })).toBe('idle');
    });

    it('ignores POINTER_DOWN in dragging state', () => {
      expect(sliderInteractionReducer('dragging', { type: 'POINTER_DOWN' })).toBe('dragging');
    });

    it('ignores FOCUS in dragging state', () => {
      expect(sliderInteractionReducer('dragging', { type: 'FOCUS' })).toBe('dragging');
    });

    it('ignores BLUR in dragging state', () => {
      expect(sliderInteractionReducer('dragging', { type: 'BLUR' })).toBe('dragging');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Stepper                                                            */
/* ------------------------------------------------------------------ */

import {
  boundaryReducer,
  deriveBoundary,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/Stepper.reducer.js';

describe('Stepper', () => {
  describe('boundaryReducer', () => {
    // Transitions from 'idle'
    it('transitions from idle to atMin on AT_MIN', () => {
      expect(boundaryReducer('idle', { type: 'AT_MIN' })).toBe('atMin');
    });

    it('transitions from idle to atMax on AT_MAX', () => {
      expect(boundaryReducer('idle', { type: 'AT_MAX' })).toBe('atMax');
    });

    it('ignores INCREMENT in idle state', () => {
      expect(boundaryReducer('idle', { type: 'INCREMENT' })).toBe('idle');
    });

    it('ignores DECREMENT in idle state', () => {
      expect(boundaryReducer('idle', { type: 'DECREMENT' })).toBe('idle');
    });

    // Transitions from 'atMin'
    it('transitions from atMin to idle on INCREMENT', () => {
      expect(boundaryReducer('atMin', { type: 'INCREMENT' })).toBe('idle');
    });

    it('transitions from atMin to atMax on AT_MAX', () => {
      expect(boundaryReducer('atMin', { type: 'AT_MAX' })).toBe('atMax');
    });

    it('ignores AT_MIN in atMin state (already there)', () => {
      expect(boundaryReducer('atMin', { type: 'AT_MIN' })).toBe('atMin');
    });

    it('ignores DECREMENT in atMin state', () => {
      expect(boundaryReducer('atMin', { type: 'DECREMENT' })).toBe('atMin');
    });

    // Transitions from 'atMax'
    it('transitions from atMax to idle on DECREMENT', () => {
      expect(boundaryReducer('atMax', { type: 'DECREMENT' })).toBe('idle');
    });

    it('transitions from atMax to atMin on AT_MIN', () => {
      expect(boundaryReducer('atMax', { type: 'AT_MIN' })).toBe('atMin');
    });

    it('ignores AT_MAX in atMax state (already there)', () => {
      expect(boundaryReducer('atMax', { type: 'AT_MAX' })).toBe('atMax');
    });

    it('ignores INCREMENT in atMax state', () => {
      expect(boundaryReducer('atMax', { type: 'INCREMENT' })).toBe('atMax');
    });
  });

  describe('deriveBoundary', () => {
    it('returns "atMin" when value equals min', () => {
      expect(deriveBoundary(0, 0, 10)).toBe('atMin');
    });

    it('returns "atMin" when value is less than min', () => {
      expect(deriveBoundary(-1, 0, 10)).toBe('atMin');
    });

    it('returns "atMax" when value equals max', () => {
      expect(deriveBoundary(10, 0, 10)).toBe('atMax');
    });

    it('returns "atMax" when value exceeds max', () => {
      expect(deriveBoundary(15, 0, 10)).toBe('atMax');
    });

    it('returns "idle" when value is between min and max', () => {
      expect(deriveBoundary(5, 0, 10)).toBe('idle');
    });

    it('returns "idle" for value of 1 in range 0..10', () => {
      expect(deriveBoundary(1, 0, 10)).toBe('idle');
    });

    it('returns "idle" for value of 9 in range 0..10', () => {
      expect(deriveBoundary(9, 0, 10)).toBe('idle');
    });

    it('returns "atMin" when min equals max and value equals both', () => {
      // When min === max, value <= min is true
      expect(deriveBoundary(5, 5, 5)).toBe('atMin');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Textarea                                                           */
/* ------------------------------------------------------------------ */

import {
  contentReducer,
  focusReducer as textareaFocusReducer,
  validationReducer as textareaValidationReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/Textarea.reducer.js';

describe('Textarea', () => {
  describe('contentReducer', () => {
    it('returns "filled" on INPUT with non-empty value from "empty"', () => {
      expect(contentReducer('empty', { type: 'INPUT', value: 'hello' })).toBe('filled');
    });

    it('returns "filled" on INPUT with non-empty value from "filled"', () => {
      expect(contentReducer('filled', { type: 'INPUT', value: 'world' })).toBe('filled');
    });

    it('returns "empty" on INPUT with empty string from "filled"', () => {
      expect(contentReducer('filled', { type: 'INPUT', value: '' })).toBe('empty');
    });

    it('returns "empty" on INPUT with empty string from "empty" (idempotent)', () => {
      expect(contentReducer('empty', { type: 'INPUT', value: '' })).toBe('empty');
    });

    it('returns "empty" on CLEAR from "filled"', () => {
      expect(contentReducer('filled', { type: 'CLEAR' })).toBe('empty');
    });

    it('returns "empty" on CLEAR from "empty" (idempotent)', () => {
      expect(contentReducer('empty', { type: 'CLEAR' })).toBe('empty');
    });

    it('treats single-character input as "filled"', () => {
      expect(contentReducer('empty', { type: 'INPUT', value: 'x' })).toBe('filled');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(contentReducer('filled', { type: 'UNKNOWN' })).toBe('filled');
    });
  });

  describe('focusReducer', () => {
    it('returns "focused" on FOCUS from "idle"', () => {
      expect(textareaFocusReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('returns "focused" on FOCUS from "focused" (idempotent)', () => {
      expect(textareaFocusReducer('focused', { type: 'FOCUS' })).toBe('focused');
    });

    it('returns "idle" on BLUR from "focused"', () => {
      expect(textareaFocusReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('returns "idle" on BLUR from "idle" (idempotent)', () => {
      expect(textareaFocusReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(textareaFocusReducer('idle', { type: 'UNKNOWN' })).toBe('idle');
    });
  });

  describe('validationReducer', () => {
    it('returns "invalid" on INVALIDATE from "valid"', () => {
      expect(textareaValidationReducer('valid', { type: 'INVALIDATE' })).toBe('invalid');
    });

    it('returns "invalid" on INVALIDATE from "invalid" (idempotent)', () => {
      expect(textareaValidationReducer('invalid', { type: 'INVALIDATE' })).toBe('invalid');
    });

    it('returns "valid" on VALIDATE from "invalid"', () => {
      expect(textareaValidationReducer('invalid', { type: 'VALIDATE' })).toBe('valid');
    });

    it('returns "valid" on VALIDATE from "valid" (idempotent)', () => {
      expect(textareaValidationReducer('valid', { type: 'VALIDATE' })).toBe('valid');
    });

    it('returns current state for unknown action', () => {
      // @ts-expect-error testing unknown action
      expect(textareaValidationReducer('valid', { type: 'UNKNOWN' })).toBe('valid');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  ToggleSwitch                                                       */
/* ------------------------------------------------------------------ */

import {
  toggleReducer,
} from '../../surface/widgets/nextjs/components/widgets/form-controls/ToggleSwitch.reducer.js';

describe('ToggleSwitch', () => {
  describe('toggleReducer', () => {
    it('returns "on" on TOGGLE from "off"', () => {
      expect(toggleReducer('off', { type: 'TOGGLE' })).toBe('on');
    });

    it('returns "off" on TOGGLE from "on"', () => {
      expect(toggleReducer('on', { type: 'TOGGLE' })).toBe('off');
    });

    it('toggles back and forth', () => {
      let state = toggleReducer('off', { type: 'TOGGLE' });
      expect(state).toBe('on');
      state = toggleReducer(state, { type: 'TOGGLE' });
      expect(state).toBe('off');
      state = toggleReducer(state, { type: 'TOGGLE' });
      expect(state).toBe('on');
    });
  });
});
