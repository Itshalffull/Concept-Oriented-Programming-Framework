'use client';
import { forwardRef, useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Props from portal.widget spec
export interface PortalProps {
  target?: string;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

export const Portal = forwardRef<HTMLDivElement, PortalProps>(
  function Portal(
    {
      target,
      disabled = false,
      children,
      className,
    },
    ref
  ) {
    const [mounted, setMounted] = useState(false);
    const [container, setContainer] = useState<Element | null>(null);

    useEffect(() => {
      setMounted(true);
      if (target) {
        const el = document.querySelector(target);
        setContainer(el || document.body);
      } else {
        setContainer(document.body);
      }
      return () => setMounted(false);
    }, [target]);

    if (disabled || !mounted || !container) {
      return (
        <div
          ref={ref}
          className={className}
          data-surface-widget=""
          data-widget-name="portal"
          data-part="root"
          data-portal="true"
          data-target={target}
          data-state={disabled ? 'unmounted' : 'unmounted'}
          data-disabled={disabled ? 'true' : 'false'}
        >
          {children}
        </div>
      );
    }

    return createPortal(
      <div
        ref={ref}
        className={className}
        data-surface-widget=""
        data-widget-name="portal"
        data-part="root"
        data-portal="true"
        data-target={target}
        data-state="mounted"
        data-disabled="false"
      >
        {children}
      </div>,
      container
    );
  }
);

Portal.displayName = 'Portal';
export default Portal;
