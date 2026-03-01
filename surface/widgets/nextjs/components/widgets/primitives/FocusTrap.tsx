'use client';
import { forwardRef, useEffect, useRef, useCallback, type ReactNode } from 'react';

// Props from focus-trap.widget spec
export interface FocusTrapProps {
  active?: boolean;
  initialFocus?: string;
  returnFocus?: boolean;
  loop?: boolean;
  children?: ReactNode;
  className?: string;
}

const sentinelStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  border: 0,
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(
    (el) => !el.hasAttribute('data-focus-sentinel')
  );
}

export const FocusTrap = forwardRef<HTMLDivElement, FocusTrapProps>(
  function FocusTrap(
    {
      active = false,
      initialFocus,
      returnFocus = true,
      loop = true,
      children,
      className,
    },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<Element | null>(null);

    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    // Activate trap: save previous focus, focus initial element
    useEffect(() => {
      if (!active || !rootRef.current) return;

      previousFocusRef.current = document.activeElement;

      const focusInitial = () => {
        if (initialFocus && rootRef.current) {
          const target = rootRef.current.querySelector<HTMLElement>(initialFocus);
          if (target) {
            target.focus();
            return;
          }
        }
        // Focus first focusable element
        if (rootRef.current) {
          const focusable = getFocusableElements(rootRef.current);
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(focusInitial);

      return () => {
        // Restore focus on deactivation
        if (returnFocus && previousFocusRef.current instanceof HTMLElement) {
          previousFocusRef.current.focus();
        }
      };
    }, [active, initialFocus, returnFocus]);

    const handleSentinelStartFocus = useCallback(() => {
      if (!active || !loop || !rootRef.current) return;
      // Focus last focusable element
      const focusable = getFocusableElements(rootRef.current);
      if (focusable.length > 0) {
        focusable[focusable.length - 1].focus();
      }
    }, [active, loop]);

    const handleSentinelEndFocus = useCallback(() => {
      if (!active || !loop || !rootRef.current) return;
      // Focus first focusable element
      const focusable = getFocusableElements(rootRef.current);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }, [active, loop]);

    return (
      <div
        ref={setRef}
        className={className}
        data-surface-widget=""
        data-widget-name="focus-trap"
        data-part="root"
        data-state={active ? 'active' : 'inactive'}
        data-focus-trap={active ? 'true' : 'false'}
      >
        <span
          data-part="sentinel-start"
          data-focus-sentinel=""
          tabIndex={active ? 0 : -1}
          aria-hidden="true"
          style={sentinelStyle}
          onFocus={handleSentinelStartFocus}
        />
        {children}
        <span
          data-part="sentinel-end"
          data-focus-sentinel=""
          tabIndex={active ? 0 : -1}
          aria-hidden="true"
          style={sentinelStyle}
          onFocus={handleSentinelEndFocus}
        />
      </div>
    );
  }
);

FocusTrap.displayName = 'FocusTrap';
export default FocusTrap;
