'use client';
import { forwardRef, useEffect, useRef, type ReactNode } from 'react';

// Props from scroll-lock.widget spec
export interface ScrollLockProps {
  active?: boolean;
  preserveScrollbarGap?: boolean;
  children?: ReactNode;
  className?: string;
}

export const ScrollLock = forwardRef<HTMLDivElement, ScrollLockProps>(
  function ScrollLock(
    {
      active = false,
      preserveScrollbarGap = true,
      children,
      className,
    },
    ref
  ) {
    const scrollPositionRef = useRef(0);

    useEffect(() => {
      if (!active) return;

      // Save scroll position
      scrollPositionRef.current = window.scrollY;

      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      // Disable body scroll
      document.body.style.overflow = 'hidden';

      // Preserve scrollbar gap to prevent layout shift
      if (preserveScrollbarGap) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }

      return () => {
        // Restore body scroll
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;

        // Restore scroll position
        window.scrollTo(0, scrollPositionRef.current);
      };
    }, [active, preserveScrollbarGap]);

    return (
      <div
        ref={ref}
        className={className}
        data-surface-widget=""
        data-widget-name="scroll-lock"
        data-part="root"
        data-state={active ? 'locked' : 'unlocked'}
        data-scroll-lock={active ? 'true' : 'false'}
        data-preserve-gap={preserveScrollbarGap ? 'true' : 'false'}
      >
        {children}
      </div>
    );
  }
);

ScrollLock.displayName = 'ScrollLock';
export default ScrollLock;
