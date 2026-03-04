// State machine from avatar.widget spec: loading -> loaded | error
export type AvatarState = 'loading' | 'loaded' | 'error';
export type AvatarEvent =
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_ERROR' }
  | { type: 'INVALIDATE' }
  | { type: 'RETRY' };

export function avatarReducer(state: AvatarState, event: AvatarEvent): AvatarState {
  switch (state) {
    case 'loading':
      if (event.type === 'LOAD_SUCCESS') return 'loaded';
      if (event.type === 'LOAD_ERROR') return 'error';
      return state;
    case 'loaded':
      if (event.type === 'INVALIDATE') return 'loading';
      return state;
    case 'error':
      if (event.type === 'RETRY') return 'loading';
      return state;
    default:
      return state;
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

import { forwardRef, useReducer, useCallback, useEffect, useRef } from 'react';

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
