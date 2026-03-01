'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { useRovingFocus } from '../shared/useRovingFocus.js';
import { useOutsideClick } from '../shared/useOutsideClick.js';
import { visibilityReducer, type VisibilityState } from './FloatingToolbar.reducer.js';

// ---------------------------------------------------------------------------
// FloatingToolbar — Bubble toolbar that appears on text selection or
// contextual trigger. Floats above content with configurable placement.
// Derived from floating-toolbar.widget spec.
// ---------------------------------------------------------------------------

export interface FloatingToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  open?: boolean;
  placement?: string;
  offset?: number;
  autoHide?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  variant?: string;
  size?: string;
}

export const FloatingToolbar = forwardRef<HTMLDivElement, FloatingToolbarProps>(
  function FloatingToolbar(
    {
      open,
      placement = 'top',
      offset = 8,
      autoHide = true,
      onOpenChange,
      children,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const isControlled = open !== undefined;

    const [internalState, dispatch] = useReducer(visibilityReducer, 'hidden');
    const currentState: VisibilityState = isControlled
      ? (open ? 'visible' : 'hidden')
      : internalState;

    const isVisible = currentState === 'visible';
    const dataState = isVisible ? 'visible' : 'hidden';

    const { getItemProps } = useRovingFocus({
      orientation: 'horizontal',
      loop: true,
    });

    const handleHide = useCallback(() => {
      if (!isControlled) {
        dispatch({ type: 'HIDE' });
      }
      onOpenChange?.(false);
    }, [isControlled, onOpenChange]);

    useOutsideClick(rootRef, () => {
      if (autoHide && isVisible) {
        if (!isControlled) {
          dispatch({ type: 'CLICK_OUTSIDE' });
        }
        onOpenChange?.(false);
      }
    }, isVisible);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleHide();
        }
      },
      [handleHide]
    );

    return (
      <div
        ref={(node) => {
          rootRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="toolbar"
        aria-label="Formatting toolbar"
        aria-orientation="horizontal"
        className={className}
        data-surface-widget=""
        data-widget-name="floating-toolbar"
        data-part="root"
        data-state={dataState}
        data-placement={placement}
        data-variant={variant}
        data-size={size}
        hidden={!isVisible}
        style={{ position: 'absolute' }}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <div
          data-part="content"
          data-state={dataState}
        >
          {children}
        </div>
      </div>
    );
  }
);

FloatingToolbar.displayName = 'FloatingToolbar';
export default FloatingToolbar;
