'use client';
import { forwardRef, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import { presenceReducer, stateToDataState, type PresenceState, type PresenceEvent } from './Presence.reducer.js';

// Props from presence.widget spec
export interface PresenceProps {
  present?: boolean;
  animateOnMount?: boolean;
  forceMount?: boolean;
  children?: ReactNode;
  className?: string;
}

export const Presence = forwardRef<HTMLDivElement, PresenceProps>(
  function Presence(
    {
      present = false,
      animateOnMount = false,
      forceMount = false,
      children,
      className,
    },
    ref
  ) {
    const [state, send] = useReducer(
      presenceReducer,
      present ? (animateOnMount ? 'mounting' : 'mounted') : 'unmounted'
    );

    // Respond to present prop changes
    useEffect(() => {
      if (present) {
        send({ type: 'SHOW' });
      } else {
        send({ type: 'HIDE' });
      }
    }, [present]);

    const handleAnimationEnd = useCallback(() => {
      send({ type: 'ANIMATION_END' });
    }, []);

    // If not present, not force-mounted, and fully unmounted, render nothing
    const shouldRender = forceMount || state !== 'unmounted';

    if (!shouldRender) return null;

    return (
      <div
        ref={ref}
        className={className}
        onAnimationEnd={handleAnimationEnd}
        onTransitionEnd={handleAnimationEnd}
        data-surface-widget=""
        data-widget-name="presence"
        data-part="root"
        data-state={stateToDataState(state)}
        data-present={present ? 'true' : 'false'}
        data-animate-mount={animateOnMount ? 'true' : 'false'}
        data-force-mount={forceMount ? 'true' : 'false'}
      >
        {children}
      </div>
    );
  }
);

Presence.displayName = 'Presence';
export default Presence;
