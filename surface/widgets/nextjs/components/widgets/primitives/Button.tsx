'use client';
import { forwardRef, useReducer, useCallback, type ReactNode } from 'react';
import { buttonReducer, type ButtonState, type ButtonEvent } from './Button.reducer.js';

// Props from button.widget spec
export interface ButtonProps {
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  iconPosition?: 'start' | 'end';
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'filled',
      size = 'md',
      disabled = false,
      loading = false,
      type = 'button',
      iconPosition = 'start',
      onClick,
      children,
      className,
    },
    ref
  ) {
    const [state, send] = useReducer(buttonReducer, 'idle');

    const handleClick = useCallback(() => {
      if (!disabled && !loading) onClick?.();
    }, [disabled, loading, onClick]);

    const dataState = loading ? 'loading' : disabled ? 'disabled' : state;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={className}
        onClick={handleClick}
        onMouseEnter={() => send({ type: 'HOVER' })}
        onMouseLeave={() => send({ type: 'UNHOVER' })}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
        onPointerDown={() => send({ type: 'PRESS' })}
        onPointerUp={() => send({ type: 'RELEASE' })}
        role="button"
        aria-disabled={disabled || loading}
        aria-busy={loading}
        tabIndex={disabled ? -1 : 0}
        data-surface-widget=""
        data-widget-name="button"
        data-part="root"
        data-state={dataState}
        data-variant={variant}
        data-size={size}
      >
        {loading && (
          <span data-part="spinner" aria-hidden={!loading} data-visible={loading}>
            {/* spinner rendered via CSS */}
          </span>
        )}
        <span data-part="icon" data-position={iconPosition} aria-hidden="true" />
        <span data-part="label" data-size={size}>
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
