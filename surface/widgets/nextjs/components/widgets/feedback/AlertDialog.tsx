'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../shared/useScrollLock.js';
import { useFocusReturn } from '../shared/useFocusReturn.js';
import { alertDialogReducer } from './AlertDialog.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface AlertDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  /** Controlled open state. */
  open?: boolean;
  /** Callback when the dialog requests to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Callback invoked when the user confirms. */
  onConfirm?: () => void;
  /** Callback invoked when the user cancels. */
  onCancel?: () => void;
  /** Alert dialog title. */
  title?: ReactNode;
  /** Alert dialog description explaining the action and consequences. */
  description?: ReactNode;
  /** Custom cancel button content. */
  cancelLabel?: ReactNode;
  /** Custom confirm button content. */
  confirmLabel?: ReactNode;
  /** Dialog body content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const AlertDialog = forwardRef<HTMLDivElement, AlertDialogProps>(function AlertDialog(
  {
    open: controlledOpen,
    onOpenChange,
    onConfirm,
    onCancel,
    title,
    description,
    cancelLabel = 'Cancel',
    confirmLabel = 'Confirm',
    children,
    ...rest
  },
  ref,
) {
  const [internalState, send] = useReducer(alertDialogReducer, 'closed');
  const isOpen = controlledOpen ?? internalState === 'open';

  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useScrollLock(isOpen);
  useFocusReturn(isOpen);

  // Focus the cancel button on open (per spec: initial focus goes to cancel)
  useEffect(() => {
    if (isOpen) {
      // Defer to allow portal to mount
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    send({ type: 'CANCEL' });
    onCancel?.();
    onOpenChange?.(false);
  }, [onCancel, onOpenChange]);

  const handleConfirm = useCallback(() => {
    send({ type: 'CONFIRM' });
    onConfirm?.();
    onOpenChange?.(false);
  }, [onConfirm, onOpenChange]);

  if (!isOpen) return null;

  return createPortal(
    <div
      data-part="backdrop"
      data-state="open"
      data-role="alertdialog"
      data-surface-widget=""
      data-widget-name="alert-dialog"
      aria-hidden
    >
      <div data-part="positioner" data-state="open">
        <div
          ref={ref}
          data-part="content"
          role="alertdialog"
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
          <div data-part="actions">
            <button
              ref={cancelRef}
              type="button"
              data-part="cancel"
              aria-label="Cancel"
              onClick={handleCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              data-part="confirm"
              aria-label="Confirm"
              onClick={handleConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
});

AlertDialog.displayName = 'AlertDialog';
export { AlertDialog };
export default AlertDialog;
