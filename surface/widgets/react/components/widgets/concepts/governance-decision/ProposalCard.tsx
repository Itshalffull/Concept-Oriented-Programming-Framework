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

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Truncate a string to `max` characters, appending ellipsis when clipped. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '\u2026';
}

/** Derive a human-readable relative-time string from an ISO timestamp. */
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

/** Map a proposal status to its primary action label. */
function actionLabelForStatus(status: string): string {
  switch (status) {
    case 'Active':
      return 'Vote';
    case 'Passed':
    case 'Approved':
      return 'Execute';
    case 'Draft':
      return 'Edit';
    default:
      return 'View';
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export type ProposalStatus =
  | 'Draft'
  | 'Active'
  | 'Passed'
  | 'Rejected'
  | 'Executed'
  | 'Cancelled'
  | 'Approved'
  | (string & {});

export interface ProposalCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'onClick'> {
  /** Proposal title. */
  title: string;
  /** Full proposal description (truncated for display). */
  description: string;
  /** Proposer / author name. */
  author: string;
  /** Lifecycle status of the proposal. */
  status: ProposalStatus;
  /** ISO-8601 timestamp (deadline or creation date). */
  timestamp: string;
  /** Layout variant. */
  variant?: 'full' | 'compact' | 'minimal';
  /** Whether to render the vote-bar slot when status is Active. */
  showVoteBar?: boolean;
  /** Whether to render the quorum-gauge slot. */
  showQuorum?: boolean;
  /** Maximum characters for the description excerpt. */
  truncateDescription?: number;
  /** Callback fired when the card is clicked. */
  onClick?: () => void;
  /** Callback fired when the card triggers navigation. */
  onNavigate?: () => void;
  /** Slot content rendered inside the action area. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ProposalCard = forwardRef<HTMLElement, ProposalCardProps>(function ProposalCard(
  {
    title,
    description,
    author,
    status,
    timestamp,
    variant = 'full',
    showVoteBar = true,
    showQuorum = false,
    truncateDescription = 120,
    onClick,
    onNavigate,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(proposalCardReducer, 'idle');

  const truncatedDescription = useMemo(
    () => truncate(description, truncateDescription),
    [description, truncateDescription],
  );

  const relativeTime = useMemo(() => formatTimeRemaining(timestamp), [timestamp]);
  const actionLabel = useMemo(() => actionLabelForStatus(status), [status]);

  /* Navigate side-effect: when we enter `navigating`, fire callbacks then reset. */
  useEffect(() => {
    if (state === 'navigating') {
      onClick?.();
      onNavigate?.();
      // Allow a microtask for consumers to react, then reset state.
      const id = setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 0);
      return () => clearTimeout(id);
    }
  }, [state, onClick, onNavigate]);

  /* Keyboard handler: Enter / Space trigger navigation. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        send({ type: state === 'focused' ? 'ENTER' : 'CLICK' });
      }
    },
    [state],
  );

  /* Visibility helpers driven by variant. */
  const showDescription = variant !== 'minimal';
  const showProposer = variant !== 'minimal';
  const showVoteBarSlot = showVoteBar && status === 'Active' && variant !== 'minimal';
  const showQuorumSlot = showQuorum && variant === 'full';
  const showAction = variant !== 'minimal';

  return (
    <article
      ref={ref}
      role="article"
      aria-label={`${status} proposal: ${title}`}
      data-surface-widget=""
      data-widget-name="proposal-card"
      data-part="root"
      data-state={state}
      data-variant={variant}
      data-status={status}
      tabIndex={0}
      onClick={() => send({ type: 'CLICK' })}
      onMouseEnter={() => send({ type: 'HOVER' })}
      onMouseLeave={() => send({ type: 'UNHOVER' })}
      onFocus={() => send({ type: 'FOCUS' })}
      onBlur={() => send({ type: 'BLUR' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Status badge */}
      <div
        data-part="status-badge"
        data-status={status}
        role="status"
        aria-label={`Status: ${status}`}
      >
        {status}
      </div>

      {/* Title */}
      <h3 data-part="title" role="heading" aria-level={3}>
        {title}
      </h3>

      {/* Description (hidden in minimal and compact variants) */}
      {showDescription && (
        <p
          data-part="description"
          data-visible={variant !== 'minimal' ? 'true' : 'false'}
        >
          {truncatedDescription}
        </p>
      )}

      {/* Proposer with avatar slot */}
      {showProposer && (
        <div
          data-part="proposer"
          data-author={author}
          aria-label={`Proposed by ${author}`}
        >
          {/* Avatar compose slot */}
          <span data-part="avatar" aria-hidden="true" />
          <span>{author}</span>
        </div>
      )}

      {/* Vote bar slot (only when voting is active) */}
      {showVoteBarSlot && (
        <div data-part="vote-bar" data-visible="true">
          {/* Compose slot: vote-result-bar widget */}
        </div>
      )}

      {/* Quorum gauge slot (full variant only, when enabled) */}
      {showQuorumSlot && (
        <div data-part="quorum-gauge" data-visible="true">
          {/* Compose slot: quorum-gauge widget */}
        </div>
      )}

      {/* Time remaining */}
      <span
        data-part="time-remaining"
        data-timestamp={timestamp}
        role="timer"
        aria-live="off"
      >
        {relativeTime}
      </span>

      {/* Action button */}
      {showAction && (
        <button
          type="button"
          data-part="action"
          role="button"
          aria-label={`View proposal: ${title}`}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            send({ type: 'CLICK' });
          }}
        >
          {children ?? actionLabel}
        </button>
      )}
    </article>
  );
});

ProposalCard.displayName = 'ProposalCard';
export { ProposalCard };
export default ProposalCard;
