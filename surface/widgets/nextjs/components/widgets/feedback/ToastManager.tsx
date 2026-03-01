'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { toastManagerReducer, toastManagerInitialState } from './ToastManager.reducer.js';

/* ---------------------------------------------------------------------------
 * Toast item type
 * ------------------------------------------------------------------------- */

export interface ToastItem {
  id: string;
  content: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ToastManagerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Viewport edge placement for the toast stack. */
  placement?: string;
  /** Maximum number of visible toasts. */
  max?: number;
  /** Gap in px between stacked toasts. */
  gap?: number;
  /** Initial list of toasts. */
  toasts?: ToastItem[];
  /** Callback invoked when a toast is dismissed. */
  onToastDismiss?: (id: string) => void;
  /** Render function for each toast item. */
  renderToast?: (item: ToastItem, onDismiss: () => void) => ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ToastManager = forwardRef<HTMLDivElement, ToastManagerProps>(function ToastManager(
  {
    placement = 'bottom-right',
    max = 5,
    gap = 8,
    toasts: controlledToasts,
    onToastDismiss,
    renderToast,
    ...rest
  },
  ref,
) {
  const [{ state, toasts: internalToasts }, send] = useReducer(toastManagerReducer, toastManagerInitialState);

  const toasts = controlledToasts ?? internalToasts;
  const visibleToasts = toasts.slice(-max);
  const machineState = toasts.length > 0 ? 'hasToasts' : 'empty';

  const handleDismiss = useCallback(
    (id: string) => {
      send({ type: 'TOAST_REMOVED', id });
      onToastDismiss?.(id);
    },
    [onToastDismiss],
  );

  return (
    <div
      ref={ref}
      role="region"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Notifications"
      data-part="root"
      data-state={machineState}
      data-placement={placement}
      data-surface-widget=""
      data-widget-name="toast-manager"
      style={{ gap }}
      {...rest}
    >
      <div
        data-part="list"
        data-placement={placement}
        data-count={visibleToasts.length}
        style={{ display: 'flex', flexDirection: 'column', gap }}
      >
        {visibleToasts.map((item, index) => (
          <div key={item.id} data-part="item" data-index={index}>
            {renderToast
              ? renderToast(item, () => handleDismiss(item.id))
              : item.content}
          </div>
        ))}
      </div>
    </div>
  );
});

ToastManager.displayName = 'ToastManager';
export { ToastManager };
export default ToastManager;
