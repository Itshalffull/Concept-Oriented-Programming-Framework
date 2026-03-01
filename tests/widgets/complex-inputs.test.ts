import { describe, it, expect, beforeEach } from 'vitest';

import {
  colorReducer,
  hexToHsl,
  hslToHex,
  type ColorMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/ColorPicker.reducer.js';

import {
  datePickerReducer,
  getDaysInMonth as dpGetDaysInMonth,
  type DatePickerMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/DatePicker.reducer.js';

import {
  dateRangeReducer,
  getDaysInMonth as drGetDaysInMonth,
  type DateRangeMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/DateRangePicker.reducer.js';

import {
  fileUploadReducer,
  formatFileSize,
  resetFileIdCounter,
  type FileUploadMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/FileUpload.reducer.js';

import {
  formulaReducer,
  type FormulaMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/FormulaEditor.reducer.js';

import {
  mentionReducer,
  type MentionMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/MentionInput.reducer.js';

import {
  pinReducer,
  type PinMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/PinInput.reducer.js';

import {
  sliderReducer,
  type InteractionState,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/RangeSlider.reducer.js';

import {
  ratingReducer,
  type RatingMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/Rating.reducer.js';

import {
  richTextReducer,
  type RichTextMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/RichTextEditor.reducer.js';

import {
  signatureReducer,
  type SignatureMachine,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/SignaturePad.reducer.js';

import {
  treeReducer,
  getAllDescendantIds,
  findNode,
  type TreeMachine,
  type TreeNode,
} from '../../surface/widgets/nextjs/components/widgets/complex-inputs/TreeSelect.reducer.js';

/* ===========================================================================
 * ColorPicker
 * ========================================================================= */
describe('ColorPicker', () => {
  describe('hexToHsl', () => {
    it('converts black correctly', () => {
      const hsl = hexToHsl('#000000');
      expect(hsl).toEqual({ h: 0, s: 0, l: 0 });
    });

    it('converts white correctly', () => {
      const hsl = hexToHsl('#ffffff');
      expect(hsl).toEqual({ h: 0, s: 0, l: 100 });
    });

    it('converts pure red', () => {
      const hsl = hexToHsl('#ff0000');
      expect(hsl).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('converts pure green', () => {
      const hsl = hexToHsl('#00ff00');
      expect(hsl).toEqual({ h: 120, s: 100, l: 50 });
    });

    it('converts pure blue', () => {
      const hsl = hexToHsl('#0000ff');
      expect(hsl).toEqual({ h: 240, s: 100, l: 50 });
    });

    it('handles hex without # prefix', () => {
      const hsl = hexToHsl('ff0000');
      expect(hsl).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('returns zeros for invalid hex', () => {
      const hsl = hexToHsl('not-a-color');
      expect(hsl).toEqual({ h: 0, s: 0, l: 0 });
    });

    it('returns zeros for empty string', () => {
      const hsl = hexToHsl('');
      expect(hsl).toEqual({ h: 0, s: 0, l: 0 });
    });

    it('converts a mid-gray', () => {
      const hsl = hexToHsl('#808080');
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBe(50);
    });

    it('converts yellow (#ffff00)', () => {
      const hsl = hexToHsl('#ffff00');
      expect(hsl).toEqual({ h: 60, s: 100, l: 50 });
    });

    it('converts cyan (#00ffff)', () => {
      const hsl = hexToHsl('#00ffff');
      expect(hsl).toEqual({ h: 180, s: 100, l: 50 });
    });

    it('converts magenta (#ff00ff)', () => {
      const hsl = hexToHsl('#ff00ff');
      expect(hsl).toEqual({ h: 300, s: 100, l: 50 });
    });
  });

  describe('hslToHex', () => {
    it('converts black', () => {
      expect(hslToHex(0, 0, 0)).toBe('#000000');
    });

    it('converts white', () => {
      expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    });

    it('converts pure red', () => {
      expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    });

    it('converts pure green', () => {
      expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    });

    it('converts pure blue', () => {
      expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    });

    it('roundtrips with hexToHsl for primary colors', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#000000', '#ffffff'];
      for (const hex of colors) {
        const hsl = hexToHsl(hex);
        const result = hslToHex(hsl.h, hsl.s, hsl.l);
        expect(result).toBe(hex);
      }
    });
  });

  describe('colorReducer', () => {
    const initial: ColorMachine = {
      popover: 'closed',
      interaction: 'idle',
      focus: 'unfocused',
      hue: 0,
      saturation: 50,
      lightness: 50,
    };

    it('toggles popover open on TRIGGER_CLICK from closed', () => {
      const result = colorReducer(initial, { type: 'TRIGGER_CLICK' });
      expect(result.popover).toBe('open');
    });

    it('toggles popover closed on TRIGGER_CLICK from open', () => {
      const open = { ...initial, popover: 'open' as const };
      const result = colorReducer(open, { type: 'TRIGGER_CLICK' });
      expect(result.popover).toBe('closed');
    });

    it('closes popover on CLOSE', () => {
      const open = { ...initial, popover: 'open' as const };
      expect(colorReducer(open, { type: 'CLOSE' }).popover).toBe('closed');
    });

    it('closes popover on ESCAPE', () => {
      const open = { ...initial, popover: 'open' as const };
      expect(colorReducer(open, { type: 'ESCAPE' }).popover).toBe('closed');
    });

    it('closes popover on OUTSIDE_CLICK', () => {
      const open = { ...initial, popover: 'open' as const };
      expect(colorReducer(open, { type: 'OUTSIDE_CLICK' }).popover).toBe('closed');
    });

    it('sets interaction to selectingArea on AREA_POINTER_DOWN', () => {
      const result = colorReducer(initial, { type: 'AREA_POINTER_DOWN' });
      expect(result.interaction).toBe('selectingArea');
    });

    it('sets interaction to selectingSlider on SLIDER_POINTER_DOWN', () => {
      const result = colorReducer(initial, { type: 'SLIDER_POINTER_DOWN' });
      expect(result.interaction).toBe('selectingSlider');
    });

    it('resets interaction to idle on POINTER_UP', () => {
      const dragging = { ...initial, interaction: 'selectingArea' as const };
      const result = colorReducer(dragging, { type: 'POINTER_UP' });
      expect(result.interaction).toBe('idle');
    });

    it('sets focus to focused on FOCUS', () => {
      const result = colorReducer(initial, { type: 'FOCUS' });
      expect(result.focus).toBe('focused');
    });

    it('sets focus to unfocused on BLUR', () => {
      const focused = { ...initial, focus: 'focused' as const };
      const result = colorReducer(focused, { type: 'BLUR' });
      expect(result.focus).toBe('unfocused');
    });

    it('clamps SET_HUE to [0, 360]', () => {
      expect(colorReducer(initial, { type: 'SET_HUE', value: 400 }).hue).toBe(360);
      expect(colorReducer(initial, { type: 'SET_HUE', value: -10 }).hue).toBe(0);
      expect(colorReducer(initial, { type: 'SET_HUE', value: 180 }).hue).toBe(180);
    });

    it('clamps SET_SATURATION to [0, 100]', () => {
      expect(colorReducer(initial, { type: 'SET_SATURATION', value: 150 }).saturation).toBe(100);
      expect(colorReducer(initial, { type: 'SET_SATURATION', value: -5 }).saturation).toBe(0);
    });

    it('clamps SET_LIGHTNESS to [0, 100]', () => {
      expect(colorReducer(initial, { type: 'SET_LIGHTNESS', value: 200 }).lightness).toBe(100);
      expect(colorReducer(initial, { type: 'SET_LIGHTNESS', value: -1 }).lightness).toBe(0);
    });

    it('increases saturation by 1', () => {
      const result = colorReducer(initial, { type: 'INCREASE_SATURATION' });
      expect(result.saturation).toBe(51);
    });

    it('decreases saturation by 1', () => {
      const result = colorReducer(initial, { type: 'DECREASE_SATURATION' });
      expect(result.saturation).toBe(49);
    });

    it('clamps saturation at 100 on increase', () => {
      const maxSat = { ...initial, saturation: 100 };
      const result = colorReducer(maxSat, { type: 'INCREASE_SATURATION' });
      expect(result.saturation).toBe(100);
    });

    it('clamps saturation at 0 on decrease', () => {
      const zeroSat = { ...initial, saturation: 0 };
      const result = colorReducer(zeroSat, { type: 'DECREASE_SATURATION' });
      expect(result.saturation).toBe(0);
    });

    it('increases lightness by 1', () => {
      const result = colorReducer(initial, { type: 'INCREASE_LIGHTNESS' });
      expect(result.lightness).toBe(51);
    });

    it('decreases lightness by 1', () => {
      const result = colorReducer(initial, { type: 'DECREASE_LIGHTNESS' });
      expect(result.lightness).toBe(49);
    });

    it('wraps hue on INCREASE_HUE at boundary', () => {
      const atMax = { ...initial, hue: 359 };
      const result = colorReducer(atMax, { type: 'INCREASE_HUE' });
      expect(result.hue).toBe(0);
    });

    it('wraps hue on DECREASE_HUE at boundary', () => {
      const atMin = { ...initial, hue: 0 };
      const result = colorReducer(atMin, { type: 'DECREASE_HUE' });
      expect(result.hue).toBe(359);
    });

    it('does not mutate the original state', () => {
      const before = { ...initial };
      colorReducer(initial, { type: 'INCREASE_HUE' });
      expect(initial).toEqual(before);
    });
  });
});

/* ===========================================================================
 * DatePicker
 * ========================================================================= */
describe('DatePicker', () => {
  describe('getDaysInMonth', () => {
    it('returns 31 for January', () => {
      expect(dpGetDaysInMonth(2024, 0)).toBe(31);
    });

    it('returns 29 for February in a leap year', () => {
      expect(dpGetDaysInMonth(2024, 1)).toBe(29);
    });

    it('returns 28 for February in a non-leap year', () => {
      expect(dpGetDaysInMonth(2023, 1)).toBe(28);
    });

    it('returns 30 for April', () => {
      expect(dpGetDaysInMonth(2024, 3)).toBe(30);
    });
  });

  describe('datePickerReducer', () => {
    const initial: DatePickerMachine = {
      popover: 'closed',
      view: 'dayView',
      focus: 'idle',
      validation: 'valid',
      focusedYear: 2024,
      focusedMonth: 5,
      focusedDay: 15,
    };

    it('opens popover on OPEN from closed', () => {
      expect(datePickerReducer(initial, { type: 'OPEN' }).popover).toBe('open');
    });

    it('closes popover on OPEN from open', () => {
      const open = { ...initial, popover: 'open' as const };
      expect(datePickerReducer(open, { type: 'OPEN' }).popover).toBe('closed');
    });

    it('toggles popover on TRIGGER_CLICK', () => {
      const r1 = datePickerReducer(initial, { type: 'TRIGGER_CLICK' });
      expect(r1.popover).toBe('open');
      const r2 = datePickerReducer(r1, { type: 'TRIGGER_CLICK' });
      expect(r2.popover).toBe('closed');
    });

    it('resets view on CLOSE', () => {
      const monthView = { ...initial, popover: 'open' as const, view: 'monthView' as const };
      const result = datePickerReducer(monthView, { type: 'CLOSE' });
      expect(result.popover).toBe('closed');
      expect(result.view).toBe('dayView');
    });

    it('resets view on ESCAPE', () => {
      const yearView = { ...initial, popover: 'open' as const, view: 'yearView' as const };
      const result = datePickerReducer(yearView, { type: 'ESCAPE' });
      expect(result.view).toBe('dayView');
    });

    it('resets view on OUTSIDE_CLICK', () => {
      const monthView = { ...initial, popover: 'open' as const, view: 'monthView' as const };
      const result = datePickerReducer(monthView, { type: 'OUTSIDE_CLICK' });
      expect(result.view).toBe('dayView');
    });

    it('closes popover on SELECT_DATE and resets view', () => {
      const open = { ...initial, popover: 'open' as const, view: 'dayView' as const };
      const result = datePickerReducer(open, { type: 'SELECT_DATE', date: new Date() });
      expect(result.popover).toBe('closed');
      expect(result.view).toBe('dayView');
    });

    it('VIEW_UP transitions dayView -> monthView -> yearView', () => {
      const r1 = datePickerReducer(initial, { type: 'VIEW_UP' });
      expect(r1.view).toBe('monthView');
      const r2 = datePickerReducer(r1, { type: 'VIEW_UP' });
      expect(r2.view).toBe('yearView');
    });

    it('VIEW_UP from yearView stays at yearView', () => {
      const yearView = { ...initial, view: 'yearView' as const };
      expect(datePickerReducer(yearView, { type: 'VIEW_UP' }).view).toBe('yearView');
    });

    it('SELECT_MONTH sets month and returns to dayView', () => {
      const monthView = { ...initial, view: 'monthView' as const };
      const result = datePickerReducer(monthView, { type: 'SELECT_MONTH', month: 8 });
      expect(result.view).toBe('dayView');
      expect(result.focusedMonth).toBe(8);
    });

    it('SELECT_YEAR sets year and returns to monthView', () => {
      const yearView = { ...initial, view: 'yearView' as const };
      const result = datePickerReducer(yearView, { type: 'SELECT_YEAR', year: 2030 });
      expect(result.view).toBe('monthView');
      expect(result.focusedYear).toBe(2030);
    });

    it('PREV_MONTH decrements month', () => {
      const result = datePickerReducer(initial, { type: 'PREV_MONTH' });
      expect(result.focusedMonth).toBe(4);
    });

    it('PREV_MONTH wraps from January to December of previous year', () => {
      const jan = { ...initial, focusedMonth: 0, focusedYear: 2024 };
      const result = datePickerReducer(jan, { type: 'PREV_MONTH' });
      expect(result.focusedMonth).toBe(11);
      expect(result.focusedYear).toBe(2023);
    });

    it('NEXT_MONTH increments month', () => {
      const result = datePickerReducer(initial, { type: 'NEXT_MONTH' });
      expect(result.focusedMonth).toBe(6);
    });

    it('NEXT_MONTH wraps from December to January of next year', () => {
      const dec = { ...initial, focusedMonth: 11, focusedYear: 2024 };
      const result = datePickerReducer(dec, { type: 'NEXT_MONTH' });
      expect(result.focusedMonth).toBe(0);
      expect(result.focusedYear).toBe(2025);
    });

    it('NAVIGATE_UP subtracts 7 days (clamped to 1)', () => {
      const result = datePickerReducer(initial, { type: 'NAVIGATE_UP' });
      expect(result.focusedDay).toBe(8);
    });

    it('NAVIGATE_UP clamps to 1 when near start', () => {
      const day3 = { ...initial, focusedDay: 3 };
      const result = datePickerReducer(day3, { type: 'NAVIGATE_UP' });
      expect(result.focusedDay).toBe(1);
    });

    it('NAVIGATE_DOWN adds 7 days (clamped to month end)', () => {
      const result = datePickerReducer(initial, { type: 'NAVIGATE_DOWN' });
      expect(result.focusedDay).toBe(22);
    });

    it('NAVIGATE_DOWN clamps to end of month', () => {
      // June 2024 has 30 days, day 28 + 7 = 35 -> 30
      const day28 = { ...initial, focusedDay: 28 };
      const result = datePickerReducer(day28, { type: 'NAVIGATE_DOWN' });
      expect(result.focusedDay).toBe(30);
    });

    it('NAVIGATE_PREV decrements day', () => {
      const result = datePickerReducer(initial, { type: 'NAVIGATE_PREV' });
      expect(result.focusedDay).toBe(14);
    });

    it('NAVIGATE_PREV does nothing at day 1', () => {
      const day1 = { ...initial, focusedDay: 1 };
      const result = datePickerReducer(day1, { type: 'NAVIGATE_PREV' });
      expect(result.focusedDay).toBe(1);
    });

    it('NAVIGATE_NEXT increments day', () => {
      const result = datePickerReducer(initial, { type: 'NAVIGATE_NEXT' });
      expect(result.focusedDay).toBe(16);
    });

    it('NAVIGATE_NEXT does nothing at last day of month', () => {
      const day30 = { ...initial, focusedDay: 30 }; // June has 30 days
      const result = datePickerReducer(day30, { type: 'NAVIGATE_NEXT' });
      expect(result.focusedDay).toBe(30);
    });

    it('FIRST_DAY sets focusedDay to 1', () => {
      const result = datePickerReducer(initial, { type: 'FIRST_DAY' });
      expect(result.focusedDay).toBe(1);
    });

    it('LAST_DAY sets focusedDay to end of month', () => {
      const result = datePickerReducer(initial, { type: 'LAST_DAY' });
      expect(result.focusedDay).toBe(30); // June
    });

    it('FOCUS sets focus to focused', () => {
      expect(datePickerReducer(initial, { type: 'FOCUS' }).focus).toBe('focused');
    });

    it('BLUR sets focus to idle', () => {
      const focused = { ...initial, focus: 'focused' as const };
      expect(datePickerReducer(focused, { type: 'BLUR' }).focus).toBe('idle');
    });

    it('INVALIDATE sets validation to invalid', () => {
      expect(datePickerReducer(initial, { type: 'INVALIDATE' }).validation).toBe('invalid');
    });

    it('VALIDATE sets validation to valid', () => {
      const invalid = { ...initial, validation: 'invalid' as const };
      expect(datePickerReducer(invalid, { type: 'VALIDATE' }).validation).toBe('valid');
    });
  });
});

/* ===========================================================================
 * DateRangePicker
 * ========================================================================= */
describe('DateRangePicker', () => {
  describe('getDaysInMonth', () => {
    it('returns 31 for December', () => {
      expect(drGetDaysInMonth(2024, 11)).toBe(31);
    });

    it('returns 28 for Feb in a non-leap year', () => {
      expect(drGetDaysInMonth(2025, 1)).toBe(28);
    });
  });

  describe('dateRangeReducer', () => {
    const initial: DateRangeMachine = {
      popover: 'closed',
      selection: 'selectingStart',
      hover: 'idle',
      focus: 'unfocused',
      focusedYear: 2024,
      focusedMonth: 5,
      focusedDay: 15,
      hoverDate: null,
    };

    it('toggles popover on OPEN', () => {
      const r1 = dateRangeReducer(initial, { type: 'OPEN' });
      expect(r1.popover).toBe('open');
      const r2 = dateRangeReducer(r1, { type: 'OPEN' });
      expect(r2.popover).toBe('closed');
    });

    it('toggles popover on TRIGGER_CLICK', () => {
      const result = dateRangeReducer(initial, { type: 'TRIGGER_CLICK' });
      expect(result.popover).toBe('open');
    });

    it('closes and resets selection on CLOSE', () => {
      const state = { ...initial, popover: 'open' as const, selection: 'selectingEnd' as const };
      const result = dateRangeReducer(state, { type: 'CLOSE' });
      expect(result.popover).toBe('closed');
      expect(result.selection).toBe('selectingStart');
    });

    it('closes and resets selection on ESCAPE', () => {
      const state = { ...initial, popover: 'open' as const, selection: 'selectingEnd' as const };
      const result = dateRangeReducer(state, { type: 'ESCAPE' });
      expect(result.popover).toBe('closed');
      expect(result.selection).toBe('selectingStart');
    });

    it('closes and resets selection on OUTSIDE_CLICK', () => {
      const state = { ...initial, popover: 'open' as const, selection: 'selectingEnd' as const };
      const result = dateRangeReducer(state, { type: 'OUTSIDE_CLICK' });
      expect(result.popover).toBe('closed');
      expect(result.selection).toBe('selectingStart');
    });

    it('closes and resets on CONFIRM', () => {
      const state = { ...initial, popover: 'open' as const, selection: 'selectingEnd' as const };
      const result = dateRangeReducer(state, { type: 'CONFIRM' });
      expect(result.popover).toBe('closed');
      expect(result.selection).toBe('selectingStart');
    });

    it('SELECT_CELL toggles selection between selectingStart and selectingEnd', () => {
      const r1 = dateRangeReducer(initial, { type: 'SELECT_CELL', date: new Date() });
      expect(r1.selection).toBe('selectingEnd');
      const r2 = dateRangeReducer(r1, { type: 'SELECT_CELL', date: new Date() });
      expect(r2.selection).toBe('selectingStart');
    });

    it('SELECT_PRESET resets to selectingStart', () => {
      const state = { ...initial, selection: 'selectingEnd' as const };
      const result = dateRangeReducer(state, {
        type: 'SELECT_PRESET',
        range: { start: new Date(), end: new Date() },
      });
      expect(result.selection).toBe('selectingStart');
    });

    it('HOVER_CELL sets hover state and date', () => {
      const date = new Date(2024, 5, 20);
      const result = dateRangeReducer(initial, { type: 'HOVER_CELL', date });
      expect(result.hover).toBe('hovering');
      expect(result.hoverDate).toBe(date);
    });

    it('HOVER_OUT resets hover state', () => {
      const hovering = { ...initial, hover: 'hovering' as const, hoverDate: new Date() };
      const result = dateRangeReducer(hovering, { type: 'HOVER_OUT' });
      expect(result.hover).toBe('idle');
      expect(result.hoverDate).toBeNull();
    });

    it('PREV_MONTH wraps from January to December', () => {
      const jan = { ...initial, focusedMonth: 0, focusedYear: 2024 };
      const result = dateRangeReducer(jan, { type: 'PREV_MONTH' });
      expect(result.focusedMonth).toBe(11);
      expect(result.focusedYear).toBe(2023);
    });

    it('NEXT_MONTH wraps from December to January', () => {
      const dec = { ...initial, focusedMonth: 11, focusedYear: 2024 };
      const result = dateRangeReducer(dec, { type: 'NEXT_MONTH' });
      expect(result.focusedMonth).toBe(0);
      expect(result.focusedYear).toBe(2025);
    });

    it('NAVIGATE_UP decrements day by 7', () => {
      const result = dateRangeReducer(initial, { type: 'NAVIGATE_UP' });
      expect(result.focusedDay).toBe(8);
    });

    it('NAVIGATE_DOWN increments day by 7 clamped', () => {
      const day28 = { ...initial, focusedDay: 28 };
      const result = dateRangeReducer(day28, { type: 'NAVIGATE_DOWN' });
      expect(result.focusedDay).toBe(30); // June has 30 days
    });

    it('NAVIGATE_PREV decrements day', () => {
      const result = dateRangeReducer(initial, { type: 'NAVIGATE_PREV' });
      expect(result.focusedDay).toBe(14);
    });

    it('NAVIGATE_PREV does nothing at day 1', () => {
      const day1 = { ...initial, focusedDay: 1 };
      expect(dateRangeReducer(day1, { type: 'NAVIGATE_PREV' }).focusedDay).toBe(1);
    });

    it('NAVIGATE_NEXT increments day', () => {
      const result = dateRangeReducer(initial, { type: 'NAVIGATE_NEXT' });
      expect(result.focusedDay).toBe(16);
    });

    it('NAVIGATE_NEXT does nothing at last day', () => {
      const day30 = { ...initial, focusedDay: 30 };
      expect(dateRangeReducer(day30, { type: 'NAVIGATE_NEXT' }).focusedDay).toBe(30);
    });

    it('FOCUS and BLUR toggle focus state', () => {
      const r1 = dateRangeReducer(initial, { type: 'FOCUS' });
      expect(r1.focus).toBe('focused');
      const r2 = dateRangeReducer(r1, { type: 'BLUR' });
      expect(r2.focus).toBe('unfocused');
    });
  });
});

/* ===========================================================================
 * FileUpload
 * ========================================================================= */
describe('FileUpload', () => {
  describe('formatFileSize', () => {
    it('returns "0 B" for zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('formats fractional sizes', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('fileUploadReducer', () => {
    const initial: FileUploadMachine = {
      dropzone: 'idle',
      upload: 'ready',
      files: [],
    };

    beforeEach(() => {
      resetFileIdCounter();
    });

    it('sets dropzone to dragOver on DRAG_ENTER', () => {
      const result = fileUploadReducer(initial, { type: 'DRAG_ENTER' });
      expect(result.dropzone).toBe('dragOver');
    });

    it('sets dropzone to idle on DRAG_LEAVE', () => {
      const dragging = { ...initial, dropzone: 'dragOver' as const };
      const result = fileUploadReducer(dragging, { type: 'DRAG_LEAVE' });
      expect(result.dropzone).toBe('idle');
    });

    it('adds files and sets upload to uploading on DROP', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = fileUploadReducer(initial, { type: 'DROP', files: [file] });
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('test.txt');
      expect(result.files[0].state).toBe('pending');
      expect(result.upload).toBe('uploading');
      expect(result.dropzone).toBe('idle');
    });

    it('adds files on FILES_ADDED', () => {
      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      const result = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file] });
      expect(result.files).toHaveLength(1);
      expect(result.upload).toBe('uploading');
    });

    it('removes a file by id on REMOVE', () => {
      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      const withFile = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file] });
      const fileId = withFile.files[0].id;
      const result = fileUploadReducer(withFile, { type: 'REMOVE', fileId });
      expect(result.files).toHaveLength(0);
      expect(result.upload).toBe('ready');
    });

    it('REMOVE does nothing for non-existent id', () => {
      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      const withFile = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file] });
      const result = fileUploadReducer(withFile, { type: 'REMOVE', fileId: 'nonexistent' });
      expect(result.files).toHaveLength(1);
    });

    it('clears all files on CLEAR_ALL', () => {
      const file1 = new File(['a'], 'a.txt');
      const file2 = new File(['b'], 'b.txt');
      const withFiles = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file1, file2] });
      const result = fileUploadReducer(withFiles, { type: 'CLEAR_ALL' });
      expect(result.files).toHaveLength(0);
      expect(result.upload).toBe('ready');
    });

    it('updates file state on SET_FILE_STATE', () => {
      const file = new File(['data'], 'doc.pdf');
      const withFile = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file] });
      const fileId = withFile.files[0].id;
      const result = fileUploadReducer(withFile, {
        type: 'SET_FILE_STATE',
        fileId,
        state: 'uploading',
        progress: 50,
      });
      expect(result.files[0].state).toBe('uploading');
      expect(result.files[0].progress).toBe(50);
    });

    it('SET_FILE_STATE sets error message', () => {
      const file = new File(['data'], 'doc.pdf');
      const withFile = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file] });
      const fileId = withFile.files[0].id;
      const result = fileUploadReducer(withFile, {
        type: 'SET_FILE_STATE',
        fileId,
        state: 'failed',
        error: 'Network error',
      });
      expect(result.files[0].state).toBe('failed');
      expect(result.files[0].error).toBe('Network error');
    });

    it('SET_FILE_STATE preserves progress when not provided', () => {
      const file = new File(['data'], 'doc.pdf');
      const withFile = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file] });
      const fileId = withFile.files[0].id;
      const withProgress = fileUploadReducer(withFile, {
        type: 'SET_FILE_STATE',
        fileId,
        state: 'uploading',
        progress: 75,
      });
      const result = fileUploadReducer(withProgress, {
        type: 'SET_FILE_STATE',
        fileId,
        state: 'uploaded',
      });
      expect(result.files[0].progress).toBe(75);
    });

    it('SET_FILE_STATE does nothing for non-existent id', () => {
      const file = new File(['data'], 'doc.pdf');
      const withFile = fileUploadReducer(initial, { type: 'FILES_ADDED', files: [file] });
      const result = fileUploadReducer(withFile, {
        type: 'SET_FILE_STATE',
        fileId: 'nonexistent',
        state: 'uploaded',
      });
      expect(result.files[0].state).toBe('pending');
    });
  });
});

/* ===========================================================================
 * FormulaEditor
 * ========================================================================= */
describe('FormulaEditor', () => {
  describe('formulaReducer', () => {
    const initial: FormulaMachine = {
      content: 'empty',
      interaction: 'idle',
      previewing: 'idle',
      validation: 'valid',
      activeIndex: 0,
      errorMessage: '',
      previewResult: '',
    };

    it('INPUT transitions content from empty to editing', () => {
      const result = formulaReducer(initial, { type: 'INPUT' });
      expect(result.content).toBe('editing');
    });

    it('INPUT transitions interaction from focused to editing', () => {
      const focused = { ...initial, interaction: 'focused' as const };
      const result = formulaReducer(focused, { type: 'INPUT' });
      expect(result.interaction).toBe('editing');
    });

    it('INPUT clears invalid validation', () => {
      const invalid = { ...initial, interaction: 'editing' as const, validation: 'invalid' as const };
      const result = formulaReducer(invalid, { type: 'INPUT' });
      expect(result.validation).toBe('valid');
    });

    it('INPUT dismisses preview', () => {
      const previewing = { ...initial, interaction: 'editing' as const, previewing: 'showing' as const };
      const result = formulaReducer(previewing, { type: 'INPUT' });
      expect(result.previewing).toBe('idle');
    });

    it('PASTE has same transitions as INPUT', () => {
      const result = formulaReducer(initial, { type: 'PASTE' });
      expect(result.content).toBe('editing');
    });

    it('CLEAR resets content to empty', () => {
      const editing = { ...initial, content: 'editing' as const };
      const result = formulaReducer(editing, { type: 'CLEAR' });
      expect(result.content).toBe('empty');
    });

    it('FOCUS from idle transitions to focused', () => {
      const result = formulaReducer(initial, { type: 'FOCUS' });
      expect(result.interaction).toBe('focused');
    });

    it('FOCUS from non-idle state does not change interaction', () => {
      const editing = { ...initial, interaction: 'editing' as const };
      const result = formulaReducer(editing, { type: 'FOCUS' });
      expect(result.interaction).toBe('editing');
    });

    it('BLUR resets interaction to idle', () => {
      const editing = { ...initial, interaction: 'editing' as const };
      const result = formulaReducer(editing, { type: 'BLUR' });
      expect(result.interaction).toBe('idle');
    });

    it('TYPE_CHAR transitions focused to editing', () => {
      const focused = { ...initial, interaction: 'focused' as const };
      const result = formulaReducer(focused, { type: 'TYPE_CHAR' });
      expect(result.interaction).toBe('editing');
    });

    it('TYPE_CHAR does nothing in idle', () => {
      const result = formulaReducer(initial, { type: 'TYPE_CHAR' });
      expect(result.interaction).toBe('idle');
    });

    it('SHOW_AC and TRIGGER_AC set interaction to autocompleting', () => {
      const editing = { ...initial, interaction: 'editing' as const };
      expect(formulaReducer(editing, { type: 'SHOW_AC' }).interaction).toBe('autocompleting');
      expect(formulaReducer(editing, { type: 'TRIGGER_AC' }).interaction).toBe('autocompleting');
    });

    it('SHOW_AC resets activeIndex to 0', () => {
      const editing = { ...initial, interaction: 'editing' as const, activeIndex: 5 };
      const result = formulaReducer(editing, { type: 'SHOW_AC' });
      expect(result.activeIndex).toBe(0);
    });

    it('SELECT_SUGGESTION returns to editing', () => {
      const ac = { ...initial, interaction: 'autocompleting' as const, activeIndex: 3 };
      const result = formulaReducer(ac, { type: 'SELECT_SUGGESTION' });
      expect(result.interaction).toBe('editing');
      expect(result.activeIndex).toBe(0);
    });

    it('ACCEPT_SUGGESTION returns to editing', () => {
      const ac = { ...initial, interaction: 'autocompleting' as const };
      const result = formulaReducer(ac, { type: 'ACCEPT_SUGGESTION' });
      expect(result.interaction).toBe('editing');
    });

    it('DISMISS_AC from autocompleting returns to editing', () => {
      const ac = { ...initial, interaction: 'autocompleting' as const };
      const result = formulaReducer(ac, { type: 'DISMISS_AC' });
      expect(result.interaction).toBe('editing');
    });

    it('ESCAPE from autocompleting returns to editing', () => {
      const ac = { ...initial, interaction: 'autocompleting' as const };
      const result = formulaReducer(ac, { type: 'ESCAPE' });
      expect(result.interaction).toBe('editing');
    });

    it('ESCAPE from non-autocompleting does not change interaction', () => {
      const editing = { ...initial, interaction: 'editing' as const };
      const result = formulaReducer(editing, { type: 'ESCAPE' });
      expect(result.interaction).toBe('editing');
    });

    it('NAVIGATE_DOWN increments activeIndex', () => {
      const result = formulaReducer(initial, { type: 'NAVIGATE_DOWN' });
      expect(result.activeIndex).toBe(1);
    });

    it('NAVIGATE_UP decrements activeIndex clamped to 0', () => {
      const result = formulaReducer(initial, { type: 'NAVIGATE_UP' });
      expect(result.activeIndex).toBe(0);
      const idx3 = { ...initial, activeIndex: 3 };
      expect(formulaReducer(idx3, { type: 'NAVIGATE_UP' }).activeIndex).toBe(2);
    });

    it('HIGHLIGHT sets activeIndex', () => {
      const result = formulaReducer(initial, { type: 'HIGHLIGHT', index: 7 });
      expect(result.activeIndex).toBe(7);
    });

    it('EVALUATE sets previewing to showing with result', () => {
      const result = formulaReducer(initial, { type: 'EVALUATE', result: '42' });
      expect(result.previewing).toBe('showing');
      expect(result.previewResult).toBe('42');
    });

    it('SYNTAX_ERROR sets validation to invalid and clears preview', () => {
      const showing = { ...initial, previewing: 'showing' as const };
      const result = formulaReducer(showing, { type: 'SYNTAX_ERROR', message: 'Bad syntax' });
      expect(result.validation).toBe('invalid');
      expect(result.errorMessage).toBe('Bad syntax');
      expect(result.previewing).toBe('idle');
    });

    it('TYPE_ERROR sets validation to invalid', () => {
      const result = formulaReducer(initial, { type: 'TYPE_ERROR', message: 'Type mismatch' });
      expect(result.validation).toBe('invalid');
      expect(result.errorMessage).toBe('Type mismatch');
    });

    it('VALIDATE clears error', () => {
      const invalid = { ...initial, validation: 'invalid' as const, errorMessage: 'err' };
      const result = formulaReducer(invalid, { type: 'VALIDATE' });
      expect(result.validation).toBe('valid');
      expect(result.errorMessage).toBe('');
    });
  });
});

/* ===========================================================================
 * MentionInput
 * ========================================================================= */
describe('MentionInput', () => {
  describe('mentionReducer', () => {
    const initial: MentionMachine = {
      trigger: 'idle',
      focus: 'unfocused',
      navigation: 'none',
      activeTriggerChar: '',
      query: '',
      activeIndex: 0,
    };

    it('TRIGGER_CHAR transitions to triggered state', () => {
      const result = mentionReducer(initial, { type: 'TRIGGER_CHAR', char: '@' });
      expect(result.trigger).toBe('triggered');
      expect(result.activeTriggerChar).toBe('@');
      expect(result.query).toBe('');
      expect(result.activeIndex).toBe(0);
    });

    it('QUERY_CHANGE transitions to suggesting when triggered', () => {
      const triggered = { ...initial, trigger: 'triggered' as const, activeTriggerChar: '@' };
      const result = mentionReducer(triggered, { type: 'QUERY_CHANGE', query: 'john' });
      expect(result.trigger).toBe('suggesting');
      expect(result.query).toBe('john');
      expect(result.activeIndex).toBe(0);
    });

    it('QUERY_CHANGE keeps suggesting state and resets activeIndex', () => {
      const suggesting = { ...initial, trigger: 'suggesting' as const, activeIndex: 3 };
      const result = mentionReducer(suggesting, { type: 'QUERY_CHANGE', query: 'jo' });
      expect(result.trigger).toBe('suggesting');
      expect(result.activeIndex).toBe(0);
    });

    it('QUERY_CHANGE from idle does not change trigger', () => {
      const result = mentionReducer(initial, { type: 'QUERY_CHANGE', query: 'test' });
      expect(result.trigger).toBe('idle');
    });

    it('SHOW_SUGGESTIONS transitions to suggesting', () => {
      const result = mentionReducer(initial, { type: 'SHOW_SUGGESTIONS' });
      expect(result.trigger).toBe('suggesting');
    });

    it('SELECT resets to idle', () => {
      const suggesting = { ...initial, trigger: 'suggesting' as const, navigation: 'active' as const, query: 'john', activeIndex: 2 };
      const result = mentionReducer(suggesting, { type: 'SELECT' });
      expect(result.trigger).toBe('idle');
      expect(result.navigation).toBe('none');
      expect(result.query).toBe('');
      expect(result.activeIndex).toBe(0);
    });

    it('ESCAPE resets trigger and navigation', () => {
      const suggesting = { ...initial, trigger: 'suggesting' as const, navigation: 'active' as const, query: 'john' };
      const result = mentionReducer(suggesting, { type: 'ESCAPE' });
      expect(result.trigger).toBe('idle');
      expect(result.navigation).toBe('none');
      expect(result.query).toBe('');
    });

    it('FOCUS sets focus to focused', () => {
      const result = mentionReducer(initial, { type: 'FOCUS' });
      expect(result.focus).toBe('focused');
    });

    it('BLUR resets focus, trigger, and navigation', () => {
      const active = { ...initial, focus: 'focused' as const, trigger: 'suggesting' as const, navigation: 'active' as const };
      const result = mentionReducer(active, { type: 'BLUR' });
      expect(result.focus).toBe('unfocused');
      expect(result.trigger).toBe('idle');
      expect(result.navigation).toBe('none');
    });

    it('NO_RESULTS resets trigger to idle', () => {
      const suggesting = { ...initial, trigger: 'suggesting' as const };
      const result = mentionReducer(suggesting, { type: 'NO_RESULTS' });
      expect(result.trigger).toBe('idle');
    });

    it('NAVIGATE_DOWN increments activeIndex and activates navigation', () => {
      const result = mentionReducer(initial, { type: 'NAVIGATE_DOWN' });
      expect(result.navigation).toBe('active');
      expect(result.activeIndex).toBe(1);
    });

    it('NAVIGATE_UP decrements activeIndex clamped to 0', () => {
      const result = mentionReducer(initial, { type: 'NAVIGATE_UP' });
      expect(result.activeIndex).toBe(0);
      expect(result.navigation).toBe('active');
    });

    it('NAVIGATE_UP decrements from non-zero', () => {
      const idx3 = { ...initial, activeIndex: 3 };
      const result = mentionReducer(idx3, { type: 'NAVIGATE_UP' });
      expect(result.activeIndex).toBe(2);
    });

    it('HIGHLIGHT sets activeIndex and activates navigation', () => {
      const result = mentionReducer(initial, { type: 'HIGHLIGHT', index: 5 });
      expect(result.activeIndex).toBe(5);
      expect(result.navigation).toBe('active');
    });
  });
});

/* ===========================================================================
 * PinInput
 * ========================================================================= */
describe('PinInput', () => {
  describe('pinReducer', () => {
    const initial: PinMachine = {
      completion: 'empty',
      focus: 'unfocused',
    };

    it('FILL_ALL sets completion to complete', () => {
      const result = pinReducer(initial, { type: 'FILL_ALL' });
      expect(result.completion).toBe('complete');
    });

    it('CLEAR_ALL sets completion to empty', () => {
      const partial = { completion: 'partial' as const, focus: 'focused' as const };
      const result = pinReducer(partial, { type: 'CLEAR_ALL' });
      expect(result.completion).toBe('empty');
    });

    it('INPUT transitions from empty to partial', () => {
      const result = pinReducer(initial, { type: 'INPUT' });
      expect(result.completion).toBe('partial');
    });

    it('INPUT does not change partial state', () => {
      const partial: PinMachine = { completion: 'partial', focus: 'unfocused' };
      const result = pinReducer(partial, { type: 'INPUT' });
      expect(result.completion).toBe('partial');
    });

    it('INPUT does not change complete state', () => {
      const complete: PinMachine = { completion: 'complete', focus: 'unfocused' };
      const result = pinReducer(complete, { type: 'INPUT' });
      expect(result.completion).toBe('complete');
    });

    it('PASTE transitions from empty to partial', () => {
      const result = pinReducer(initial, { type: 'PASTE' });
      expect(result.completion).toBe('partial');
    });

    it('DELETE_CHAR transitions from complete to partial', () => {
      const complete: PinMachine = { completion: 'complete', focus: 'focused' };
      const result = pinReducer(complete, { type: 'DELETE_CHAR' });
      expect(result.completion).toBe('partial');
    });

    it('DELETE_CHAR does not change empty', () => {
      const result = pinReducer(initial, { type: 'DELETE_CHAR' });
      expect(result.completion).toBe('empty');
    });

    it('DELETE_CHAR does not change partial', () => {
      const partial: PinMachine = { completion: 'partial', focus: 'unfocused' };
      const result = pinReducer(partial, { type: 'DELETE_CHAR' });
      expect(result.completion).toBe('partial');
    });

    it('FOCUS sets focus to focused', () => {
      const result = pinReducer(initial, { type: 'FOCUS' });
      expect(result.focus).toBe('focused');
    });

    it('BLUR sets focus to unfocused', () => {
      const focused: PinMachine = { completion: 'empty', focus: 'focused' };
      const result = pinReducer(focused, { type: 'BLUR' });
      expect(result.focus).toBe('unfocused');
    });

    it('does not mutate original state', () => {
      const original: PinMachine = { completion: 'empty', focus: 'unfocused' };
      const before = { ...original };
      pinReducer(original, { type: 'FOCUS' });
      expect(original).toEqual(before);
    });
  });
});

/* ===========================================================================
 * RangeSlider
 * ========================================================================= */
describe('RangeSlider', () => {
  describe('sliderReducer', () => {
    it('idle -> draggingMin on POINTER_DOWN_MIN', () => {
      expect(sliderReducer('idle', { type: 'POINTER_DOWN_MIN' })).toBe('draggingMin');
    });

    it('idle -> draggingMax on POINTER_DOWN_MAX', () => {
      expect(sliderReducer('idle', { type: 'POINTER_DOWN_MAX' })).toBe('draggingMax');
    });

    it('idle -> focusedMin on FOCUS_MIN', () => {
      expect(sliderReducer('idle', { type: 'FOCUS_MIN' })).toBe('focusedMin');
    });

    it('idle -> focusedMax on FOCUS_MAX', () => {
      expect(sliderReducer('idle', { type: 'FOCUS_MAX' })).toBe('focusedMax');
    });

    it('idle ignores POINTER_UP', () => {
      expect(sliderReducer('idle', { type: 'POINTER_UP' })).toBe('idle');
    });

    it('idle ignores BLUR', () => {
      expect(sliderReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('focusedMin -> idle on BLUR', () => {
      expect(sliderReducer('focusedMin', { type: 'BLUR' })).toBe('idle');
    });

    it('focusedMin -> draggingMin on POINTER_DOWN_MIN', () => {
      expect(sliderReducer('focusedMin', { type: 'POINTER_DOWN_MIN' })).toBe('draggingMin');
    });

    it('focusedMin -> focusedMax on FOCUS_MAX', () => {
      expect(sliderReducer('focusedMin', { type: 'FOCUS_MAX' })).toBe('focusedMax');
    });

    it('focusedMin ignores POINTER_UP', () => {
      expect(sliderReducer('focusedMin', { type: 'POINTER_UP' })).toBe('focusedMin');
    });

    it('focusedMin ignores POINTER_DOWN_MAX', () => {
      expect(sliderReducer('focusedMin', { type: 'POINTER_DOWN_MAX' })).toBe('focusedMin');
    });

    it('focusedMax -> idle on BLUR', () => {
      expect(sliderReducer('focusedMax', { type: 'BLUR' })).toBe('idle');
    });

    it('focusedMax -> draggingMax on POINTER_DOWN_MAX', () => {
      expect(sliderReducer('focusedMax', { type: 'POINTER_DOWN_MAX' })).toBe('draggingMax');
    });

    it('focusedMax -> focusedMin on FOCUS_MIN', () => {
      expect(sliderReducer('focusedMax', { type: 'FOCUS_MIN' })).toBe('focusedMin');
    });

    it('focusedMax ignores POINTER_DOWN_MIN', () => {
      expect(sliderReducer('focusedMax', { type: 'POINTER_DOWN_MIN' })).toBe('focusedMax');
    });

    it('draggingMin -> idle on POINTER_UP', () => {
      expect(sliderReducer('draggingMin', { type: 'POINTER_UP' })).toBe('idle');
    });

    it('draggingMin ignores BLUR', () => {
      expect(sliderReducer('draggingMin', { type: 'BLUR' })).toBe('draggingMin');
    });

    it('draggingMin ignores FOCUS_MIN', () => {
      expect(sliderReducer('draggingMin', { type: 'FOCUS_MIN' })).toBe('draggingMin');
    });

    it('draggingMax -> idle on POINTER_UP', () => {
      expect(sliderReducer('draggingMax', { type: 'POINTER_UP' })).toBe('idle');
    });

    it('draggingMax ignores BLUR', () => {
      expect(sliderReducer('draggingMax', { type: 'BLUR' })).toBe('draggingMax');
    });

    it('draggingMax ignores FOCUS_MAX', () => {
      expect(sliderReducer('draggingMax', { type: 'FOCUS_MAX' })).toBe('draggingMax');
    });
  });
});

/* ===========================================================================
 * Rating
 * ========================================================================= */
describe('Rating', () => {
  describe('ratingReducer', () => {
    const initial: RatingMachine = {
      interaction: 'idle',
      previewValue: 0,
    };

    it('idle -> hovering on HOVER', () => {
      const result = ratingReducer(initial, { type: 'HOVER', previewValue: 3 });
      expect(result.interaction).toBe('hovering');
      expect(result.previewValue).toBe(3);
    });

    it('idle -> focused on FOCUS', () => {
      const result = ratingReducer(initial, { type: 'FOCUS' });
      expect(result.interaction).toBe('focused');
      expect(result.previewValue).toBe(0);
    });

    it('idle ignores BLUR', () => {
      const result = ratingReducer(initial, { type: 'BLUR' });
      expect(result).toBe(initial);
    });

    it('idle ignores HOVER_OUT', () => {
      const result = ratingReducer(initial, { type: 'HOVER_OUT' });
      expect(result).toBe(initial);
    });

    it('idle ignores CLICK', () => {
      const result = ratingReducer(initial, { type: 'CLICK' });
      expect(result).toBe(initial);
    });

    it('hovering updates previewValue on HOVER', () => {
      const hovering: RatingMachine = { interaction: 'hovering', previewValue: 3 };
      const result = ratingReducer(hovering, { type: 'HOVER', previewValue: 4 });
      expect(result.interaction).toBe('hovering');
      expect(result.previewValue).toBe(4);
    });

    it('hovering -> idle on HOVER_OUT', () => {
      const hovering: RatingMachine = { interaction: 'hovering', previewValue: 3 };
      const result = ratingReducer(hovering, { type: 'HOVER_OUT' });
      expect(result.interaction).toBe('idle');
      expect(result.previewValue).toBe(0);
    });

    it('hovering -> idle on CLICK', () => {
      const hovering: RatingMachine = { interaction: 'hovering', previewValue: 4 };
      const result = ratingReducer(hovering, { type: 'CLICK' });
      expect(result.interaction).toBe('idle');
      expect(result.previewValue).toBe(0);
    });

    it('hovering ignores FOCUS', () => {
      const hovering: RatingMachine = { interaction: 'hovering', previewValue: 3 };
      const result = ratingReducer(hovering, { type: 'FOCUS' });
      expect(result).toBe(hovering);
    });

    it('hovering ignores BLUR', () => {
      const hovering: RatingMachine = { interaction: 'hovering', previewValue: 3 };
      const result = ratingReducer(hovering, { type: 'BLUR' });
      expect(result).toBe(hovering);
    });

    it('focused -> idle on BLUR', () => {
      const focused: RatingMachine = { interaction: 'focused', previewValue: 0 };
      const result = ratingReducer(focused, { type: 'BLUR' });
      expect(result.interaction).toBe('idle');
      expect(result.previewValue).toBe(0);
    });

    it('focused -> hovering on HOVER', () => {
      const focused: RatingMachine = { interaction: 'focused', previewValue: 0 };
      const result = ratingReducer(focused, { type: 'HOVER', previewValue: 2 });
      expect(result.interaction).toBe('hovering');
      expect(result.previewValue).toBe(2);
    });

    it('focused ignores CLICK', () => {
      const focused: RatingMachine = { interaction: 'focused', previewValue: 0 };
      const result = ratingReducer(focused, { type: 'CLICK' });
      expect(result).toBe(focused);
    });

    it('focused ignores HOVER_OUT', () => {
      const focused: RatingMachine = { interaction: 'focused', previewValue: 0 };
      const result = ratingReducer(focused, { type: 'HOVER_OUT' });
      expect(result).toBe(focused);
    });
  });
});

/* ===========================================================================
 * RichTextEditor
 * ========================================================================= */
describe('RichTextEditor', () => {
  describe('richTextReducer', () => {
    const initial: RichTextMachine = {
      content: 'empty',
      interaction: 'idle',
      slashCommand: 'hidden',
      activeFormats: new Set(),
    };

    it('INPUT transitions content from empty to editing', () => {
      const result = richTextReducer(initial, { type: 'INPUT' });
      expect(result.content).toBe('editing');
    });

    it('INPUT does not change content if already editing', () => {
      const editing = { ...initial, content: 'editing' as const };
      const result = richTextReducer(editing, { type: 'INPUT' });
      expect(result.content).toBe('editing');
    });

    it('PASTE transitions content from empty to editing', () => {
      const result = richTextReducer(initial, { type: 'PASTE' });
      expect(result.content).toBe('editing');
    });

    it('CLEAR sets content to empty', () => {
      const editing = { ...initial, content: 'editing' as const };
      const result = richTextReducer(editing, { type: 'CLEAR' });
      expect(result.content).toBe('empty');
    });

    it('FOCUS from idle transitions to focused', () => {
      const result = richTextReducer(initial, { type: 'FOCUS' });
      expect(result.interaction).toBe('focused');
    });

    it('FOCUS from non-idle does not change', () => {
      const selecting = { ...initial, interaction: 'selecting' as const };
      const result = richTextReducer(selecting, { type: 'FOCUS' });
      expect(result.interaction).toBe('selecting');
    });

    it('BLUR resets interaction to idle and hides slash command', () => {
      const state = { ...initial, interaction: 'focused' as const, slashCommand: 'visible' as const };
      const result = richTextReducer(state, { type: 'BLUR' });
      expect(result.interaction).toBe('idle');
      expect(result.slashCommand).toBe('hidden');
    });

    it('SELECT_TEXT transitions from focused to selecting', () => {
      const focused = { ...initial, interaction: 'focused' as const };
      const result = richTextReducer(focused, { type: 'SELECT_TEXT' });
      expect(result.interaction).toBe('selecting');
    });

    it('SELECT_TEXT transitions from formatting to selecting', () => {
      const formatting = { ...initial, interaction: 'formatting' as const };
      const result = richTextReducer(formatting, { type: 'SELECT_TEXT' });
      expect(result.interaction).toBe('selecting');
    });

    it('SELECT_TEXT from idle does not change', () => {
      const result = richTextReducer(initial, { type: 'SELECT_TEXT' });
      expect(result.interaction).toBe('idle');
    });

    it('COLLAPSE_SELECTION from selecting returns to focused', () => {
      const selecting = { ...initial, interaction: 'selecting' as const };
      const result = richTextReducer(selecting, { type: 'COLLAPSE_SELECTION' });
      expect(result.interaction).toBe('focused');
    });

    it('COLLAPSE_SELECTION from formatting returns to focused', () => {
      const formatting = { ...initial, interaction: 'formatting' as const };
      const result = richTextReducer(formatting, { type: 'COLLAPSE_SELECTION' });
      expect(result.interaction).toBe('focused');
    });

    it('FORMAT_BOLD toggles bold in activeFormats', () => {
      const r1 = richTextReducer(initial, { type: 'FORMAT_BOLD' });
      expect(r1.activeFormats.has('bold')).toBe(true);
      expect(r1.interaction).toBe('formatting');
      const r2 = richTextReducer(r1, { type: 'FORMAT_BOLD' });
      expect(r2.activeFormats.has('bold')).toBe(false);
    });

    it('FORMAT_ITALIC toggles italic', () => {
      const r1 = richTextReducer(initial, { type: 'FORMAT_ITALIC' });
      expect(r1.activeFormats.has('italic')).toBe(true);
      const r2 = richTextReducer(r1, { type: 'FORMAT_ITALIC' });
      expect(r2.activeFormats.has('italic')).toBe(false);
    });

    it('FORMAT_UNDERLINE toggles underline', () => {
      const r1 = richTextReducer(initial, { type: 'FORMAT_UNDERLINE' });
      expect(r1.activeFormats.has('underline')).toBe(true);
    });

    it('FORMAT_STRIKETHROUGH toggles strikethrough', () => {
      const r1 = richTextReducer(initial, { type: 'FORMAT_STRIKETHROUGH' });
      expect(r1.activeFormats.has('strikethrough')).toBe(true);
    });

    it('FORMAT_CODE toggles code', () => {
      const r1 = richTextReducer(initial, { type: 'FORMAT_CODE' });
      expect(r1.activeFormats.has('code')).toBe(true);
    });

    it('FORMAT_LINK sets interaction to formatting without toggling formats', () => {
      const result = richTextReducer(initial, { type: 'FORMAT_LINK' });
      expect(result.interaction).toBe('formatting');
      expect(result.activeFormats.size).toBe(0);
    });

    it('FORMAT_COMPLETE from formatting returns to selecting', () => {
      const formatting = { ...initial, interaction: 'formatting' as const };
      const result = richTextReducer(formatting, { type: 'FORMAT_COMPLETE' });
      expect(result.interaction).toBe('selecting');
    });

    it('FORMAT_COMPLETE from non-formatting does not change', () => {
      const focused = { ...initial, interaction: 'focused' as const };
      const result = richTextReducer(focused, { type: 'FORMAT_COMPLETE' });
      expect(result.interaction).toBe('focused');
    });

    it('SLASH_TRIGGER shows slash command', () => {
      const result = richTextReducer(initial, { type: 'SLASH_TRIGGER' });
      expect(result.slashCommand).toBe('visible');
    });

    it('SLASH_SELECT hides slash command', () => {
      const visible = { ...initial, slashCommand: 'visible' as const };
      const result = richTextReducer(visible, { type: 'SLASH_SELECT' });
      expect(result.slashCommand).toBe('hidden');
    });

    it('SLASH_DISMISS hides slash command', () => {
      const visible = { ...initial, slashCommand: 'visible' as const };
      const result = richTextReducer(visible, { type: 'SLASH_DISMISS' });
      expect(result.slashCommand).toBe('hidden');
    });

    it('ESCAPE hides slash command', () => {
      const visible = { ...initial, slashCommand: 'visible' as const };
      const result = richTextReducer(visible, { type: 'ESCAPE' });
      expect(result.slashCommand).toBe('hidden');
    });

    it('multiple formats can be active simultaneously', () => {
      let state = richTextReducer(initial, { type: 'FORMAT_BOLD' });
      state = richTextReducer(state, { type: 'FORMAT_ITALIC' });
      state = richTextReducer(state, { type: 'FORMAT_CODE' });
      expect(state.activeFormats.has('bold')).toBe(true);
      expect(state.activeFormats.has('italic')).toBe(true);
      expect(state.activeFormats.has('code')).toBe(true);
    });

    it('does not mutate original activeFormats set', () => {
      const original = new Set(['bold']);
      const state: RichTextMachine = { ...initial, activeFormats: original };
      richTextReducer(state, { type: 'FORMAT_ITALIC' });
      expect(original.has('italic')).toBe(false);
    });
  });
});

/* ===========================================================================
 * SignaturePad
 * ========================================================================= */
describe('SignaturePad', () => {
  describe('signatureReducer', () => {
    const initial: SignatureMachine = {
      content: 'empty',
      focus: 'unfocused',
    };

    it('STROKE_START from empty transitions to drawing', () => {
      const result = signatureReducer(initial, { type: 'STROKE_START' });
      expect(result.content).toBe('drawing');
    });

    it('STROKE_START from drawn transitions to drawing', () => {
      const drawn: SignatureMachine = { content: 'drawn', focus: 'unfocused' };
      const result = signatureReducer(drawn, { type: 'STROKE_START' });
      expect(result.content).toBe('drawing');
    });

    it('STROKE_START from drawing stays in drawing', () => {
      const drawing: SignatureMachine = { content: 'drawing', focus: 'unfocused' };
      const result = signatureReducer(drawing, { type: 'STROKE_START' });
      expect(result.content).toBe('drawing');
    });

    it('STROKE_END from drawing transitions to drawn', () => {
      const drawing: SignatureMachine = { content: 'drawing', focus: 'unfocused' };
      const result = signatureReducer(drawing, { type: 'STROKE_END' });
      expect(result.content).toBe('drawn');
    });

    it('STROKE_END from empty stays in empty', () => {
      const result = signatureReducer(initial, { type: 'STROKE_END' });
      expect(result.content).toBe('empty');
    });

    it('STROKE_END from drawn stays in drawn', () => {
      const drawn: SignatureMachine = { content: 'drawn', focus: 'unfocused' };
      const result = signatureReducer(drawn, { type: 'STROKE_END' });
      expect(result.content).toBe('drawn');
    });

    it('CLEAR resets to empty', () => {
      const drawn: SignatureMachine = { content: 'drawn', focus: 'focused' };
      const result = signatureReducer(drawn, { type: 'CLEAR' });
      expect(result.content).toBe('empty');
    });

    it('CLEAR from drawing resets to empty', () => {
      const drawing: SignatureMachine = { content: 'drawing', focus: 'focused' };
      const result = signatureReducer(drawing, { type: 'CLEAR' });
      expect(result.content).toBe('empty');
    });

    it('FOCUS sets focus to focused', () => {
      const result = signatureReducer(initial, { type: 'FOCUS' });
      expect(result.focus).toBe('focused');
    });

    it('BLUR sets focus to unfocused', () => {
      const focused: SignatureMachine = { content: 'empty', focus: 'focused' };
      const result = signatureReducer(focused, { type: 'BLUR' });
      expect(result.focus).toBe('unfocused');
    });

    it('full lifecycle: empty -> drawing -> drawn -> drawing -> drawn -> clear -> empty', () => {
      let s = signatureReducer(initial, { type: 'STROKE_START' });
      expect(s.content).toBe('drawing');
      s = signatureReducer(s, { type: 'STROKE_END' });
      expect(s.content).toBe('drawn');
      s = signatureReducer(s, { type: 'STROKE_START' });
      expect(s.content).toBe('drawing');
      s = signatureReducer(s, { type: 'STROKE_END' });
      expect(s.content).toBe('drawn');
      s = signatureReducer(s, { type: 'CLEAR' });
      expect(s.content).toBe('empty');
    });
  });
});

/* ===========================================================================
 * TreeSelect
 * ========================================================================= */
describe('TreeSelect', () => {
  const sampleTree: TreeNode[] = [
    {
      id: 'root1',
      label: 'Root 1',
      children: [
        {
          id: 'child1',
          label: 'Child 1',
          children: [
            { id: 'grandchild1', label: 'Grandchild 1' },
            { id: 'grandchild2', label: 'Grandchild 2' },
          ],
        },
        { id: 'child2', label: 'Child 2' },
      ],
    },
    { id: 'root2', label: 'Root 2' },
  ];

  describe('getAllDescendantIds', () => {
    it('returns empty array for leaf node', () => {
      expect(getAllDescendantIds({ id: 'leaf', label: 'Leaf' })).toEqual([]);
    });

    it('returns empty array for node with empty children', () => {
      expect(getAllDescendantIds({ id: 'node', label: 'Node', children: [] })).toEqual([]);
    });

    it('returns all nested descendant ids', () => {
      const ids = getAllDescendantIds(sampleTree[0]);
      expect(ids).toContain('child1');
      expect(ids).toContain('child2');
      expect(ids).toContain('grandchild1');
      expect(ids).toContain('grandchild2');
      expect(ids).toHaveLength(4);
    });

    it('returns direct children for flat node', () => {
      const node: TreeNode = {
        id: 'parent',
        label: 'Parent',
        children: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      };
      expect(getAllDescendantIds(node)).toEqual(['a', 'b']);
    });
  });

  describe('findNode', () => {
    it('finds root-level node', () => {
      const node = findNode(sampleTree, 'root1');
      expect(node).not.toBeNull();
      expect(node!.label).toBe('Root 1');
    });

    it('finds deeply nested node', () => {
      const node = findNode(sampleTree, 'grandchild2');
      expect(node).not.toBeNull();
      expect(node!.label).toBe('Grandchild 2');
    });

    it('returns null for non-existent id', () => {
      expect(findNode(sampleTree, 'nonexistent')).toBeNull();
    });

    it('returns null for empty tree', () => {
      expect(findNode([], 'anything')).toBeNull();
    });
  });

  describe('treeReducer', () => {
    const initial: TreeMachine = {
      expandedIds: new Set(),
      checkedIds: new Set(),
      focusedId: null,
    };

    it('TOGGLE adds itemId to expandedIds', () => {
      const result = treeReducer(initial, { type: 'TOGGLE', itemId: 'root1' });
      expect(result.expandedIds.has('root1')).toBe(true);
    });

    it('TOGGLE removes itemId from expandedIds if already present', () => {
      const expanded: TreeMachine = { ...initial, expandedIds: new Set(['root1']) };
      const result = treeReducer(expanded, { type: 'TOGGLE', itemId: 'root1' });
      expect(result.expandedIds.has('root1')).toBe(false);
    });

    it('EXPAND adds to expandedIds', () => {
      const result = treeReducer(initial, { type: 'EXPAND', itemId: 'child1' });
      expect(result.expandedIds.has('child1')).toBe(true);
    });

    it('EXPAND does not duplicate', () => {
      const expanded: TreeMachine = { ...initial, expandedIds: new Set(['child1']) };
      const result = treeReducer(expanded, { type: 'EXPAND', itemId: 'child1' });
      expect(result.expandedIds.size).toBe(1);
    });

    it('COLLAPSE removes from expandedIds', () => {
      const expanded: TreeMachine = { ...initial, expandedIds: new Set(['root1', 'child1']) };
      const result = treeReducer(expanded, { type: 'COLLAPSE', itemId: 'root1' });
      expect(result.expandedIds.has('root1')).toBe(false);
      expect(result.expandedIds.has('child1')).toBe(true);
    });

    it('COLLAPSE for non-expanded does nothing', () => {
      const result = treeReducer(initial, { type: 'COLLAPSE', itemId: 'root1' });
      expect(result.expandedIds.size).toBe(0);
    });

    it('CHECK adds to checkedIds', () => {
      const result = treeReducer(initial, { type: 'CHECK', itemId: 'child1' });
      expect(result.checkedIds.has('child1')).toBe(true);
    });

    it('UNCHECK removes from checkedIds', () => {
      const checked: TreeMachine = { ...initial, checkedIds: new Set(['child1']) };
      const result = treeReducer(checked, { type: 'UNCHECK', itemId: 'child1' });
      expect(result.checkedIds.has('child1')).toBe(false);
    });

    it('TOGGLE_CHECK adds if not present', () => {
      const result = treeReducer(initial, { type: 'TOGGLE_CHECK', itemId: 'root2' });
      expect(result.checkedIds.has('root2')).toBe(true);
    });

    it('TOGGLE_CHECK removes if present', () => {
      const checked: TreeMachine = { ...initial, checkedIds: new Set(['root2']) };
      const result = treeReducer(checked, { type: 'TOGGLE_CHECK', itemId: 'root2' });
      expect(result.checkedIds.has('root2')).toBe(false);
    });

    it('FOCUS_ITEM sets focusedId', () => {
      const result = treeReducer(initial, { type: 'FOCUS_ITEM', itemId: 'child2' });
      expect(result.focusedId).toBe('child2');
    });

    it('BLUR does not change focusedId', () => {
      const focused: TreeMachine = { ...initial, focusedId: 'root1' };
      const result = treeReducer(focused, { type: 'BLUR' });
      expect(result.focusedId).toBe('root1');
    });

    it('EXPAND_ALL_SIBLINGS does not change state (handled by component)', () => {
      const result = treeReducer(initial, { type: 'EXPAND_ALL_SIBLINGS', itemId: 'root1' });
      expect(result.expandedIds.size).toBe(0);
    });

    it('does not mutate original expandedIds set', () => {
      const original = new Set(['root1']);
      const state: TreeMachine = { ...initial, expandedIds: original };
      treeReducer(state, { type: 'EXPAND', itemId: 'child1' });
      expect(original.has('child1')).toBe(false);
    });

    it('does not mutate original checkedIds set', () => {
      const original = new Set<string>();
      const state: TreeMachine = { ...initial, checkedIds: original };
      treeReducer(state, { type: 'CHECK', itemId: 'root1' });
      expect(original.has('root1')).toBe(false);
    });

    it('multiple operations produce correct cumulative state', () => {
      let s = treeReducer(initial, { type: 'EXPAND', itemId: 'root1' });
      s = treeReducer(s, { type: 'EXPAND', itemId: 'child1' });
      s = treeReducer(s, { type: 'CHECK', itemId: 'grandchild1' });
      s = treeReducer(s, { type: 'CHECK', itemId: 'grandchild2' });
      s = treeReducer(s, { type: 'FOCUS_ITEM', itemId: 'grandchild1' });

      expect(s.expandedIds.has('root1')).toBe(true);
      expect(s.expandedIds.has('child1')).toBe(true);
      expect(s.checkedIds.has('grandchild1')).toBe(true);
      expect(s.checkedIds.has('grandchild2')).toBe(true);
      expect(s.focusedId).toBe('grandchild1');
    });
  });
});
