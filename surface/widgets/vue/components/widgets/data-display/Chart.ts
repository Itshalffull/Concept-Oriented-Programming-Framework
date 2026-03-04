// ============================================================
// Chart -- Vue 3 Component
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

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'donut';
  data: ChartSeries[];
  width?: string;
  height?: string;
  ariaLabel?: string;
  showLegend?: boolean;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSegmentClick?: (series: string, index: number) => void;
}

export const Chart = defineComponent({
  name: 'Chart',

  props: {
    type: { type: String as PropType<'bar' | 'line' | 'pie' | 'donut'>, required: true as const },
    data: { type: Array as PropType<any[]>, required: true as const },
    width: { type: String },
    height: { type: String },
    ariaLabel: { type: String, default: 'Chart' },
    showLegend: { type: Boolean, default: true },
    animate: { type: Boolean, default: true },
    size: { type: String, default: 'md' },
    onSegmentClick: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['segment-click'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>(chartInitialState);
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const chartContent = computed(() => {
      switch (props.type) {
        case 'bar':
          return renderBarChart(props.data, svgWidth, svgHeight);
        case 'line':
          return renderLineChart(props.data, svgWidth, svgHeight);
        case 'pie':
          return renderPieChart(props.data, svgWidth / 2, svgHeight / 2, Math.min(svgWidth, svgHeight) / 2 - 10, false);
        case 'donut':
          return renderPieChart(props.data, svgWidth / 2, svgHeight / 2, Math.min(svgWidth, svgHeight) / 2 - 10, true);
        default:
          return null;
      }
    });
    const allSeries = computed(() => props.data.map((s) => ({ name: s.name, color: s.color || '#6366f1' })));
    const svgWidth = 400;
    const svgHeight = 300;

    return (): VNode =>
      h('div', {
        'role': 'figure',
        'aria-label': props.ariaLabel,
        'aria-describedby': fallbackId,
        'data-surface-widget': '',
        'data-widget-name': 'chart',
        'data-part': 'root',
        'data-type': props.type,
        'data-state': state.value,
        'data-animate': props.animate ? 'true' : 'false',
        'data-size': props.size,
      }, [
        h('svg', {
          'role': 'img',
          'aria-label': props.ariaLabel,
          'data-part': 'chart',
          'data-type': props.type,
          'viewBox': `0 0 ${svgWidth} ${svgHeight}`,
          'style': { width: props.width || '100%', height: props.height || 'auto' },
          'aria-busy': state.value === 'loading' ? 'true' : 'false',
          'tabindex': 0,
          'onFocus': () => {
            if (props.data.length > 0 && props.data[0].data.length > 0) {
              dispatch({
                type: 'FOCUS_SEGMENT',
                series: props.data[0].name,
                index: 0,
              });
            }
          },
          'onBlur': () => dispatch({ type: 'BLUR_SEGMENT' }),
          'onKeyDown': handleChartKeyDown,
        }, [
          chartContent,
        ]),
        props.showLegend && allSeries.length > 0 ? h('div', {
            'role': 'list',
            'aria-label': 'Chart legend',
            'data-part': 'legend',
            'data-visible': 'true',
          }, [
            ...allSeries.map((series) => h('div', {
                'role': 'listitem',
                'props': true,
                'data-part': 'legend-item',
                'props': true,
                'data-series': series.name,
                'onMouseEnter': () =>
                  dispatch({
                    type: 'HOVER_SEGMENT',
                    series: series.name,
                    index: 0,
                  }),
                'onMouseLeave': () => dispatch({ type: 'UNHOVER_SEGMENT' }),
              }, [
                h('span', { 'aria-hidden': 'true', 'style': {
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    backgroundColor: series.color,
                    borderRadius: '2px',
                  } }),
                series.name,
              ])),
          ]) : null,
        h('div', { 'data-part': 'tooltip', 'data-visible': state.value === 'highlighted' ? 'true' : 'false' }),
        h('table', {
          'id': fallbackId,
          'role': 'table',
          'aria-label': `${ariaLabel} data`,
          'data-part': 'data-table-fallback',
          'data-sr-only': 'true',
          'style': {
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          },
        }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, 'Label'),
              ...props.data.map((s) => h('th', {}, [
                  s.name,
                ])),
            ]),
          ]),
          h('tbody', {}, [
            ...(props.data[0]?.data ?? []).map((point, i) => h('tr', {}, [
                h('td', {}, [
                  point.label,
                ]),
                ...props.data.map((s) => h('td', {}, [
                    s.data[i]?.value ?? '',
                  ])),
              ])),
          ]),
        ]),
        slots.default?.(),
      ]);
  },
});

export default Chart;