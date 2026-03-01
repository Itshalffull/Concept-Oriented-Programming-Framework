'use client';
import { forwardRef, useReducer, useCallback, useEffect, useRef } from 'react';
import { avatarReducer, getInitials, type AvatarState, type AvatarEvent } from './Avatar.reducer.js';

// Props from avatar.widget spec
export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  delayMs?: number;
  className?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  function Avatar(
    {
      src,
      name = '',
      size = 'md',
      delayMs = 0,
      className,
    },
    ref
  ) {
    const [state, send] = useReducer(avatarReducer, 'loading');
    const prevSrcRef = useRef(src);

    // Reset to loading when src changes
    useEffect(() => {
      if (prevSrcRef.current !== src) {
        prevSrcRef.current = src;
        send({ type: 'INVALIDATE' });
      }
    }, [src]);

    const handleLoad = useCallback(() => {
      if (delayMs > 0) {
        setTimeout(() => send({ type: 'LOAD_SUCCESS' }), delayMs);
      } else {
        send({ type: 'LOAD_SUCCESS' });
      }
    }, [delayMs]);

    const handleError = useCallback(() => {
      send({ type: 'LOAD_ERROR' });
    }, []);

    const isLoaded = state === 'loaded';

    return (
      <div
        ref={ref}
        className={className}
        role="img"
        aria-label={name}
        data-surface-widget=""
        data-widget-name="avatar"
        data-part="root"
        data-size={size}
        data-state={state}
      >
        {src && (
          <img
            src={src}
            alt={name}
            data-part="image"
            data-visible={isLoaded ? 'true' : 'false'}
            onLoad={handleLoad}
            onError={handleError}
            style={isLoaded ? undefined : { display: 'none' }}
          />
        )}
        <span
          data-part="fallback"
          data-visible={isLoaded ? 'false' : 'true'}
          aria-hidden="true"
          style={isLoaded ? { display: 'none' } : undefined}
        >
          {getInitials(name)}
        </span>
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
export default Avatar;
