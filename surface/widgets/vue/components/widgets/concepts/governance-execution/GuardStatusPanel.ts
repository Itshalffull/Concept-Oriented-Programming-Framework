import { defineComponent, h, ref, computed } from 'vue';

/* ---------------------------------------------------------------------------
 * GuardStatusPanel state machine
 * ------------------------------------------------------------------------- */

export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent =
  | { type: 'SELECT_GUARD'; id?: string }
  | { type: 'GUARD_TRIP' }
  | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_GUARD') return 'guardSelected';
      if (event.type === 'GUARD_TRIP') return 'idle';
      return state;
    case 'guardSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';

export interface Guard {
  id?: string;
  name: string;
  description: string;
  status: GuardStatus;
  lastChecked?: string;
}

const STATUS_ICONS: Record<GuardStatus, string> = {
  passing: '\u2713', failing: '\u2717', pending: '\u23F3', bypassed: '\u2298',
};
const STATUS_LABELS: Record<GuardStatus, string> = {
  passing: 'Passing', failing: 'Failing', pending: 'Pending', bypassed: 'Bypassed',
};

type OverallStatus = 'all-passing' | 'has-failing' | 'has-pending';

function deriveOverallStatus(guards: Guard[]): OverallStatus {
  if (guards.length === 0) return 'all-passing';
  if (guards.some((g) => g.status === 'failing')) return 'has-failing';
  if (guards.some((g) => g.status === 'pending')) return 'has-pending';
  return 'all-passing';
}

function formatLastChecked(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(Math.abs(diffMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const GuardStatusPanel = defineComponent({
  name: 'GuardStatusPanel',
  props: {
    guards: { type: Array as () => Guard[], required: true },
    executionStatus: { type: String, required: true },
    showConditions: { type: Boolean, default: true },
  },
  emits: ['guardSelect'],
  setup(props, { slots, emit }) {
    const state = ref<GuardStatusPanelState>('idle');
    const send = (event: GuardStatusPanelEvent) => {
      state.value = guardStatusPanelReducer(state.value, event);
    };

    const selectedGuardId = ref<string | null>(null);
    const focusIndex = ref(0);

    const overallStatus = computed(() => deriveOverallStatus(props.guards));
    const passingCount = computed(() => props.guards.filter((g) => g.status === 'passing').length);
    const hasBlockingGuards = computed(() => props.guards.some((g) => g.status === 'failing'));

    const toggleGuard = (guard: Guard, index: number) => {
      const guardId = guard.id ?? guard.name;
      if (state.value === 'guardSelected' && selectedGuardId.value === guardId) {
        selectedGuardId.value = null;
        send({ type: 'DESELECT' });
      } else {
        selectedGuardId.value = guardId;
        focusIndex.value = index;
        send({ type: 'SELECT_GUARD', id: guardId });
        emit('guardSelect', guard);
      }
    };

    const handleRootKeyDown = (e: KeyboardEvent) => {
      if (props.guards.length === 0) return;
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          focusIndex.value = Math.min(focusIndex.value + 1, props.guards.length - 1);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          focusIndex.value = Math.max(focusIndex.value - 1, 0);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (props.guards[focusIndex.value]) toggleGuard(props.guards[focusIndex.value], focusIndex.value);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          if (state.value === 'guardSelected') { selectedGuardId.value = null; send({ type: 'DESELECT' }); }
          break;
        }
      }
    };

    return () => h('div', {
      role: 'region', 'aria-label': 'Pre-execution guards',
      'data-surface-widget': '', 'data-widget-name': 'guard-status-panel',
      'data-part': 'root', 'data-state': state.value,
      'data-overall-status': overallStatus.value,
      'data-execution-status': props.executionStatus,
      tabindex: -1, onKeydown: handleRootKeyDown,
    }, [
      // Header
      h('div', { 'data-part': 'header', 'data-state': state.value, 'data-overall-status': overallStatus.value }, [
        h('h3', { 'data-part': 'heading' }, 'Pre-execution Guards'),
        h('span', { 'data-part': 'summary', 'aria-live': 'polite' },
          `${passingCount.value} of ${props.guards.length} guards passing`),
      ]),
      // Blocking banner
      hasBlockingGuards.value
        ? h('div', { 'data-part': 'blocking-banner', 'data-visible': 'true', role: 'alert' },
            'Execution is blocked by failing guards')
        : null,
      // Guard list
      h('div', { 'data-part': 'guard-list', role: 'list' },
        props.guards.map((guard, index) => {
          const guardId = guard.id ?? guard.name;
          const isSelected = state.value === 'guardSelected' && selectedGuardId.value === guardId;
          const isFocused = focusIndex.value === index;

          return h('div', {
            key: guardId,
            'data-part': 'guard-item', 'data-status': guard.status,
            'data-selected': isSelected ? 'true' : 'false',
            role: 'listitem',
            'aria-label': `${guard.name} \u2014 ${STATUS_LABELS[guard.status]}`,
            'aria-expanded': isSelected,
            tabindex: isFocused ? 0 : -1,
            onClick: () => toggleGuard(guard, index),
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); e.stopPropagation(); toggleGuard(guard, index);
              }
            },
          }, [
            h('span', { 'data-part': 'guard-icon', 'data-status': guard.status, 'aria-hidden': 'true' }, STATUS_ICONS[guard.status]),
            h('span', { 'data-part': 'guard-name' }, guard.name),
            props.showConditions
              ? h('span', { 'data-part': 'guard-condition', 'data-visible': 'true' }, guard.description)
              : null,
            h('span', { 'data-part': 'guard-status', 'data-status': guard.status }, STATUS_LABELS[guard.status]),
            isSelected
              ? h('div', { 'data-part': 'guard-detail', 'data-status': guard.status }, [
                  h('p', { 'data-part': 'guard-detail-description' }, guard.description),
                  guard.lastChecked
                    ? h('span', { 'data-part': 'guard-last-checked' }, `Last checked: ${formatLastChecked(guard.lastChecked)}`)
                    : null,
                ])
              : null,
          ]);
        }),
      ),
      slots.default ? slots.default() : null,
    ]);
  },
});

export default GuardStatusPanel;
