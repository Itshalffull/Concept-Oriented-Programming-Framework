/* ---------------------------------------------------------------------------
 * State machine
 * States: hidden (initial), opening, open, closing
 * Events: POINTER_ENTER, POINTER_LEAVE, FOCUS, BLUR, ESCAPE, DELAY_ELAPSED
 * ------------------------------------------------------------------------- */

export type HoverCardState = 'hidden' | 'opening' | 'open' | 'closing';
export type HoverCardEvent =
  | { type: 'POINTER_ENTER' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'ESCAPE' }
  | { type: 'DELAY_ELAPSED' };

export function hoverCardReducer(state: HoverCardState, event: HoverCardEvent): HoverCardState {
  switch (state) {
    case 'hidden':
      if (event.type === 'POINTER_ENTER' || event.type === 'FOCUS') return 'opening';
      return state;
    case 'opening':
      if (event.type === 'DELAY_ELAPSED') return 'open';
      if (
        event.type === 'POINTER_LEAVE' ||
        event.type === 'BLUR'
      )
        return 'hidden';
      return state;
    case 'open':
      if (event.type === 'POINTER_LEAVE' || event.type === 'BLUR') return 'closing';
      if (event.type === 'ESCAPE') return 'hidden';
      return state;
    case 'closing':
      if (event.type === 'DELAY_ELAPSED') return 'hidden';
      if (event.type === 'POINTER_ENTER' || event.type === 'FOCUS') return 'open';
      return state;
    default:
      return state;
  }
}


import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  useRef,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useFloatingPosition, type Placement } from '../shared/useFloatingPosition.js';
import { hoverCardReducer } from './HoverCard.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface HoverCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  /** Delay in ms before the card opens. */
  openDelay?: number;
  /** Delay in ms before the card closes. */
  closeDelay?: number;
  /** Preferred placement relative to the trigger. */
  placement?: Placement;
  /** The trigger element that reveals the hover card. */
  children: ReactNode;
  /** Content displayed inside the hover card. */
  content?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(function HoverCard(
  {
    openDelay = 700,
    closeDelay = 300,
    placement = 'bottom',
    children,
    content,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(hoverCardReducer, 'hidden');
  const contentId = useId();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const positionerRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Manage delay timers based on state transitions
  useEffect(() => {
    clearTimer();
    if (state === 'opening') {
      timerRef.current = setTimeout(() => send({ type: 'DELAY_ELAPSED' }), openDelay);
    } else if (state === 'closing') {
      timerRef.current = setTimeout(() => send({ type: 'DELAY_ELAPSED' }), closeDelay);
    }
    return clearTimer;
  }, [state, openDelay, closeDelay, clearTimer]);

  // Escape key listener
  useEffect(() => {
    if (state !== 'open') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') send({ type: 'ESCAPE' });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state]);

  const isOpen = state === 'open' || state === 'closing';
  const position = useFloatingPosition(triggerRef, positionerRef, {
    placement,
    enabled: isOpen,
  });

  const pointerHandlers = {
    onPointerEnter: () => send({ type: 'POINTER_ENTER' }),
    onPointerLeave: () => send({ type: 'POINTER_LEAVE' }),
  };

  return (
    <div
      ref={ref}
      data-part="root"
      data-state={state}
      data-surface-widget=""
      data-widget-name="hover-card"
      {...rest}
    >
      <div
        ref={triggerRef}
        data-part="trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
        {...pointerHandlers}
      >
        {children}
      </div>

      {isOpen && (
        <div
          ref={positionerRef}
          data-part="positioner"
          data-state={state}
          data-placement={position.placement}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
          }}
          {...pointerHandlers}
        >
          <div
            data-part="content"
            role="dialog"
            aria-modal={false}
            id={contentId}
            data-state={state}
            data-placement={position.placement}
          >
            {content}
          </div>
          <div data-part="arrow" data-placement={position.placement} />
        </div>
      )}
    </div>
  );
});

HoverCard.displayName = 'HoverCard';
export { HoverCard };
export default HoverCard;
