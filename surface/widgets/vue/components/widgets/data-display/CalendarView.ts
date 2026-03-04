// ============================================================
// CalendarView -- Vue 3 Component
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

export interface CalendarEvent {
  date: string;
  label: string;
  id?: string;
}

export interface CalendarViewProps {
  value: string;
  view?: 'month' | 'week';
  events?: CalendarEvent[];
  ariaLabel?: string;
  minDate?: string;
  maxDate?: string;
  todayLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onSelectDate?: (date: string) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  onViewChange?: (view: 'month' | 'week') => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Date[] = [];

  // Previous month fill
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i));
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  // Next month fill
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, cells.length - daysInMonth - startDay + 1));
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export const CalendarView = defineComponent({
  name: 'CalendarView',

  props: {
    value: { type: String, required: true as const },
    view: { type: String, default: 'month' },
    events: { type: Array as PropType<any[]>, default: () => ([]) },
    ariaLabel: { type: String, default: 'Calendar' },
    minDate: { type: String },
    maxDate: { type: String },
    todayLabel: { type: String, default: 'Today' },
    size: { type: String, default: 'md' },
    onSelectDate: { type: Function as PropType<(...args: any[]) => any> },
    onNavigate: { type: Function as PropType<(...args: any[]) => any> },
    onEventClick: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['navigate', 'select-date', 'event-click'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const initialDate = props.value ? new Date(props.value) : new Date();
    const state = ref<any>({
      current: props.view === 'month' ? 'monthView' : 'weekView',
      focusedDate: initialDate,
      displayDate: initialDate,
    });
    const dispatch = (action: any) => { /* state machine dispatch */ };

    const today = computed(() => new Date());
    const minD = props.minDate ? new Date(props.minDate) : null;
    const maxD = props.maxDate ? new Date(props.maxDate) : null;

    const weeks = computed(() =>
      getMonthGrid(
        state.value.displayDate.getFullYear(),
        state.value.displayDate.getMonth(),
      )
    );

    const periodLabel = computed(() => {
      const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
      return state.value.displayDate.toLocaleDateString(undefined, opts);
    });

    const eventsByDate = computed(() => {
      const map = new Map<string, CalendarEvent[]>();
      for (const ev of props.events) {
        const key = ev.date.split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
      }
      return map;
    });

    const handlePrev = () => {
      dispatch({ type: 'NAVIGATE_PREV' });
      props.onNavigate?.('prev');
      setTimeout(() => {
        dispatch({
          type: props.view === 'month' ? 'NAVIGATE_COMPLETE' : 'NAVIGATE_COMPLETE_WEEK',
        });
      }, 0);
    };

    const handleNext = () => {
      dispatch({ type: 'NAVIGATE_NEXT' });
      props.onNavigate?.('next');
      setTimeout(() => {
        dispatch({
          type: props.view === 'month' ? 'NAVIGATE_COMPLETE' : 'NAVIGATE_COMPLETE_WEEK',
        });
      }, 0);
    };

    const handleSelectDate = (date: Date) => {
      dispatch({ type: 'SELECT_DATE', date });
      props.onSelectDate?.(formatDate(date));
    };

    const handleDayCellKeyDown = (e: any, date: Date) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          dispatch({ type: 'NAVIGATE_DAY', offset: -1 });
          break;
        case 'ArrowRight':
          e.preventDefault();
          dispatch({ type: 'NAVIGATE_DAY', offset: 1 });
          break;
        case 'ArrowUp':
          e.preventDefault();
          dispatch({ type: 'NAVIGATE_WEEK', offset: -1 });
          break;
        case 'ArrowDown':
          e.preventDefault();
          dispatch({ type: 'NAVIGATE_WEEK', offset: 1 });
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleSelectDate(date);
          break;
        case 'PageUp':
          e.preventDefault();
          handlePrev();
          break;
        case 'PageDown':
          e.preventDefault();
          handleNext();
          break;
        case 'Home':
          e.preventDefault();
          dispatch({ type: 'NAVIGATE_DAY', offset: -date.getDay() });
          break;
        case 'End':
          e.preventDefault();
          dispatch({ type: 'NAVIGATE_DAY', offset: 6 - date.getDay() });
          break;
      }
    };

    const isNavigating = computed(() => state.value === 'navigating');

    return (): VNode =>
      h('div', {
        'role': 'application',
        'aria-roledescription': 'calendar',
        'aria-label': props.ariaLabel,
        'data-surface-widget': '',
        'data-widget-name': 'calendar-view',
        'data-part': 'root',
        'data-view': props.view,
        'data-state': isNavigating.value ? 'navigating' : 'idle',
        'data-size': props.size,
      }, [
        h('div', { 'data-part': 'header' }, [
          h('div', {
            'data-part': 'navigation',
            'role': 'group',
            'aria-label': 'Calendar navigation',
          }, [
            h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': props.view === 'month' ? 'Previous month' : 'Previous week',
              'data-part': 'prev-button',
              'tabindex': 0,
              'onClick': handlePrev,
            }, [
              '<',
            ]),
            h('span', {
              'data-part': 'title',
              'aria-live': 'polite',
              'aria-atomic': 'true',
              'role': 'heading',
            }, [
              periodLabel.value,
            ]),
            h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': props.view === 'month' ? 'Next month' : 'Next week',
              'data-part': 'next-button',
              'tabindex': 0,
              'onClick': handleNext,
            }, [
              '>',
            ]),
          ]),
        ]),
        h('table', {
          'role': 'grid',
          'aria-label': periodLabel.value,
          'data-view': props.view,
          'aria-busy': isNavigating.value ? 'true' : 'false',
        }, [
          h('thead', {}, [
            h('tr', {}, [
              ...DAY_NAMES.map((day) => h('th', {
                'scope': 'col',
                'abbr': day,
              }, [
                day,
              ])),
            ]),
          ]),
          h('tbody', {}, [
            ...weeks.value.map((week, weekIndex) => h('tr', {
              'role': 'row',
              'data-part': 'week-row',
            }, [
              ...week.map((date) => {
                const dateStr = formatDate(date);
                const isToday = isSameDay(date, today.value);
                const isSelected = isSameDay(date, state.value.focusedDate);
                const isOutsideMonth = date.getMonth() !== state.value.displayDate.getMonth();
                const isDisabled =
                  (minD && date < minD) || (maxD && date > maxD) || false;
                const dayEvents = eventsByDate.value.get(dateStr) || [];
                const isFocused = isSameDay(date, state.value.focusedDate);

                return h('td', {
                  'role': 'gridcell',
                  'aria-selected': isSelected ? 'true' : 'false',
                  'aria-disabled': isDisabled ? 'true' : 'false',
                  'aria-label': date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                  'tabindex': isFocused ? 0 : -1,
                  'data-today': isToday ? 'true' : 'false',
                  'data-selected': isSelected ? 'true' : 'false',
                  'data-outside': isOutsideMonth ? 'true' : 'false',
                  'data-disabled': isDisabled ? 'true' : 'false',
                  'data-has-events': dayEvents.length > 0 ? 'true' : 'false',
                  'onClick': () => {
                    if (!isDisabled) handleSelectDate(date);
                  },
                  'onFocus': () => dispatch({ type: 'FOCUS_DATE', date }),
                  'onKeyDown': (e: any) => handleDayCellKeyDown(e, date),
                }, [
                  h('span', { 'data-part': 'day-label', 'aria-hidden': 'true' }, [
                    date.getDate(),
                  ]),
                  isToday ? h('span', {}, [
                    props.todayLabel,
                  ]) : null,
                  dayEvents.length > 0 ? h('div', {
                    'data-part': 'event-list',
                    'role': 'list',
                    'aria-label': `Events on ${date.toLocaleDateString()}`,
                  }, [
                    ...dayEvents.map((ev, evIdx) => h('button', {
                      'type': 'button',
                      'role': 'button',
                      'aria-label': ev.label,
                      'data-part': 'event',
                      'tabindex': 0,
                      'onClick': (e: any) => {
                        e.stopPropagation();
                        props.onEventClick?.(ev);
                      },
                    }, [
                      ev.label,
                    ])),
                  ]) : null,
                ]);
              }),
            ])),
          ]),
        ]),
        slots.default?.(),
      ]);
  },
});

export default CalendarView;
