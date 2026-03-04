// ============================================================
// DatePicker -- Vue 3 Component
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

export interface DatePickerProps {
  /** Selected date. */
  value?: Date | null;
  /** Default (uncontrolled) date. */
  defaultValue?: Date | null;
  /** Minimum selectable date. */
  min?: Date | null;
  /** Maximum selectable date. */
  max?: Date | null;
  /** Date format string. */
  format?: string;
  /** Locale code. */
  locale?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only state. */
  readOnly?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Form field name. */
  name?: string;
  /** Close calendar on date selection. */
  closeOnSelect?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when value changes. */
  onChange?: (date: Date | null) => void;
}

export const DatePicker = defineComponent({
  name: 'DatePicker',

  props: {
    value: { type: null as unknown as PropType<any> },
    defaultValue: { type: null as unknown as PropType<any>, default: null },
    min: { type: null as unknown as PropType<any> },
    max: { type: null as unknown as PropType<any> },
    format: { type: String, default: 'yyyy-MM-dd' },
    locale: { type: String, default: 'en' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    closeOnSelect: { type: Boolean, default: true },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const machine = ref<any>({ popover: 'closed', view: 'dayView', focus: 'idle', validation: 'valid', focusedYear: initDate.getFullYear(), focusedMonth: initDate.getMonth(), focusedDay: initDate.getDate(), });
    const send = (action: any) => { /* state machine dispatch */ };
    const anchorRef = ref<any>(null);
    const floatingRef = ref<any>(null);
    const triggerRef = ref<any>(null);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };
    const daysInMonth = getDaysInMonth(machine.value.focusedYear, machine.value.focusedMonth);
    const startDay = getStartOfWeek(machine.value.focusedYear, machine.value.focusedMonth);
    const prevMonth = machine.value.focusedMonth === 0 ? 11 : machine.value.focusedMonth - 1;
    const prevYear = machine.value.focusedMonth === 0 ? machine.value.focusedYear - 1 : machine.value.focusedYear;
    const daysInPrev = getDaysInMonth(prevYear, prevMonth);
    const nextMonth = machine.value.focusedMonth === 11 ? 0 : machine.value.focusedMonth + 1;
    const nextYear = machine.value.focusedMonth === 11 ? machine.value.focusedYear + 1 : machine.value.focusedYear;

    return (): VNode =>
      h('button', {
        'type': 'button',
        'role': 'gridcell',
        'data-part': 'cell',
        'data-state': machine.value.focusedYear === year ? 'selected' : 'default',
        'data-outside-range': i === 0 || i === 11 ? 'true' : 'false',
        'onClick': () => send({ type: 'SELECT_YEAR', year }),
      }, [
        h('span', { 'data-part': 'cell-label', 'aria-hidden': 'true' }, [
          year,
        ]),
      ]);
  },
});

export default DatePicker;