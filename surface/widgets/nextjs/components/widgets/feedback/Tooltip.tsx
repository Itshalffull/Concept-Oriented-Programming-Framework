'use client';

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
import { tooltipReducer } from './Tooltip.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  /** Text label displayed inside the tooltip. */
  label?: string;
  /** Preferred placement relative to the trigger. */
  placement?: Placement;
  /** Delay in ms before the tooltip opens. */
  openDelay?: number;
  /** Delay in ms before the tooltip closes. */
  closeDelay?: number;
  /** The trigger element. */
  children: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  {
    label = '',
    placement = 'top',
    openDelay = 700,
    closeDelay = 300,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(tooltipReducer, 'hidden');
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
    if (state === 'showing') {
      timerRef.current = setTimeout(() => send({ type: 'DELAY_ELAPSED' }), openDelay);
    } else if (state === 'hiding') {
      timerRef.current = setTimeout(() => send({ type: 'DELAY_ELAPSED' }), closeDelay);
    }
    return clearTimer;
  }, [state, openDelay, closeDelay, clearTimer]);

  // Escape key listener
  useEffect(() => {
    if (state === 'hidden') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') send({ type: 'ESCAPE' });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state]);

  const isVisible = state === 'visible' || state === 'hiding';
  const position = useFloatingPosition(triggerRef, positionerRef, {
    placement,
    enabled: isVisible,
  });

  return (
    <div
      ref={ref}
      data-part="root"
      data-state={isVisible ? 'visible' : 'hidden'}
      data-surface-widget=""
      data-widget-name="tooltip"
      {...rest}
    >
      <div
        ref={triggerRef}
        data-part="trigger"
        aria-describedby={isVisible ? contentId : undefined}
        onPointerEnter={() => send({ type: 'POINTER_ENTER' })}
        onPointerLeave={() => send({ type: 'POINTER_LEAVE' })}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={positionerRef}
          data-part="positioner"
          data-state={isVisible ? 'visible' : 'hidden'}
          data-placement={position.placement}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            pointerEvents: 'none',
          }}
        >
          <div
            data-part="content"
            role="tooltip"
            id={contentId}
            data-state={isVisible ? 'visible' : 'hidden'}
            data-placement={position.placement}
          >
            {label}
          </div>
          <div data-part="arrow" data-placement={position.placement} />
        </div>
      )}
    </div>
  );
});

Tooltip.displayName = 'Tooltip';
export { Tooltip };
export default Tooltip;
