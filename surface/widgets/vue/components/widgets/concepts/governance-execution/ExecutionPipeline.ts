import { defineComponent, h, ref, computed } from 'vue';

/* ---------------------------------------------------------------------------
 * ExecutionPipeline state machine
 * ------------------------------------------------------------------------- */

export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent =
  | { type: 'ADVANCE' }
  | { type: 'SELECT_STAGE'; stageId?: string }
  | { type: 'FAIL' }
  | { type: 'DESELECT' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'ADVANCE') return 'idle';
      if (event.type === 'SELECT_STAGE') return 'stageSelected';
      if (event.type === 'FAIL') return 'failed';
      return state;
    case 'stageSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'idle';
      if (event.type === 'RESET') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  description?: string;
  isTimelock?: boolean;
}

function iconForStatus(status: PipelineStageStatus): ReturnType<typeof h> {
  const shared = { xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16', viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' };
  switch (status) {
    case 'complete':
      return h('svg', shared, [h('path', { d: 'M3 8.5L6.5 12L13 4', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
    case 'failed':
      return h('svg', shared, [h('path', { d: 'M4 4L12 12M12 4L4 12', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
    case 'skipped':
      return h('svg', shared, [h('path', { d: 'M4 4L12 8L4 12V4Z', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round', fill: 'none' })]);
    default:
      return h('svg', shared, [h('circle', { cx: '8', cy: '8', r: '4', fill: 'currentColor' })]);
  }
}

function connectorStatus(left: PipelineStageStatus, right: PipelineStageStatus): string {
  if (left === 'complete' && (right === 'complete' || right === 'active')) return 'complete';
  if (left === 'complete' && right === 'pending') return 'upcoming';
  if (left === 'failed' || right === 'failed') return 'failed';
  return 'pending';
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const ExecutionPipeline = defineComponent({
  name: 'ExecutionPipeline',
  props: {
    stages: { type: Array as () => PipelineStage[], required: true },
    currentStage: { type: String, required: true },
    status: { type: String, required: true },
    showTimer: { type: Boolean, default: true },
    showActions: { type: Boolean, default: true },
    compact: { type: Boolean, default: false },
  },
  emits: ['stageSelect', 'retry', 'cancel', 'forceExecute'],
  setup(props, { slots, emit }) {
    const widgetState = ref<ExecutionPipelineState>('idle');
    const send = (event: ExecutionPipelineEvent) => {
      widgetState.value = executionPipelineReducer(widgetState.value, event);
    };

    const selectedIndex = ref(-1);

    const activeIndex = computed(() => props.stages.findIndex((s) => s.id === props.currentStage));

    const selectedStage = computed(() => {
      if (widgetState.value === 'stageSelected' && selectedIndex.value >= 0)
        return props.stages[selectedIndex.value] ?? null;
      return null;
    });

    const hasActiveTimelock = computed(() => props.stages.some((s) => s.isTimelock && s.status === 'active'));
    const isFailed = computed(() => props.status === 'failed' || widgetState.value === 'failed');

    const selectStage = (index: number) => {
      if (index < 0 || index >= props.stages.length) return;
      selectedIndex.value = index;
      send({ type: 'SELECT_STAGE', stageId: props.stages[index].id });
      emit('stageSelect', props.stages[index].id);
    };

    const deselectStage = () => { selectedIndex.value = -1; send({ type: 'DESELECT' }); };

    const handleStageKeyDown = (e: KeyboardEvent, index: number) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': {
          e.preventDefault();
          const next = index < props.stages.length - 1 ? index + 1 : 0;
          selectStage(next); break;
        }
        case 'ArrowLeft': case 'ArrowUp': {
          e.preventDefault();
          const prev = index > 0 ? index - 1 : props.stages.length - 1;
          selectStage(prev); break;
        }
        case 'Enter': case ' ': { e.preventDefault(); selectStage(index); break; }
        case 'Escape': { e.preventDefault(); deselectStage(); break; }
      }
    };

    return () => h('div', {
      role: 'group', 'aria-label': `Execution pipeline: ${props.status}`,
      'data-surface-widget': '', 'data-widget-name': 'execution-pipeline',
      'data-part': 'root', 'data-state': widgetState.value,
      'data-status': props.status, 'data-compact': props.compact ? 'true' : 'false',
    }, [
      // Pipeline
      h('div', { 'data-part': 'pipeline', role: 'list', 'data-state': widgetState.value },
        props.stages.map((stage, index) => {
          const isCurrent = stage.id === props.currentStage;
          const isSelected = selectedStage.value?.id === stage.id;
          return h('div', { key: stage.id, style: { display: 'inline-flex', alignItems: 'center' } }, [
            h('div', {
              'data-part': 'stage', 'data-status': stage.status,
              'data-current': isCurrent ? 'true' : 'false',
              'data-selected': isSelected ? 'true' : 'false',
              role: 'listitem', 'aria-current': isCurrent ? 'step' : undefined,
              'aria-label': `${stage.name} \u2014 ${stage.status}`,
              tabindex: index === (activeIndex.value >= 0 ? activeIndex.value : 0) ? 0 : -1,
              onClick: () => selectStage(index),
              onKeydown: (e: KeyboardEvent) => handleStageKeyDown(e, index),
            }, [
              h('div', {
                'data-part': 'stage-icon', 'data-status': stage.status, 'aria-hidden': 'true',
                'data-animate': stage.status === 'active' ? 'pulse' : undefined,
              }, [iconForStatus(stage.status)]),
              h('span', { 'data-part': 'stage-label' }, stage.name),
              !props.compact && stage.description
                ? h('span', { 'data-part': 'stage-detail' }, stage.description) : null,
            ]),
            index < props.stages.length - 1
              ? h('div', {
                  'data-part': 'connector',
                  'data-status': connectorStatus(stage.status, props.stages[index + 1].status),
                  'aria-hidden': 'true',
                }, [h('svg', { width: '24', height: '16', viewBox: '0 0 24 16', fill: 'none', 'aria-hidden': 'true' }, [
                  h('path', { d: 'M0 8H20M20 8L14 3M20 8L14 13', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
                ])])
              : null,
          ]);
        }),
      ),
      // Stage detail panel
      widgetState.value === 'stageSelected' && selectedStage.value
        ? h('div', {
            'data-part': 'stage-detail-panel', role: 'region',
            'aria-label': `Details for ${selectedStage.value.name}`, 'aria-live': 'polite',
          }, [
            h('strong', null, selectedStage.value.name),
            selectedStage.value.description ? h('span', { 'data-part': 'stage-detail' }, selectedStage.value.description) : null,
            h('span', { 'data-part': 'stage-status-badge', 'data-status': selectedStage.value.status }, selectedStage.value.status),
          ])
        : null,
      // Timelock timer slot
      props.showTimer && hasActiveTimelock.value
        ? h('div', { 'data-part': 'timelock-timer', 'data-visible': 'true' }, [
            slots.timer ? slots.timer() : h('span', { 'aria-live': 'polite', role: 'timer' }, 'Timelock countdown active'),
          ])
        : null,
      // Failure banner
      isFailed.value
        ? h('div', { 'data-part': 'failure-banner', role: 'alert', 'aria-live': 'assertive' }, [
            h('span', null, 'Pipeline execution failed'),
            h('button', {
              type: 'button', 'data-part': 'retry-button',
              onClick: () => { send({ type: 'RETRY' }); emit('retry'); },
            }, 'Retry'),
          ])
        : null,
      // Action bar
      props.showActions
        ? h('div', {
            'data-part': 'actions', 'data-visible': 'true',
            role: 'toolbar', 'aria-label': 'Pipeline actions',
          }, slots.default ? slots.default() : [
            h('button', { type: 'button', 'data-part': 'cancel-button', onClick: () => emit('cancel') }, 'Cancel'),
            h('button', { type: 'button', 'data-part': 'force-execute-button', onClick: () => emit('forceExecute') }, 'Force Execute'),
          ])
        : null,
    ]);
  },
});

export default ExecutionPipeline;
