'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { badgeReducer } from './NotationBadge.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface NotationBadgeProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Notation identifier. */
  notationId?: string;
  /** Notation display name. */
  notationName?: string;
  /** Notation icon (emoji or URL). */
  notationIcon?: string;
  /** Canvas this badge belongs to. */
  canvasId: string;
  /** Called when badge is clicked. */
  onOpenSelector?: () => void;
  /** Called when a notation is selected from the dropdown. */
  onSelectNotation?: (notationId: string) => void;
  /** Selector dropdown slot. */
  selector?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const NotationBadge = forwardRef<HTMLButtonElement, NotationBadgeProps>(function NotationBadge(
  {
    notationId,
    notationName,
    notationIcon,
    canvasId,
    onOpenSelector,
    onSelectNotation,
    selector,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(badgeReducer, notationId ? 'active' : 'none');

  const handleClick = useCallback(() => {
    send({ type: 'CLICK' });
    onOpenSelector?.();
  }, [onOpenSelector]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        send({ type: 'CANCEL' });
      }
    },
    [handleClick],
  );

  return (
    <button
      ref={ref}
      role="button"
      aria-label={`Notation: ${notationName ?? 'None'}`}
      aria-haspopup="listbox"
      data-surface-widget=""
      data-widget-name="notation-badge"
      data-part="notation-badge"
      data-canvas={canvasId}
      data-notation={notationId ?? undefined}
      data-state={state}
      tabIndex={0}
      onClick={handleClick}
      onPointerEnter={() => send({ type: 'HOVER' })}
      onPointerLeave={() => send({ type: 'UNHOVER' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {notationIcon && (
        <span data-part="notation-icon" aria-hidden="true">{notationIcon}</span>
      )}

      <span data-part="notation-name">
        {notationName ?? 'Freeform'}
      </span>

      {state === 'selecting' && selector && (
        <div data-part="selector-dropdown" role="listbox">
          {selector}
        </div>
      )}
    </button>
  );
});

NotationBadge.displayName = 'NotationBadge';
export { NotationBadge };
export default NotationBadge;
