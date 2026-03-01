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
import { dialogReducer } from './Dialog.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  /** Controlled open state. */
  open?: boolean;
  /** Whether clicking the backdrop closes the dialog. */
  closeOnOutsideClick?: boolean;
  /** Whether pressing Escape closes the dialog. */
  closeOnEscape?: boolean;
  /** ARIA role override. */
  dialogRole?: 'dialog' | 'alertdialog';
  /** Callback when the dialog requests to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title. */
  title?: ReactNode;
  /** Dialog description. */
  description?: ReactNode;
  /** Dialog body content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Dialog = forwardRef<HTMLDivElement, DialogProps>(function Dialog(
  {
    open: controlledOpen,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    dialogRole = 'dialog',
    onOpenChange,
    title,
    description,
    children,
    ...rest
  },
  ref,
) {
  const [internalState, send] = useReducer(dialogReducer, 'closed');
  const isOpen = controlledOpen ?? internalState === 'open';

  const titleId = useId();
  const descriptionId = useId();

  useScrollLock(isOpen);
  useFocusReturn(isOpen);

  // Escape key handler
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
        onOpenChange?.(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeOnEscape, onOpenChange]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && closeOnOutsideClick) {
        send({ type: 'OUTSIDE_CLICK' });
        onOpenChange?.(false);
      }
    },
    [closeOnOutsideClick, onOpenChange],
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
      data-role={dialogRole}
      data-surface-widget=""
      data-widget-name="dialog"
      onClick={handleOverlayClick}
    >
      <div data-part="positioner" data-state="open">
        <div
          ref={ref}
          data-part="content"
          role={dialogRole}
          aria-modal
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          data-state="open"
          {...rest}
        >
          {title && (
            <div data-part="title" id={titleId}>
              {title}
            </div>
          )}
          {description && (
            <div data-part="description" id={descriptionId}>
              {description}
            </div>
          )}
          {children}
          <button
            type="button"
            data-part="close-trigger"
            aria-label="Close"
            onClick={handleClose}
          >
            &#x2715;
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});

Dialog.displayName = 'Dialog';
export { Dialog };
export default Dialog;
