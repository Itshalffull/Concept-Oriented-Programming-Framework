import { defineComponent, h, ref, computed, watch, type PropType } from 'vue';

export type ToolInvocationViewState = 'collapsed' | 'hoveredCollapsed' | 'expanded';
export type ToolInvocationExecState = 'pending' | 'running' | 'succeeded' | 'failed';

export type ToolInvocationEvent =
  | { type: 'EXPAND' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'COLLAPSE' }
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function toolInvocationViewReducer(state: ToolInvocationViewState, event: ToolInvocationEvent): ToolInvocationViewState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    default:
      return state;
  }
}

export function toolInvocationExecReducer(state: ToolInvocationExecState, event: ToolInvocationEvent): ToolInvocationExecState {
  switch (state) {
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

function formatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

const STATUS_ICONS: Record<string, string> = { pending: '\u25CB', running: '\u25CF', succeeded: '\u2713', failed: '\u2717' };

export const ToolInvocation = defineComponent({
  name: 'ToolInvocation',
  props: {
    toolName: { type: String, required: true },
    arguments: { type: String, required: true },
    result: { type: String, default: undefined },
    status: { type: String as PropType<'pending' | 'running' | 'succeeded' | 'failed'>, required: true },
    duration: { type: Number, default: undefined },
    showArguments: { type: Boolean, default: true },
    showResult: { type: Boolean, default: true },
    defaultExpanded: { type: Boolean, default: false },
  },
  emits: ['retry'],
  setup(props, { emit }) {
    const viewState = ref<ToolInvocationViewState>(props.defaultExpanded ? 'expanded' : 'collapsed');
    const execState = ref<ToolInvocationExecState>(props.status as ToolInvocationExecState);

    function sendView(event: ToolInvocationEvent) {
      viewState.value = toolInvocationViewReducer(viewState.value, event);
    }
    function sendExec(event: ToolInvocationEvent) {
      execState.value = toolInvocationExecReducer(execState.value, event);
    }

    watch(() => props.status, (s) => {
      const map: Record<string, ToolInvocationEvent> = {
        running: { type: 'INVOKE' }, succeeded: { type: 'SUCCESS' }, failed: { type: 'FAILURE' }, pending: { type: 'RESET' },
      };
      if (map[s]) sendExec(map[s]);
    });

    const isExpanded = computed(() => viewState.value === 'expanded');
    const combinedState = computed(() => `${viewState.value}-${execState.value}`);

    function handleToggle() {
      sendView({ type: isExpanded.value ? 'COLLAPSE' : 'EXPAND' });
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); }
      if (e.key === 'Escape' && isExpanded.value) { e.preventDefault(); sendView({ type: 'COLLAPSE' }); }
    }

    return () => {
      const children: any[] = [];

      // Header
      children.push(h('div', {
        'data-part': 'header',
        'data-exec': execState.value,
        onClick: handleToggle,
        style: { cursor: 'pointer' },
      }, [
        h('div', { 'data-part': 'tool-icon', 'aria-hidden': 'true' }, '\u{1F527}'),
        h('span', { 'data-part': 'tool-name' }, props.toolName),
        h('div', { 'data-part': 'status-icon', 'data-status': execState.value }, STATUS_ICONS[execState.value] ?? '\u25CB'),
        props.duration != null
          ? h('span', { 'data-part': 'duration-label' }, `${props.duration}ms`)
          : null,
        h('span', { 'data-part': 'expand-icon', 'aria-hidden': 'true' }, isExpanded.value ? '\u25BC' : '\u25B6'),
      ]));

      // Body
      if (isExpanded.value) {
        const bodyChildren: any[] = [];
        if (props.showArguments) {
          bodyChildren.push(h('div', { 'data-part': 'arguments-block' }, [
            h('div', { 'data-part': 'section-header' }, 'Arguments'),
            h('pre', { 'data-part': 'arguments-json' }, formatJson(props.arguments)),
          ]));
        }
        if (props.showResult && props.result != null) {
          bodyChildren.push(h('div', { 'data-part': 'result-block' }, [
            h('div', { 'data-part': 'section-header' }, 'Result'),
            h('pre', { 'data-part': 'result-json' }, formatJson(props.result)),
          ]));
        }
        if (execState.value === 'failed') {
          bodyChildren.push(h('button', {
            type: 'button', 'data-part': 'retry-button',
            'aria-label': 'Retry tool invocation',
            onClick: (e: Event) => { e.stopPropagation(); sendExec({ type: 'RETRY' }); emit('retry'); },
          }, 'Retry'));
        }
        children.push(h('div', { 'data-part': 'body' }, bodyChildren));
      }

      return h('div', {
        role: 'article',
        'aria-label': `Tool: ${props.toolName} - ${execState.value}`,
        'aria-expanded': isExpanded.value ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'tool-invocation',
        'data-part': 'root',
        'data-state': combinedState.value,
        tabindex: 0,
        onMouseenter: () => sendView({ type: 'HOVER' }),
        onMouseleave: () => sendView({ type: 'LEAVE' }),
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default ToolInvocation;
