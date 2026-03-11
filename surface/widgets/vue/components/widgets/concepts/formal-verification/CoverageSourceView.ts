import { defineComponent, h, ref, computed, watch } from 'vue';

/* ---------------------------------------------------------------------------
 * CoverageSourceView state machine
 * ------------------------------------------------------------------------- */

export type CoverageSourceViewState = 'idle' | 'lineHovered';
export type CoverageSourceViewEvent =
  | { type: 'HOVER_LINE'; lineIndex: number }
  | { type: 'FILTER'; status: CoverageFilter }
  | { type: 'JUMP_UNCOVERED' }
  | { type: 'LEAVE' }
  | { type: 'SELECT_LINE'; lineIndex: number }
  | { type: 'NAVIGATE'; direction: 'up' | 'down' };

export function coverageSourceViewReducer(state: CoverageSourceViewState, event: CoverageSourceViewEvent): CoverageSourceViewState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_LINE') return 'lineHovered';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'JUMP_UNCOVERED') return 'idle';
      return state;
    case 'lineHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type CoverageStatus = 'covered' | 'uncovered' | 'partial' | null;
export type CoverageFilter = 'all' | 'covered' | 'uncovered' | 'partial';

export interface CoverageLine {
  number: number;
  text: string;
  coverage: CoverageStatus;
  coveredBy?: string;
}

export interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  percentage: number;
}

/* ---------------------------------------------------------------------------
 * Style constants
 * ------------------------------------------------------------------------- */

const GUTTER_COLORS: Record<string, string> = {
  covered: '#22c55e', uncovered: '#ef4444', partial: '#eab308',
};

const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const CoverageSourceView = defineComponent({
  name: 'CoverageSourceView',
  props: {
    lines: { type: Array as () => CoverageLine[], required: true },
    summary: { type: Object as () => CoverageSummary, required: true },
    language: { type: String, default: 'typescript' },
    showLineNumbers: { type: Boolean, default: true },
    filterStatus: { type: String as () => CoverageFilter, default: 'all' },
  },
  emits: ['lineSelect', 'filterChange'],
  setup(props, { emit }) {
    const state = ref<CoverageSourceViewState>('idle');
    const send = (event: CoverageSourceViewEvent) => { state.value = coverageSourceViewReducer(state.value, event); };

    const selectedLineIndex = ref<number | null>(null);
    const focusedLineIndex = ref(0);
    const hoveredLineIndex = ref<number | null>(null);
    const activeFilter = ref<CoverageFilter>(props.filterStatus);

    watch(() => props.filterStatus, (val) => { activeFilter.value = val; });

    const filteredLines = computed(() => {
      if (activeFilter.value === 'all') return props.lines;
      return props.lines.filter((l) => l.coverage === activeFilter.value);
    });

    const handleFilterChange = (filter: CoverageFilter) => {
      activeFilter.value = filter;
      focusedLineIndex.value = 0;
      selectedLineIndex.value = null;
      send({ type: 'FILTER', status: filter });
      emit('filterChange', filter);
    };

    const handleLineSelect = (index: number) => {
      selectedLineIndex.value = index;
      const line = filteredLines.value[index];
      if (line) emit('lineSelect', line);
    };

    const jumpToNextUncovered = () => {
      const startIdx = focusedLineIndex.value + 1;
      for (let i = 0; i < filteredLines.value.length; i++) {
        const idx = (startIdx + i) % filteredLines.value.length;
        if (filteredLines.value[idx].coverage === 'uncovered') {
          focusedLineIndex.value = idx;
          send({ type: 'JUMP_UNCOVERED' });
          return;
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        jumpToNextUncovered();
        return;
      }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const filterBar = (e.currentTarget as HTMLElement).querySelector('[data-part="filter-bar"] button');
        if (filterBar instanceof HTMLElement) filterBar.focus();
        return;
      }
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          focusedLineIndex.value = Math.max(0, focusedLineIndex.value - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          focusedLineIndex.value = Math.min(filteredLines.value.length - 1, focusedLineIndex.value + 1);
          break;
        case 'Enter':
          e.preventDefault();
          handleLineSelect(focusedLineIndex.value);
          break;
      }
    };

    const handleLineHover = (index: number) => {
      hoveredLineIndex.value = index;
      send({ type: 'HOVER_LINE', lineIndex: index });
    };

    const handleLineLeave = () => {
      hoveredLineIndex.value = null;
      send({ type: 'LEAVE' });
    };

    const hoveredLine = computed(() => hoveredLineIndex.value !== null ? filteredLines.value[hoveredLineIndex.value] : null);

    return () => h('div', {
      role: 'document', 'aria-label': 'Coverage source view',
      'data-surface-widget': '', 'data-widget-name': 'coverage-source-view',
      'data-part': 'root', 'data-state': state.value,
      tabindex: 0, onKeydown: handleKeyDown,
    }, [
      // Summary header
      h('div', {
        'data-part': 'summary', 'data-state': state.value, role: 'status', 'aria-live': 'polite',
        style: { padding: '8px 12px', fontFamily: 'system-ui, sans-serif', fontSize: '14px', fontWeight: '600', borderBottom: '1px solid #e5e7eb' },
      }, `Coverage: ${props.summary.percentage}% (${props.summary.coveredLines}/${props.summary.totalLines} lines)`),
      // Filter bar
      h('div', {
        'data-part': 'filter-bar', 'data-state': state.value,
        style: { display: 'flex', gap: '4px', padding: '6px 12px', borderBottom: '1px solid #e5e7eb' },
      }, FILTER_OPTIONS.map((filter) =>
        h('button', {
          key: filter, type: 'button',
          'data-active': activeFilter.value === filter ? 'true' : 'false',
          'aria-pressed': activeFilter.value === filter,
          onClick: () => handleFilterChange(filter),
          style: {
            padding: '2px 10px', fontSize: '12px', border: '1px solid #d1d5db',
            borderRadius: '4px', cursor: 'pointer',
            background: activeFilter.value === filter ? '#e0e7ff' : 'transparent',
            fontWeight: activeFilter.value === filter ? '600' : '400',
          },
        }, filter.charAt(0).toUpperCase() + filter.slice(1)),
      )),
      // Scrollable code area
      h('div', {
        role: 'code',
        style: {
          overflow: 'auto',
          fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
          fontSize: '13px', lineHeight: '20px', position: 'relative',
        },
      }, filteredLines.value.map((line, index) => {
        const isSelected = selectedLineIndex.value === index;
        const isFocused = focusedLineIndex.value === index;
        const isHovered = hoveredLineIndex.value === index;

        return h('div', {
          key: line.number, role: 'row',
          'aria-selected': isSelected,
          'aria-current': isFocused ? 'true' : undefined,
          'data-line-number': line.number,
          'data-coverage': line.coverage ?? 'none',
          onClick: () => handleLineSelect(index),
          onMouseenter: () => handleLineHover(index),
          onMouseleave: handleLineLeave,
          style: {
            display: 'flex', alignItems: 'stretch',
            background: isSelected ? '#dbeafe' : isFocused ? '#f1f5f9' : isHovered ? '#f8fafc' : 'transparent',
            cursor: 'pointer',
            outline: isFocused ? '2px solid #6366f1' : 'none',
            outlineOffset: '-2px',
          },
        }, [
          // Coverage gutter
          h('div', {
            'data-part': 'coverage-gutter', 'data-state': state.value, role: 'presentation',
            style: { width: '4px', flexShrink: '0', background: line.coverage ? (GUTTER_COLORS[line.coverage] ?? 'transparent') : 'transparent' },
            'aria-hidden': 'true',
          }),
          // Line number
          props.showLineNumbers
            ? h('div', {
                'data-part': 'line-numbers', 'data-state': state.value, 'data-visible': 'true',
                role: 'rowheader', 'aria-label': `Line ${line.number}`,
                style: { width: '48px', flexShrink: '0', textAlign: 'right', paddingRight: '12px', color: '#9ca3af', userSelect: 'none' },
              }, line.number)
            : null,
          // Source text
          h('div', {
            'data-part': 'source-text', 'data-state': state.value, 'data-language': props.language,
            style: { flex: '1', whiteSpace: 'pre', paddingRight: '12px', overflow: 'hidden', textOverflow: 'ellipsis' },
          }, line.text),
        ]);
      })),
      // Hover tooltip
      state.value === 'lineHovered' && hoveredLine.value && hoveredLine.value.coveredBy
        ? h('div', {
            'data-part': 'tooltip', 'data-state': state.value, 'data-visible': 'true', role: 'tooltip',
            style: { position: 'absolute', padding: '4px 8px', fontSize: '12px', background: '#1f2937', color: '#f9fafb', borderRadius: '4px', pointerEvents: 'none', zIndex: '10', whiteSpace: 'nowrap' },
          }, `Covered by: ${hoveredLine.value.coveredBy}`)
        : null,
      // Selected line details
      selectedLineIndex.value !== null && filteredLines.value[selectedLineIndex.value]
        ? h('div', {
            'data-part': 'line-detail', 'data-state': state.value,
            style: { padding: '8px 12px', borderTop: '1px solid #e5e7eb', fontSize: '13px', fontFamily: 'system-ui, sans-serif' },
          }, [
            h('strong', null, `Line ${filteredLines.value[selectedLineIndex.value].number}`),
            ' \u2014 ',
            filteredLines.value[selectedLineIndex.value].coverage
              ? filteredLines.value[selectedLineIndex.value].coverage!.charAt(0).toUpperCase() + filteredLines.value[selectedLineIndex.value].coverage!.slice(1)
              : 'Not executable',
            filteredLines.value[selectedLineIndex.value].coveredBy
              ? h('span', null, ` (covered by: ${filteredLines.value[selectedLineIndex.value].coveredBy})`)
              : null,
          ])
        : null,
    ]);
  },
});

export default CoverageSourceView;
