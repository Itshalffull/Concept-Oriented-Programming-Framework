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
import { toastReducer } from './Toast.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Primary notification message. */
  title?: ReactNode;
  /** Optional secondary detail text. */
  description?: ReactNode;
  /** Status variant. */
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Auto-dismiss duration in ms. Set 0 to disable. */
  duration?: number;
  /** Whether the toast shows a close button. */
  closable?: boolean;
  /** Icon element rendered in the icon slot. */
  icon?: ReactNode;
  /** Action element (e.g., an undo button). */
  action?: ReactNode;
  /** Callback invoked when the toast should be removed. */
  onDismiss?: () => void;
  /** Callback invoked when the action button is clicked. */
  onAction?: () => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  {
    title,
    description,
    variant = 'info',
    duration = 5000,
    closable = true,
    icon,
    action,
    onDismiss,
    onAction,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(toastReducer, 'entering');
  const titleId = useId();
  const descriptionId = useId();

  // Auto-transition from entering to visible (simulate animation end)
  useEffect(() => {
    if (state === 'entering') {
      const frame = requestAnimationFrame(() => send({ type: 'ANIMATION_END' }));
      return () => cancelAnimationFrame(frame);
    }
  }, [state]);

  // Auto-dismiss timer
  useEffect(() => {
    if (state === 'visible' && duration && duration > 0) {
      const timer = setTimeout(() => send({ type: 'TIMEOUT' }), duration);
      return () => clearTimeout(timer);
    }
  }, [state, duration]);

  // Transition from exiting to removed
  useEffect(() => {
    if (state === 'exiting') {
      const frame = requestAnimationFrame(() => send({ type: 'ANIMATION_END' }));
      return () => cancelAnimationFrame(frame);
    }
  }, [state]);

  // Notify parent when removed
  useEffect(() => {
    if (state === 'removed') {
      onDismiss?.();
    }
  }, [state, onDismiss]);

  if (state === 'removed') return null;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-atomic
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      data-part="root"
      data-state={state}
      data-variant={variant}
      data-surface-widget=""
      data-widget-name="toast"
      onPointerEnter={() => send({ type: 'POINTER_ENTER' })}
      onPointerLeave={() => send({ type: 'POINTER_LEAVE' })}
      {...rest}
    >
      {icon && (
        <span data-part="icon" data-variant={variant} aria-hidden="true">
          {icon}
        </span>
      )}

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

      {action && (
        <div data-part="action" data-variant={variant} onClick={onAction}>
          {action}
        </div>
      )}

      {closable && (
        <button
          type="button"
          data-part="close-trigger"
          aria-label="Dismiss notification"
          onClick={() => send({ type: 'CLOSE' })}
        >
          &#x2715;
        </button>
      )}
    </div>
  );
});

Toast.displayName = 'Toast';
export { Toast };
export default Toast;
