import type { HTMLAttributes, ReactNode } from 'react';

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

export interface ProposalCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  title: string;
  description: string;
  author: string;
  status: ProposalStatus;
  timestamp: string;
  variant?: 'full' | 'compact' | 'minimal';
  showVoteBar?: boolean;
  showQuorum?: boolean;
  truncateDescription?: number;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component — no hooks, no event handlers)
 * ------------------------------------------------------------------------- */

export default function ProposalCard({
  title,
  description,
  author,
  status,
  timestamp,
  variant = 'full',
  showVoteBar = true,
  showQuorum = false,
  truncateDescription = 120,
  children,
  ...rest
}: ProposalCardProps) {
  const truncatedDescription = truncate(description, truncateDescription);
  const relativeTime = formatTimeRemaining(timestamp);
  const actionLabel = actionLabelForStatus(status);

  const showDescription = variant !== 'minimal';
  const showProposer = variant !== 'minimal';
  const showVoteBarSlot = showVoteBar && status === 'Active' && variant !== 'minimal';
  const showQuorumSlot = showQuorum && variant === 'full';
  const showAction = variant !== 'minimal';

  return (
    <article
      role="article"
      aria-label={`${status} proposal: ${title}`}
      data-surface-widget=""
      data-widget-name="proposal-card"
      data-part="root"
      data-state="idle"
      data-variant={variant}
      data-status={status}
      tabIndex={0}
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

      {/* Description */}
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
          <span data-part="avatar" aria-hidden="true" />
          <span>{author}</span>
        </div>
      )}

      {/* Vote bar slot */}
      {showVoteBarSlot && (
        <div data-part="vote-bar" data-visible="true">
          {/* Compose slot: vote-result-bar widget */}
        </div>
      )}

      {/* Quorum gauge slot */}
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

      {/* Action button (static label — interactivity requires client wrapper) */}
      {showAction && (
        <button
          type="button"
          data-part="action"
          role="button"
          aria-label={`View proposal: ${title}`}
          tabIndex={0}
        >
          {children ?? actionLabel}
        </button>
      )}
    </article>
  );
}

export { ProposalCard };
