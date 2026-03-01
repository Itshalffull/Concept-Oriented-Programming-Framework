'use client';
import { forwardRef, useReducer, type ReactNode } from 'react';
import { skeletonReducer, skeletonInitialState } from './Skeleton.reducer.js';

// Props from skeleton.widget spec
export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  lines?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  function Skeleton(
    {
      variant = 'text',
      width,
      height,
      lines = 1,
      animate = true,
      size = 'md',
      className,
      children,
    },
    ref
  ) {
    const [state] = useReducer(skeletonReducer, skeletonInitialState);

    const defaultDimensions = {
      text: { width: '100%', height: '1em' },
      circular: { width: '40px', height: '40px' },
      rectangular: { width: '100%', height: '120px' },
    };

    const resolvedWidth = width || defaultDimensions[variant].width;
    const resolvedHeight = height || defaultDimensions[variant].height;

    return (
      <div
        ref={ref}
        className={className}
        role="presentation"
        aria-hidden="true"
        data-surface-widget=""
        data-widget-name="skeleton"
        data-part="skeleton"
        data-variant={variant}
        data-animate={animate ? 'true' : 'false'}
        data-state={state.current}
        data-size={size}
      >
        {variant === 'text' && (
          Array.from({ length: lines }, (_, i) => (
            <div
              key={i}
              data-part="line"
              data-variant="text"
              data-visible="true"
              data-count={lines}
              aria-hidden="true"
              style={{ width: resolvedWidth, height: resolvedHeight }}
            />
          ))
        )}
        {variant === 'circular' && (
          <div
            data-part="circle"
            data-variant="circular"
            data-visible="true"
            aria-hidden="true"
            style={{
              width: resolvedWidth,
              height: resolvedHeight,
              borderRadius: '50%',
            }}
          />
        )}
        {variant === 'rectangular' && (
          <div
            data-part="rect"
            data-variant="rectangular"
            data-visible="true"
            aria-hidden="true"
            style={{ width: resolvedWidth, height: resolvedHeight }}
          />
        )}
        {children}
      </div>
    );
  }
);

Skeleton.displayName = 'Skeleton';
export default Skeleton;
