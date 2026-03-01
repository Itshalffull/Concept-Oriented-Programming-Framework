'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { alertReducer } from './Alert.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /** Status variant controlling icon and ARIA role. */
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Whether the alert can be dismissed by the user. */
  closable?: boolean;
  /** Primary alert message. */
  title?: ReactNode;
  /** Optional secondary detail or guidance text. */
  description?: ReactNode;
  /** Icon element rendered in the icon slot. */
  icon?: ReactNode;
  /** Callback invoked when the alert is dismissed. */
  onDismiss?: () => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    variant = 'info',
    closable = false,
    title,
    description,
    icon,
    onDismiss,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(alertReducer, 'visible');
  const titleId = useId();
  const descriptionId = useId();

  const handleDismiss = useCallback(() => {
    send({ type: 'DISMISS' });
    onDismiss?.();
  }, [onDismiss]);

  if (state === 'dismissed') return null;

  const role = variant === 'info' ? 'status' : 'alert';
  const ariaLive = variant === 'info' ? 'polite' : 'assertive';

  return (
    <div
      ref={ref}
      role={role}
      aria-live={ariaLive}
      aria-atomic
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      data-part="root"
      data-state={state}
      data-variant={variant}
      data-surface-widget=""
      data-widget-name="alert"
      {...rest}
    >
      {icon && (
        <span data-part="icon" data-variant={variant} aria-hidden="true">
          {icon}
        </span>
      )}

      <div data-part="content" data-variant={variant}>
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
      </div>

      {closable && (
        <button
          type="button"
          data-part="close-trigger"
          aria-label="Dismiss alert"
          onClick={handleDismiss}
        >
          &#x2715;
        </button>
      )}
    </div>
  );
});

Alert.displayName = 'Alert';
export { Alert };
export default Alert;
