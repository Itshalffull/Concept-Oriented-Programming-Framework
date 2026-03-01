/* ---------------------------------------------------------------------------
 * State machine
 * States: empty (initial), hasToasts
 * Events: TOAST_ADDED, TOAST_REMOVED, ALL_REMOVED
 * ------------------------------------------------------------------------- */

export interface ToastManagerMachineState {
  state: 'empty' | 'hasToasts';
  toasts: ToastManagerItem[];
}

export interface ToastManagerItem {
  id: string;
  content: unknown;
}

export type ToastManagerEvent =
  | { type: 'TOAST_ADDED'; toast: ToastManagerItem }
  | { type: 'TOAST_REMOVED'; id: string }
  | { type: 'ALL_REMOVED' };

export const toastManagerInitialState: ToastManagerMachineState = {
  state: 'empty',
  toasts: [],
};

export function toastManagerReducer(
  current: ToastManagerMachineState,
  event: ToastManagerEvent,
): ToastManagerMachineState {
  switch (event.type) {
    case 'TOAST_ADDED': {
      const toasts = [...current.toasts, event.toast];
      return { state: 'hasToasts', toasts };
    }
    case 'TOAST_REMOVED': {
      const toasts = current.toasts.filter((t) => t.id !== event.id);
      return { state: toasts.length > 0 ? 'hasToasts' : 'empty', toasts };
    }
    case 'ALL_REMOVED':
      return { state: 'empty', toasts: [] };
    default:
      return current;
  }
}
