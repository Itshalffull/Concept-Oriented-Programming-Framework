// ============================================================
// CronEditor -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

export interface CronEditorProps {
  /** Current cron expression. */
  cronExpression?: string;
  /** Base frequency for simple mode. */
  frequency?: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  /** Hour for simple mode. */
  hour?: number;
  /** Minute for simple mode. */
  minute?: number;
  /** Selected days of week (0=Sun). */
  dayOfWeek?: number[];
  /** Day of month. */
  dayOfMonth?: number;
  /** Accessible label. */
  ariaLabel?: string;
  /** Timezone. */
  timezone?: string;
  /** Number of next runs to preview. */
  nextRunCount?: number;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Editor mode. */
  mode?: 'simple' | 'advanced';
  /** Next run dates (pre-computed). */
  nextRuns?: string[];
  /** Human-readable schedule description. */
  humanReadable?: string;
  /** Called on cron expression change. */
  onCronChange?: (expression: string) => void;
  /** Called on frequency change. */
  onFrequencyChange?: (frequency: string) => void;
  /** Called on mode change. */
  onModeChange?: (mode: 'simple' | 'advanced') => void;
  /** Frequency select slot. */
  frequencySelect?: VNode | string;
  /** Time input slot. */
  timeInput?: VNode | string;
  /** Day select slot. */
  daySelect?: VNode | string;
}

export const CronEditor = defineComponent({
  name: 'CronEditor',

  props: {
    cronExpression: { type: String, default: '0 * * * *' },
    frequency: { type: String, default: 'hourly' },
    hour: { type: Number, default: 0 },
    minute: { type: Number, default: 0 },
    dayOfWeek: { type: Array as PropType<any[]>, default: () => ([]) },
    dayOfMonth: { type: Number, default: 1 },
    ariaLabel: { type: String, default: 'Cron Editor' },
    timezone: { type: String, default: 'UTC' },
    nextRunCount: { type: Number, default: 5 },
    readOnly: { type: Boolean, default: false },
    mode: { type: String, default: 'simple' },
    nextRuns: { type: Array as PropType<any[]>, default: () => ([]) },
    humanReadable: { type: String },
    onCronChange: { type: Function as PropType<(...args: any[]) => any> },
    onFrequencyChange: { type: Function as PropType<(...args: any[]) => any> },
    onModeChange: { type: Function as PropType<(...args: any[]) => any> },
    frequencySelect: { type: null as unknown as PropType<any> },
    timeInput: { type: null as unknown as PropType<any> },
    daySelect: { type: null as unknown as PropType<any> },
  },

  emits: ['mode-change', 'frequency-change', 'cron-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ mode: props.mode, validation: 'valid', });
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'cron editor',
        'data-surface-widget': '',
        'data-widget-name': 'cron-editor',
        'data-state': state.value.mode,
        'data-mode': props.mode,
        'data-valid': isValid ? 'true' : 'false',
        'data-readonly': props.readOnly ? 'true' : 'false',
      }, [
        h('div', {
          'data-part': 'tabs',
          'data-active': props.mode,
          'role': 'tablist',
          'aria-label': 'Editor mode',
        }, [
          h('button', {
            'type': 'button',
            'role': 'tab',
            'aria-selected': isSimple,
            'onClick': () => handleModeChange('simple'),
          }, 'Simple'),
          h('button', {
            'type': 'button',
            'role': 'tab',
            'aria-selected': !isSimple,
            'onClick': () => handleModeChange('advanced'),
          }, 'Advanced'),
        ]),
        isSimple ? h('div', {
            'data-part': 'simple-editor',
            'role': 'form',
            'aria-label': 'Simple schedule editor',
            'data-visible': 'true',
          }, [
            h('div', {
              'data-part': 'frequency-select',
              'aria-label': 'Frequency',
              'data-value': props.frequency,
            }, [
              props.frequencySelect ?? h('select', {
                'value': props.frequency,
                'aria-label': 'Frequency',
                'disabled': props.readOnly,
                'onChange': (e) => props.onFrequencyChange?.(e.target.value),
              }, [
                h('option', { value: 'minutely' }, 'Every minute'),
                h('option', { value: 'hourly' }, 'Hourly'),
                h('option', { value: 'daily' }, 'Daily'),
                h('option', { value: 'weekly' }, 'Weekly'),
                h('option', { value: 'monthly' }, 'Monthly'),
              ]),
            ]),
            props.frequency !== 'minutely' ? h('div', {
                'data-part': 'time-input',
                'aria-label': 'Time of day',
                'data-hour': props.hour,
                'data-minute': props.minute,
                'data-visible': 'true',
              }, [
                props.timeInput ?? h('input', {
                  'type': 'time',
                  'value': `${String(props.hour).padStart(2, '0')}:${String(props.minute).padStart(2, '0')}`,
                  'aria-label': 'Time of day',
                  'disabled': props.readOnly,
                  'readOnly': props.readOnly,
                }),
              ]) : null,
            (props.frequency === 'weekly' || props.frequency === 'monthly') ? h('div', {
                'data-part': 'day-select',
                'aria-label': props.frequency === 'weekly' ? 'Day of week' : 'Day of month',
                'data-visible': 'true',
                'data-frequency': props.frequency,
              }, [
                props.daySelect,
              ]) : null,
          ]) : null,
        !isSimple ? h('div', {
            'data-part': 'advanced-editor',
            'role': 'form',
            'aria-label': 'Advanced cron expression editor',
            'data-visible': 'true',
          }, [
            h('input', {
              'type': 'text',
              'data-part': 'cron-input',
              'role': 'textbox',
              'aria-label': 'Cron expression',
              'aria-invalid': !isValid || undefined,
              'aria-describedby': 'cron-hint',
              'value': props.cronExpression,
              'placeholder': '* * * * *',
              'data-valid': isValid ? 'true' : 'false',
              'disabled': props.readOnly,
              'onChange': (e) => props.onCronChange?.(e.target.value),
            }),
          ]) : null,
        isValid ? [
            h('div', {
              'data-part': 'preview',
              'role': 'region',
              'aria-label': 'Schedule preview',
              'aria-live': 'polite',
              'data-visible': 'true',
              'data-timezone': props.timezone,
            }, [
              props.humanReadable ?? props.cronExpression,
            ]),
            props.nextRuns.length > 0 ? h('div', {
                'data-part': 'next-runs',
                'role': 'list',
                'aria-label': 'Next scheduled runs',
                'data-count': props.nextRunCount,
                'data-timezone': props.timezone,
                'data-visible': 'true',
              }, [
                ...props.nextRuns.map((run, i) => h('div', { 'role': 'listitem' }, [
                    run,
                  ])),
              ]) : null,
          ] : null,
        slots.default?.(),
      ]);
  },
});

export default CronEditor;