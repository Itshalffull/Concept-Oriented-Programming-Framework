export type MessageBranchNavState = 'viewing' | 'editing';
export type MessageBranchNavEvent =
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'EDIT' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function messageBranchNavReducer(state: MessageBranchNavState, event: MessageBranchNavEvent): MessageBranchNavState {
  switch (state) {
    case 'viewing':
      if (event.type === 'PREV') return 'viewing';
      if (event.type === 'NEXT') return 'viewing';
      if (event.type === 'EDIT') return 'editing';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useCallback,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export interface MessageBranchNavProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  currentIndex: number;
  totalBranches: number;
  showEdit?: boolean;
  compact?: boolean;
  onPrevBranch?: () => void;
  onNextBranch?: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
}

const MessageBranchNav = forwardRef<HTMLDivElement, MessageBranchNavProps>(function MessageBranchNav(
  {
    currentIndex,
    totalBranches,
    showEdit = true,
    compact = false,
    onPrevBranch,
    onNextBranch,
    onEdit,
    onSave,
    onCancel,
    children,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(messageBranchNavReducer, 'viewing');

  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalBranches - 1;
  const displayIndex = currentIndex + 1;

  const handlePrev = useCallback(() => {
    if (isFirst) return;
    send({ type: 'PREV' });
    onPrevBranch?.();
  }, [isFirst, onPrevBranch]);

  const handleNext = useCallback(() => {
    if (isLast) return;
    send({ type: 'NEXT' });
    onNextBranch?.();
  }, [isLast, onNextBranch]);

  const handleEdit = useCallback(() => {
    send({ type: 'EDIT' });
    onEdit?.();
  }, [onEdit]);

  const handleSave = useCallback(() => {
    send({ type: 'SAVE' });
    onSave?.();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    send({ type: 'CANCEL' });
    onCancel?.();
  }, [onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'e' && state === 'viewing') {
        e.preventDefault();
        handleEdit();
      }
      if (e.key === 'Escape' && state === 'editing') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handlePrev, handleNext, handleEdit, handleCancel, state],
  );

  return (
    <div
      ref={ref}
      role="navigation"
      aria-label={`Branch ${displayIndex} of ${totalBranches}`}
      data-surface-widget=""
      data-widget-name="message-branch-nav"
      data-part="root"
      data-state={state}
      data-compact={compact ? '' : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...restProps}
    >
      <button
        type="button"
        data-part="prev"
        data-state={state}
        aria-label="Previous version"
        aria-disabled={isFirst ? 'true' : 'false'}
        disabled={isFirst}
        tabIndex={0}
        onClick={handlePrev}
      >
        &#9664;
      </button>
      <span data-part="indicator" data-state={state}>
        {displayIndex} / {totalBranches}
      </span>
      <button
        type="button"
        data-part="next"
        data-state={state}
        aria-label="Next version"
        aria-disabled={isLast ? 'true' : 'false'}
        disabled={isLast}
        tabIndex={0}
        onClick={handleNext}
      >
        &#9654;
      </button>
      {showEdit && state === 'viewing' && (
        <button
          type="button"
          data-part="edit"
          data-state={state}
          aria-label="Edit and branch"
          tabIndex={0}
          onClick={handleEdit}
        >
          &#9998;
        </button>
      )}
      {state === 'editing' && (
        <>
          <button
            type="button"
            data-part="save"
            data-state={state}
            aria-label="Save edit"
            tabIndex={0}
            onClick={handleSave}
          >
            &#10003;
          </button>
          <button
            type="button"
            data-part="cancel"
            data-state={state}
            aria-label="Cancel edit"
            tabIndex={0}
            onClick={handleCancel}
          >
            &#10005;
          </button>
        </>
      )}
    </div>
  );
});

MessageBranchNav.displayName = 'MessageBranchNav';
export { MessageBranchNav };
export default MessageBranchNav;
