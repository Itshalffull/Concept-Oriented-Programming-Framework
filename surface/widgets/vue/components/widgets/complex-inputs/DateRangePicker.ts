// ============================================================
// DateRangePicker -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  computed,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

/* ---------------------------------------------------------------------------
 * Date helpers
 * ------------------------------------------------------------------------- */

function formatDate(date: Date | null, format: string): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return format.replace('yyyy', String(y)).replace('MM', m).replace('dd', d);
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  return date >= start && date <= end;
}

function isDayToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function getStartOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function buildMonth(year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartOfWeek(year, month);
  const cells: Array<{ day: number; date: Date; outsideMonth: boolean }> = [];

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrev = getDaysInMonth(prevYear, prevMonth);
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({ day: d, date: new Date(prevYear, prevMonth, d), outsideMonth: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(year, month, d), outsideMonth: false });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, date: new Date(nextYear, nextMonth, nextDay), outsideMonth: true });
    nextDay++;
  }

  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface DateRangePreset {
  label: string;
  range: { start: Date; end: Date };
}

export interface DateRangePickerProps {
  /** Selected start date. */
  startDate?: Date | null;
  /** Default start date (uncontrolled). */
  defaultStartDate?: Date | null;
  /** Selected end date. */
  endDate?: Date | null;
  /** Default end date (uncontrolled). */
  defaultEndDate?: Date | null;
  /** Minimum selectable date. */
  min?: Date | null;
  /** Maximum selectable date. */
  max?: Date | null;
  /** Date format string. */
  format?: string;
  /** Locale code. */
  locale?: string;
  /** Preset ranges. */
  presets?: DateRangePreset[];
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only state. */
  readOnly?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Form field name. */
  name?: string;
  /** Close on complete selection. */
  closeOnSelect?: boolean;
  /** Accessible label. */
  label?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when range changes. */
  onChange?: (range: { start: Date | null; end: Date | null }) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const DateRangePicker = defineComponent({
  name: 'DateRangePicker',

  props: {
    startDate: { type: null as unknown as PropType<any> },
    defaultStartDate: { type: null as unknown as PropType<any>, default: null },
    endDate: { type: null as unknown as PropType<any> },
    defaultEndDate: { type: null as unknown as PropType<any>, default: null },
    min: { type: null as unknown as PropType<any> },
    max: { type: null as unknown as PropType<any> },
    format: { type: String, default: 'yyyy-MM-dd' },
    locale: { type: String, default: 'en' },
    presets: { type: Array as PropType<any[]> },
    disabled: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    closeOnSelect: { type: Boolean, default: true },
    label: { type: String, default: 'Date range' },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();

    // Controllable start date
    const startDateInternal = ref<any>(undefined);
    const startDate = computed(() =>
      props.startDate !== undefined ? props.startDate : startDateInternal.value ?? props.defaultStartDate
    );
    const setStartDate = (v: any) => { startDateInternal.value = v; };

    // Controllable end date
    const endDateInternal = ref<any>(undefined);
    const endDate = computed(() =>
      props.endDate !== undefined ? props.endDate : endDateInternal.value ?? props.defaultEndDate
    );
    const setEndDate = (v: any) => { endDateInternal.value = v; };

    const now = new Date();
    const machine = ref<any>({
      popover: 'closed',
      selection: 'selectingStart',
      hover: 'idle',
      focus: 'unfocused',
      focusedYear: (startDate.value ?? now).getFullYear(),
      focusedMonth: (startDate.value ?? now).getMonth(),
      focusedDay: (startDate.value ?? now).getDate(),
      hoverDate: null,
    });
    const send = (action: any) => { /* state machine dispatch */ };

    const anchorRef = ref<any>(null);
    const floatingRef = ref<any>(null);
    const triggerRef = ref<any>(null);

    const handleCellClick = (date: Date) => {
      if (props.min && date < props.min) return;
      if (props.max && date > props.max) return;

      if (machine.value.selection === 'selectingStart') {
        setStartDate(date);
        setEndDate(null);
        send({ type: 'SELECT_CELL', date });
      } else {
        if (startDate.value && date < startDate.value) {
          setStartDate(date);
          setEndDate(startDate.value);
        } else {
          setEndDate(date);
        }
        send({ type: 'SELECT_CELL', date });
        if (props.closeOnSelect) {
          send({ type: 'CONFIRM' });
          triggerRef.value?.focus();
        }
      }
    };

    const handlePresetClick = (range: { start: Date; end: Date }) => {
      setStartDate(range.start);
      setEndDate(range.end);
      send({ type: 'SELECT_PRESET', range });
      if (props.closeOnSelect) {
        send({ type: 'CONFIRM' });
        triggerRef.value?.focus();
      }
    };

    const handleCellKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); send({ type: 'NAVIGATE_UP' }); break;
        case 'ArrowDown': e.preventDefault(); send({ type: 'NAVIGATE_DOWN' }); break;
        case 'ArrowLeft': e.preventDefault(); send({ type: 'NAVIGATE_PREV' }); break;
        case 'ArrowRight': e.preventDefault(); send({ type: 'NAVIGATE_NEXT' }); break;
        case 'PageUp': e.preventDefault(); send({ type: 'PREV_MONTH' }); break;
        case 'PageDown': e.preventDefault(); send({ type: 'NEXT_MONTH' }); break;
        case 'Escape': e.preventDefault(); send({ type: 'ESCAPE' }); triggerRef.value?.focus(); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleCellClick(new Date(machine.value.focusedYear, machine.value.focusedMonth, machine.value.focusedDay));
          break;
      }
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const secondMonth = computed(() => machine.value.focusedMonth === 11 ? 0 : machine.value.focusedMonth + 1);
    const secondYear = computed(() => machine.value.focusedMonth === 11 ? machine.value.focusedYear + 1 : machine.value.focusedYear);

    const gridStart = computed(() => buildMonth(machine.value.focusedYear, machine.value.focusedMonth));
    const gridEnd = computed(() => buildMonth(secondYear.value, secondMonth.value));

    const isOpen = computed(() => machine.value.popover === 'open');
    const startMonthLabel = computed(() => `${monthNames[machine.value.focusedMonth]} ${machine.value.focusedYear}`);
    const endMonthLabel = computed(() => `${monthNames[secondMonth.value]} ${secondYear.value}`);

    const renderCell = (cell: { day: number; date: Date; outsideMonth: boolean }): VNode => {
      const outOfRange = (props.min && cell.date < props.min) || (props.max && cell.date > props.max);
      const isRangeStart = isSameDay(cell.date, startDate.value);
      const isRangeEnd = isSameDay(cell.date, endDate.value);
      const inRange = isInRange(cell.date, startDate.value, endDate.value);
      const inPreview = machine.value.selection === 'selectingEnd' && startDate.value && machine.value.hoverDate
        ? isInRange(cell.date, startDate.value, machine.value.hoverDate)
        : false;
      const isFocusedCell = !cell.outsideMonth && cell.day === machine.value.focusedDay;
      const cellState = isRangeStart ? 'range-start' : isRangeEnd ? 'range-end' : inRange ? 'in-range' : 'default';

      return h('td', {
        'role': 'gridcell',
        'aria-selected': isRangeStart || isRangeEnd ? 'true' : 'false',
        'aria-disabled': outOfRange ? 'true' : 'false',
        'data-part': 'cell',
        'data-state': cellState,
        'data-today': isDayToday(cell.date) ? 'true' : 'false',
        'data-outside-range': outOfRange ? 'true' : 'false',
        'data-outside-month': cell.outsideMonth ? 'true' : 'false',
        'data-preview': inPreview ? 'true' : 'false',
        'tabindex': isFocusedCell ? 0 : -1,
        'onClick': () => !outOfRange && handleCellClick(cell.date),
        'onMouseenter': () => send({ type: 'HOVER_CELL', date: cell.date }),
        'onMouseleave': () => send({ type: 'HOVER_OUT' }),
        'onKeyDown': handleCellKeyDown,
      }, [
        h('span', { 'data-part': 'cell-label', 'aria-hidden': 'true' }, [cell.day]),
      ]);
    };

    const renderGrid = (rows: ReturnType<typeof buildMonth>, gridLabel: string, partName: string): VNode =>
      h('table', { 'role': 'grid', 'aria-label': gridLabel, 'data-part': partName }, [
        h('thead', {}, [
          h('tr', { 'role': 'row', 'data-part': 'row' }, [
            ...['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) =>
              h('th', { 'scope': 'col' }, [d])
            ),
          ]),
        ]),
        h('tbody', {}, [
          ...rows.map((row, ri) =>
            h('tr', { 'role': 'row', 'data-part': 'row' }, [
              ...row.map(renderCell),
            ])
          ),
        ]),
      ]);

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': props.label,
        'data-part': 'root',
        'data-state': isOpen.value ? 'open' : 'closed',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-readonly': props.readOnly ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'date-range-picker',
      }, [
        h('div', { 'data-part': 'input-group' }, [
          h('input', {
            'data-part': 'start-input',
            'data-selecting': machine.value.selection === 'selectingStart' ? 'true' : 'false',
            'value': formatDate(startDate.value, props.format),
            'placeholder': 'Start date',
            'disabled': props.disabled,
            'readOnly': props.readOnly,
            'aria-label': 'Start date',
            'aria-haspopup': 'dialog',
            'aria-expanded': isOpen.value ? 'true' : 'false',
            'onFocus': () => send({ type: 'FOCUS' }),
            'onBlur': () => send({ type: 'BLUR' }),
            'onKeyDown': (e: any) => { if (e.key === 'ArrowDown') { e.preventDefault(); send({ type: 'OPEN' }); } },
          }),
          h('input', {
            'data-part': 'end-input',
            'data-selecting': machine.value.selection === 'selectingEnd' ? 'true' : 'false',
            'value': formatDate(endDate.value, props.format),
            'placeholder': 'End date',
            'disabled': props.disabled,
            'readOnly': props.readOnly,
            'aria-label': 'End date',
            'aria-haspopup': 'dialog',
            'aria-expanded': isOpen.value ? 'true' : 'false',
            'onFocus': () => send({ type: 'FOCUS' }),
            'onBlur': () => send({ type: 'BLUR' }),
            'onKeyDown': (e: any) => { if (e.key === 'ArrowDown') { e.preventDefault(); send({ type: 'OPEN' }); } },
          }),
          h('button', {
            'type': 'button',
            'data-part': 'trigger',
            'aria-label': 'Open date range calendar',
            'aria-haspopup': 'dialog',
            'aria-expanded': isOpen.value ? 'true' : 'false',
            'disabled': props.disabled,
            'tabindex': -1,
            'onClick': () => send({ type: 'TRIGGER_CLICK' }),
          }, [
            '\u{1F4C5}',
          ]),
        ]),
        props.name ? h('div', {}, [
          h('input', { 'type': 'hidden', 'name': `${props.name}-start`, 'value': formatDate(startDate.value, props.format) }),
          h('input', { 'type': 'hidden', 'name': `${props.name}-end`, 'value': formatDate(endDate.value, props.format) }),
        ]) : null,
        isOpen.value ? h('div', {
          'data-part': 'positioner',
          'data-state': 'open',
          'data-placement': 'bottom-start',
        }, [
          h('div', {
            'id': uid,
            'role': 'dialog',
            'aria-modal': 'true',
            'aria-label': 'Date range calendar',
            'data-part': 'content',
            'data-state': 'open',
          }, [
            h('div', { 'data-part': 'header' }, [
              h('button', {
                'type': 'button',
                'data-part': 'prev-button',
                'aria-label': 'Previous month',
                'onClick': () => send({ type: 'PREV_MONTH' }),
              }, [
                '\u2039',
              ]),
              h('span', { 'data-part': 'title-start', 'aria-live': 'polite' }, [
                startMonthLabel.value,
              ]),
              h('span', { 'data-part': 'title-end', 'aria-live': 'polite' }, [
                endMonthLabel.value,
              ]),
              h('button', {
                'type': 'button',
                'data-part': 'next-button',
                'aria-label': 'Next month',
                'onClick': () => send({ type: 'NEXT_MONTH' }),
              }, [
                '\u203A',
              ]),
            ]),
            h('div', { 'data-part': 'calendars' }, [
              renderGrid(gridStart.value, startMonthLabel.value, 'grid-start'),
              renderGrid(gridEnd.value, endMonthLabel.value, 'grid-end'),
            ]),
            props.presets && props.presets.length > 0 ? h('div', {
              'role': 'listbox',
              'aria-label': 'Preset date ranges',
              'data-part': 'presets',
            }, [
              ...props.presets.map((preset, i) => {
                const active = startDate.value && endDate.value
                  && isSameDay(startDate.value, preset.range.start)
                  && isSameDay(endDate.value, preset.range.end);
                return h('button', {
                  'type': 'button',
                  'role': 'option',
                  'aria-selected': active ? 'true' : 'false',
                  'data-part': 'preset',
                  'data-active': active ? 'true' : 'false',
                  'tabindex': 0,
                  'onClick': () => handlePresetClick(preset.range),
                  'onKeyDown': (e: any) => { if (e.key === 'Enter') handlePresetClick(preset.range); },
                }, [
                  preset.label,
                ]);
              }),
            ]) : null,
          ]),
        ]) : null,
      ]);
  },
});

export default DateRangePicker;
