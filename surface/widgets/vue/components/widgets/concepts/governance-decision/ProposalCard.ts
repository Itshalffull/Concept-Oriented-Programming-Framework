import { defineComponent, h, ref, computed, onMounted, onUnmounted, watch } from 'vue';

/* ---------------------------------------------------------------------------
 * ProposalCard state machine
 * States: idle (initial), hovered, focused, navigating
 * ------------------------------------------------------------------------- */

export type ProposalCardState = 'idle' | 'hovered' | 'focused' | 'navigating';
export type ProposalCardEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'CLICK' }
  | { type: 'ENTER' }
  | { type: 'NAVIGATE_COMPLETE' };

export function proposalCardReducer(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      if (event.type === 'ENTER') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '\u2026';
}

function formatTimeRemaining(timestamp: string): string {
  const target = new Date(timestamp).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const absDiff = Math.abs(diffMs);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const isPast = diffMs < 0;
  const suffix = isPast ? ' ago' : ' remaining';
  if (days > 0) return `${days}d${suffix}`;
  if (hours > 0) return `${hours}h${suffix}`;
  if (minutes > 0) return `${minutes}m${suffix}`;
  return `${seconds}s${suffix}`;
}

function actionLabelForStatus(status: string): string {
  switch (status) {
    case 'Active': return 'Vote';
    case 'Passed':
    case 'Approved': return 'Execute';
    case 'Draft': return 'Edit';
    default: return 'View';
  }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const ProposalCard = defineComponent({
  name: 'ProposalCard',
  props: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    author: { type: String, required: true },
    status: { type: String, required: true },
    timestamp: { type: String, required: true },
    variant: { type: String, default: 'full' },
    showVoteBar: { type: Boolean, default: true },
    showQuorum: { type: Boolean, default: false },
    truncateDescription: { type: Number, default: 120 },
  },
  emits: ['click', 'navigate'],
  setup(props, { slots, emit }) {
    const state = ref<ProposalCardState>('idle');
    const send = (event: ProposalCardEvent) => {
      state.value = proposalCardReducer(state.value, event);
    };

    const truncatedDescription = computed(() => truncate(props.description, props.truncateDescription));
    const relativeTime = computed(() => formatTimeRemaining(props.timestamp));
    const actionLabel = computed(() => actionLabelForStatus(props.status));

    const showDescription = computed(() => props.variant !== 'minimal');
    const showProposer = computed(() => props.variant !== 'minimal');
    const showVoteBarSlot = computed(() => props.showVoteBar && props.status === 'Active' && props.variant !== 'minimal');
    const showQuorumSlot = computed(() => props.showQuorum && props.variant === 'full');
    const showAction = computed(() => props.variant !== 'minimal');

    // Navigate side-effect
    let navigateTimer: ReturnType<typeof setTimeout> | null = null;
    watch(state, (newState) => {
      if (newState === 'navigating') {
        emit('click');
        emit('navigate');
        navigateTimer = setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 0);
      }
    });
    onUnmounted(() => {
      if (navigateTimer) clearTimeout(navigateTimer);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        send({ type: state.value === 'focused' ? 'ENTER' : 'CLICK' });
      }
    };

    return () => h('article', {
      role: 'article',
      'aria-label': `${props.status} proposal: ${props.title}`,
      'data-surface-widget': '',
      'data-widget-name': 'proposal-card',
      'data-part': 'root',
      'data-state': state.value,
      'data-variant': props.variant,
      'data-status': props.status,
      tabindex: 0,
      onClick: () => send({ type: 'CLICK' }),
      onMouseenter: () => send({ type: 'HOVER' }),
      onMouseleave: () => send({ type: 'UNHOVER' }),
      onFocus: () => send({ type: 'FOCUS' }),
      onBlur: () => send({ type: 'BLUR' }),
      onKeydown: handleKeyDown,
    }, [
      // Status badge
      h('div', {
        'data-part': 'status-badge',
        'data-status': props.status,
        role: 'status',
        'aria-label': `Status: ${props.status}`,
      }, props.status),

      // Title
      h('h3', { 'data-part': 'title', role: 'heading', 'aria-level': 3 }, props.title),

      // Description
      showDescription.value
        ? h('p', {
            'data-part': 'description',
            'data-visible': props.variant !== 'minimal' ? 'true' : 'false',
          }, truncatedDescription.value)
        : null,

      // Proposer
      showProposer.value
        ? h('div', {
            'data-part': 'proposer',
            'data-author': props.author,
            'aria-label': `Proposed by ${props.author}`,
          }, [
            h('span', { 'data-part': 'avatar', 'aria-hidden': 'true' }),
            h('span', null, props.author),
          ])
        : null,

      // Vote bar slot
      showVoteBarSlot.value
        ? h('div', { 'data-part': 'vote-bar', 'data-visible': 'true' })
        : null,

      // Quorum gauge slot
      showQuorumSlot.value
        ? h('div', { 'data-part': 'quorum-gauge', 'data-visible': 'true' })
        : null,

      // Time remaining
      h('span', {
        'data-part': 'time-remaining',
        'data-timestamp': props.timestamp,
        role: 'timer',
        'aria-live': 'off',
      }, relativeTime.value),

      // Action button
      showAction.value
        ? h('button', {
            type: 'button',
            'data-part': 'action',
            role: 'button',
            'aria-label': `View proposal: ${props.title}`,
            tabindex: 0,
            onClick: (e: MouseEvent) => {
              e.stopPropagation();
              send({ type: 'CLICK' });
            },
          }, slots.default ? slots.default() : actionLabel.value)
        : null,
    ]);
  },
});

export default ProposalCard;
