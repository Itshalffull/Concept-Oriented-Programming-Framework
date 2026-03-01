'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../shared/useScrollLock.js';
import { useFocusReturn } from '../shared/useFocusReturn.js';
import { drawerReducer } from './Drawer.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DrawerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  /** Controlled open state. */
  open?: boolean;
  /** Edge from which the drawer slides in. */
  placement?: 'left' | 'right' | 'top' | 'bottom';
  /** Size preset for the drawer panel. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when the drawer requests to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Content rendered inside the drawer header region. */
  header?: ReactNode;
  /** Content rendered inside the drawer footer region. */
  footer?: ReactNode;
  /** Main body content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Drawer = forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  {
    open: controlledOpen,
    placement = 'right',
    size = 'md',
    onOpenChange,
    header,
    footer,
    children,
    ...rest
  },
  ref,
) {
  const [internalState, send] = useReducer(drawerReducer, 'closed');
  const isOpen = controlledOpen ?? internalState === 'open';

  const headerId = useId();
  const bodyId = useId();

  useScrollLock(isOpen);
  useFocusReturn(isOpen);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
        onOpenChange?.(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onOpenChange]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        send({ type: 'OUTSIDE_CLICK' });
        onOpenChange?.(false);
      }
    },
    [onOpenChange],
  );

  const handleClose = useCallback(() => {
    send({ type: 'CLOSE' });
    onOpenChange?.(false);
  }, [onOpenChange]);

  if (!isOpen) return null;

  return createPortal(
    <div
      data-part="backdrop"
      data-state="open"
      data-placement={placement}
      data-surface-widget=""
      data-widget-name="drawer"
      onClick={handleOverlayClick}
    >
      <div
        ref={ref}
        data-part="content"
        role="dialog"
        aria-modal
        aria-labelledby={headerId}
        data-state="open"
        data-placement={placement}
        data-size={size}
        {...rest}
      >
        <div data-part="header" id={headerId}>
          {header}
          <button
            type="button"
            data-part="close-trigger"
            aria-label="Close drawer"
            onClick={handleClose}
          >
            &#x2715;
          </button>
        </div>

        <div
          data-part="body"
          id={bodyId}
          tabIndex={0}
          role="document"
        >
          {children}
        </div>

        {footer && (
          <div data-part="footer" data-placement={placement}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
});

Drawer.displayName = 'Drawer';
export { Drawer };
export default Drawer;
