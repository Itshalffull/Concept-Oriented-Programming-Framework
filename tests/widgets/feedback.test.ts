import { describe, it, expect } from 'vitest';
import { alertReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/Alert.reducer.js';
import { alertDialogReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/AlertDialog.reducer.js';
import { contextMenuReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/ContextMenu.reducer.js';
import { dialogReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/Dialog.reducer.js';
import { drawerReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/Drawer.reducer.js';
import { hoverCardReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/HoverCard.reducer.js';
import { popoverReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/Popover.reducer.js';
import { toastReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/Toast.reducer.js';
import {
  toastManagerReducer,
  toastManagerInitialState,
} from '../../surface/widgets/nextjs/components/widgets/feedback/ToastManager.reducer.js';
import { tooltipReducer } from '../../surface/widgets/nextjs/components/widgets/feedback/Tooltip.reducer.js';

/* ===========================================================================
 * Alert
 * ========================================================================= */

describe('Alert', () => {
  describe('alertReducer', () => {
    it('starts in visible state', () => {
      const state = alertReducer('visible', { type: 'DISMISS' });
      // Confirm it processes from 'visible' correctly
      expect(state).toBe('dismissed');
    });

    it('transitions from visible to dismissed on DISMISS', () => {
      expect(alertReducer('visible', { type: 'DISMISS' })).toBe('dismissed');
    });

    it('stays in dismissed when receiving DISMISS', () => {
      expect(alertReducer('dismissed', { type: 'DISMISS' })).toBe('dismissed');
    });

    it('stays in visible for unknown event types', () => {
      // Force an unknown event type to test the default branch
      expect(alertReducer('visible', { type: 'UNKNOWN' } as any)).toBe('visible');
    });

    it('stays in dismissed for unknown event types', () => {
      expect(alertReducer('dismissed', { type: 'UNKNOWN' } as any)).toBe('dismissed');
    });
  });
});

/* ===========================================================================
 * AlertDialog
 * ========================================================================= */

describe('AlertDialog', () => {
  describe('alertDialogReducer', () => {
    it('starts in closed state by default', () => {
      // Verify initial closed state handles CANCEL without changing
      expect(alertDialogReducer('closed', { type: 'CANCEL' })).toBe('closed');
    });

    it('transitions from closed to open on OPEN', () => {
      expect(alertDialogReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('stays closed on CANCEL when already closed', () => {
      expect(alertDialogReducer('closed', { type: 'CANCEL' })).toBe('closed');
    });

    it('stays closed on CONFIRM when already closed', () => {
      expect(alertDialogReducer('closed', { type: 'CONFIRM' })).toBe('closed');
    });

    it('transitions from open to closed on CANCEL', () => {
      expect(alertDialogReducer('open', { type: 'CANCEL' })).toBe('closed');
    });

    it('transitions from open to closed on CONFIRM', () => {
      expect(alertDialogReducer('open', { type: 'CONFIRM' })).toBe('closed');
    });

    it('stays open on OPEN when already open', () => {
      expect(alertDialogReducer('open', { type: 'OPEN' })).toBe('open');
    });

    it('ignores unknown event types in closed state', () => {
      expect(alertDialogReducer('closed', { type: 'UNKNOWN' } as any)).toBe('closed');
    });

    it('ignores unknown event types in open state', () => {
      expect(alertDialogReducer('open', { type: 'UNKNOWN' } as any)).toBe('open');
    });
  });
});

/* ===========================================================================
 * ContextMenu
 * ========================================================================= */

describe('ContextMenu', () => {
  describe('contextMenuReducer', () => {
    it('starts in closed state', () => {
      expect(contextMenuReducer('closed', { type: 'SELECT' })).toBe('closed');
    });

    it('transitions from closed to open on CONTEXT_MENU', () => {
      expect(contextMenuReducer('closed', { type: 'CONTEXT_MENU' })).toBe('open');
    });

    it('stays closed on SELECT when closed', () => {
      expect(contextMenuReducer('closed', { type: 'SELECT' })).toBe('closed');
    });

    it('stays closed on ESCAPE when closed', () => {
      expect(contextMenuReducer('closed', { type: 'ESCAPE' })).toBe('closed');
    });

    it('stays closed on OUTSIDE_CLICK when closed', () => {
      expect(contextMenuReducer('closed', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('transitions from open to closed on SELECT', () => {
      expect(contextMenuReducer('open', { type: 'SELECT' })).toBe('closed');
    });

    it('transitions from open to closed on ESCAPE', () => {
      expect(contextMenuReducer('open', { type: 'ESCAPE' })).toBe('closed');
    });

    it('transitions from open to closed on OUTSIDE_CLICK', () => {
      expect(contextMenuReducer('open', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('stays open on CONTEXT_MENU when already open', () => {
      expect(contextMenuReducer('open', { type: 'CONTEXT_MENU' })).toBe('open');
    });

    it('ignores unknown event types in open state', () => {
      expect(contextMenuReducer('open', { type: 'UNKNOWN' } as any)).toBe('open');
    });
  });
});

/* ===========================================================================
 * Dialog
 * ========================================================================= */

describe('Dialog', () => {
  describe('dialogReducer', () => {
    it('starts in closed state', () => {
      expect(dialogReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from closed to open on OPEN', () => {
      expect(dialogReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('stays closed on CLOSE when already closed', () => {
      expect(dialogReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('stays closed on OUTSIDE_CLICK when already closed', () => {
      expect(dialogReducer('closed', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('stays closed on ESCAPE when already closed', () => {
      expect(dialogReducer('closed', { type: 'ESCAPE' })).toBe('closed');
    });

    it('transitions from open to closed on CLOSE', () => {
      expect(dialogReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from open to closed on OUTSIDE_CLICK', () => {
      expect(dialogReducer('open', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('transitions from open to closed on ESCAPE', () => {
      expect(dialogReducer('open', { type: 'ESCAPE' })).toBe('closed');
    });

    it('stays open on OPEN when already open', () => {
      expect(dialogReducer('open', { type: 'OPEN' })).toBe('open');
    });

    it('ignores unknown event types', () => {
      expect(dialogReducer('open', { type: 'UNKNOWN' } as any)).toBe('open');
      expect(dialogReducer('closed', { type: 'UNKNOWN' } as any)).toBe('closed');
    });
  });
});

/* ===========================================================================
 * Drawer
 * ========================================================================= */

describe('Drawer', () => {
  describe('drawerReducer', () => {
    it('starts in closed state', () => {
      expect(drawerReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from closed to open on OPEN', () => {
      expect(drawerReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('stays closed on CLOSE when already closed', () => {
      expect(drawerReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('stays closed on OUTSIDE_CLICK when already closed', () => {
      expect(drawerReducer('closed', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('stays closed on ESCAPE when already closed', () => {
      expect(drawerReducer('closed', { type: 'ESCAPE' })).toBe('closed');
    });

    it('transitions from open to closed on CLOSE', () => {
      expect(drawerReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from open to closed on OUTSIDE_CLICK', () => {
      expect(drawerReducer('open', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('transitions from open to closed on ESCAPE', () => {
      expect(drawerReducer('open', { type: 'ESCAPE' })).toBe('closed');
    });

    it('stays open on OPEN when already open', () => {
      expect(drawerReducer('open', { type: 'OPEN' })).toBe('open');
    });

    it('ignores unknown event types', () => {
      expect(drawerReducer('open', { type: 'UNKNOWN' } as any)).toBe('open');
      expect(drawerReducer('closed', { type: 'UNKNOWN' } as any)).toBe('closed');
    });
  });
});

/* ===========================================================================
 * HoverCard
 * ========================================================================= */

describe('HoverCard', () => {
  describe('hoverCardReducer', () => {
    it('starts in hidden state', () => {
      expect(hoverCardReducer('hidden', { type: 'ESCAPE' })).toBe('hidden');
    });

    // hidden -> opening
    it('transitions from hidden to opening on POINTER_ENTER', () => {
      expect(hoverCardReducer('hidden', { type: 'POINTER_ENTER' })).toBe('opening');
    });

    it('transitions from hidden to opening on FOCUS', () => {
      expect(hoverCardReducer('hidden', { type: 'FOCUS' })).toBe('opening');
    });

    it('stays hidden on POINTER_LEAVE', () => {
      expect(hoverCardReducer('hidden', { type: 'POINTER_LEAVE' })).toBe('hidden');
    });

    it('stays hidden on BLUR', () => {
      expect(hoverCardReducer('hidden', { type: 'BLUR' })).toBe('hidden');
    });

    it('stays hidden on ESCAPE', () => {
      expect(hoverCardReducer('hidden', { type: 'ESCAPE' })).toBe('hidden');
    });

    it('stays hidden on DELAY_ELAPSED', () => {
      expect(hoverCardReducer('hidden', { type: 'DELAY_ELAPSED' })).toBe('hidden');
    });

    // opening -> open
    it('transitions from opening to open on DELAY_ELAPSED', () => {
      expect(hoverCardReducer('opening', { type: 'DELAY_ELAPSED' })).toBe('open');
    });

    // opening -> hidden
    it('transitions from opening to hidden on POINTER_LEAVE', () => {
      expect(hoverCardReducer('opening', { type: 'POINTER_LEAVE' })).toBe('hidden');
    });

    it('transitions from opening to hidden on BLUR', () => {
      expect(hoverCardReducer('opening', { type: 'BLUR' })).toBe('hidden');
    });

    it('stays in opening on POINTER_ENTER', () => {
      expect(hoverCardReducer('opening', { type: 'POINTER_ENTER' })).toBe('opening');
    });

    it('stays in opening on FOCUS', () => {
      expect(hoverCardReducer('opening', { type: 'FOCUS' })).toBe('opening');
    });

    it('stays in opening on ESCAPE', () => {
      expect(hoverCardReducer('opening', { type: 'ESCAPE' })).toBe('opening');
    });

    // open -> closing
    it('transitions from open to closing on POINTER_LEAVE', () => {
      expect(hoverCardReducer('open', { type: 'POINTER_LEAVE' })).toBe('closing');
    });

    it('transitions from open to closing on BLUR', () => {
      expect(hoverCardReducer('open', { type: 'BLUR' })).toBe('closing');
    });

    // open -> hidden
    it('transitions from open to hidden on ESCAPE', () => {
      expect(hoverCardReducer('open', { type: 'ESCAPE' })).toBe('hidden');
    });

    it('stays open on POINTER_ENTER', () => {
      expect(hoverCardReducer('open', { type: 'POINTER_ENTER' })).toBe('open');
    });

    it('stays open on FOCUS', () => {
      expect(hoverCardReducer('open', { type: 'FOCUS' })).toBe('open');
    });

    it('stays open on DELAY_ELAPSED', () => {
      expect(hoverCardReducer('open', { type: 'DELAY_ELAPSED' })).toBe('open');
    });

    // closing -> hidden
    it('transitions from closing to hidden on DELAY_ELAPSED', () => {
      expect(hoverCardReducer('closing', { type: 'DELAY_ELAPSED' })).toBe('hidden');
    });

    // closing -> open
    it('transitions from closing to open on POINTER_ENTER', () => {
      expect(hoverCardReducer('closing', { type: 'POINTER_ENTER' })).toBe('open');
    });

    it('transitions from closing to open on FOCUS', () => {
      expect(hoverCardReducer('closing', { type: 'FOCUS' })).toBe('open');
    });

    it('stays in closing on ESCAPE', () => {
      expect(hoverCardReducer('closing', { type: 'ESCAPE' })).toBe('closing');
    });

    it('stays in closing on BLUR', () => {
      expect(hoverCardReducer('closing', { type: 'BLUR' })).toBe('closing');
    });

    it('stays in closing on POINTER_LEAVE', () => {
      expect(hoverCardReducer('closing', { type: 'POINTER_LEAVE' })).toBe('closing');
    });

    it('ignores unknown event types', () => {
      expect(hoverCardReducer('hidden', { type: 'UNKNOWN' } as any)).toBe('hidden');
      expect(hoverCardReducer('open', { type: 'UNKNOWN' } as any)).toBe('open');
    });
  });
});

/* ===========================================================================
 * Popover
 * ========================================================================= */

describe('Popover', () => {
  describe('popoverReducer', () => {
    it('starts in closed state', () => {
      expect(popoverReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from closed to open on OPEN', () => {
      expect(popoverReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('transitions from closed to open on TRIGGER_CLICK', () => {
      expect(popoverReducer('closed', { type: 'TRIGGER_CLICK' })).toBe('open');
    });

    it('stays closed on CLOSE when already closed', () => {
      expect(popoverReducer('closed', { type: 'CLOSE' })).toBe('closed');
    });

    it('stays closed on OUTSIDE_CLICK when already closed', () => {
      expect(popoverReducer('closed', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('stays closed on ESCAPE when already closed', () => {
      expect(popoverReducer('closed', { type: 'ESCAPE' })).toBe('closed');
    });

    it('transitions from open to closed on CLOSE', () => {
      expect(popoverReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('transitions from open to closed on OUTSIDE_CLICK', () => {
      expect(popoverReducer('open', { type: 'OUTSIDE_CLICK' })).toBe('closed');
    });

    it('transitions from open to closed on ESCAPE', () => {
      expect(popoverReducer('open', { type: 'ESCAPE' })).toBe('closed');
    });

    it('transitions from open to closed on TRIGGER_CLICK (toggle)', () => {
      expect(popoverReducer('open', { type: 'TRIGGER_CLICK' })).toBe('closed');
    });

    it('stays open on OPEN when already open', () => {
      expect(popoverReducer('open', { type: 'OPEN' })).toBe('open');
    });

    it('ignores unknown event types', () => {
      expect(popoverReducer('open', { type: 'UNKNOWN' } as any)).toBe('open');
      expect(popoverReducer('closed', { type: 'UNKNOWN' } as any)).toBe('closed');
    });
  });
});

/* ===========================================================================
 * Toast
 * ========================================================================= */

describe('Toast', () => {
  describe('toastReducer', () => {
    // entering state
    it('transitions from entering to visible on ANIMATION_END', () => {
      expect(toastReducer('entering', { type: 'ANIMATION_END' })).toBe('visible');
    });

    it('stays in entering on POINTER_ENTER', () => {
      expect(toastReducer('entering', { type: 'POINTER_ENTER' })).toBe('entering');
    });

    it('stays in entering on POINTER_LEAVE', () => {
      expect(toastReducer('entering', { type: 'POINTER_LEAVE' })).toBe('entering');
    });

    it('stays in entering on DISMISS', () => {
      expect(toastReducer('entering', { type: 'DISMISS' })).toBe('entering');
    });

    it('stays in entering on TIMEOUT', () => {
      expect(toastReducer('entering', { type: 'TIMEOUT' })).toBe('entering');
    });

    it('stays in entering on CLOSE', () => {
      expect(toastReducer('entering', { type: 'CLOSE' })).toBe('entering');
    });

    // visible state
    it('transitions from visible to paused on POINTER_ENTER', () => {
      expect(toastReducer('visible', { type: 'POINTER_ENTER' })).toBe('paused');
    });

    it('transitions from visible to exiting on DISMISS', () => {
      expect(toastReducer('visible', { type: 'DISMISS' })).toBe('exiting');
    });

    it('transitions from visible to exiting on TIMEOUT', () => {
      expect(toastReducer('visible', { type: 'TIMEOUT' })).toBe('exiting');
    });

    it('transitions from visible to exiting on CLOSE', () => {
      expect(toastReducer('visible', { type: 'CLOSE' })).toBe('exiting');
    });

    it('stays in visible on POINTER_LEAVE', () => {
      expect(toastReducer('visible', { type: 'POINTER_LEAVE' })).toBe('visible');
    });

    it('stays in visible on ANIMATION_END', () => {
      expect(toastReducer('visible', { type: 'ANIMATION_END' })).toBe('visible');
    });

    // paused state
    it('transitions from paused to visible on POINTER_LEAVE', () => {
      expect(toastReducer('paused', { type: 'POINTER_LEAVE' })).toBe('visible');
    });

    it('transitions from paused to exiting on DISMISS', () => {
      expect(toastReducer('paused', { type: 'DISMISS' })).toBe('exiting');
    });

    it('transitions from paused to exiting on CLOSE', () => {
      expect(toastReducer('paused', { type: 'CLOSE' })).toBe('exiting');
    });

    it('stays in paused on POINTER_ENTER', () => {
      expect(toastReducer('paused', { type: 'POINTER_ENTER' })).toBe('paused');
    });

    it('stays in paused on TIMEOUT', () => {
      expect(toastReducer('paused', { type: 'TIMEOUT' })).toBe('paused');
    });

    it('stays in paused on ANIMATION_END', () => {
      expect(toastReducer('paused', { type: 'ANIMATION_END' })).toBe('paused');
    });

    // exiting state
    it('transitions from exiting to removed on ANIMATION_END', () => {
      expect(toastReducer('exiting', { type: 'ANIMATION_END' })).toBe('removed');
    });

    it('stays in exiting on DISMISS', () => {
      expect(toastReducer('exiting', { type: 'DISMISS' })).toBe('exiting');
    });

    it('stays in exiting on POINTER_ENTER', () => {
      expect(toastReducer('exiting', { type: 'POINTER_ENTER' })).toBe('exiting');
    });

    it('stays in exiting on POINTER_LEAVE', () => {
      expect(toastReducer('exiting', { type: 'POINTER_LEAVE' })).toBe('exiting');
    });

    it('stays in exiting on TIMEOUT', () => {
      expect(toastReducer('exiting', { type: 'TIMEOUT' })).toBe('exiting');
    });

    it('stays in exiting on CLOSE', () => {
      expect(toastReducer('exiting', { type: 'CLOSE' })).toBe('exiting');
    });

    // removed state
    it('stays in removed on any event', () => {
      expect(toastReducer('removed', { type: 'ANIMATION_END' })).toBe('removed');
      expect(toastReducer('removed', { type: 'DISMISS' })).toBe('removed');
      expect(toastReducer('removed', { type: 'POINTER_ENTER' })).toBe('removed');
      expect(toastReducer('removed', { type: 'POINTER_LEAVE' })).toBe('removed');
      expect(toastReducer('removed', { type: 'TIMEOUT' })).toBe('removed');
      expect(toastReducer('removed', { type: 'CLOSE' })).toBe('removed');
    });

    it('ignores unknown event types', () => {
      expect(toastReducer('visible', { type: 'UNKNOWN' } as any)).toBe('visible');
    });
  });
});

/* ===========================================================================
 * ToastManager
 * ========================================================================= */

describe('ToastManager', () => {
  describe('toastManagerReducer', () => {
    describe('initial state', () => {
      it('has correct initial state shape', () => {
        expect(toastManagerInitialState).toEqual({
          state: 'empty',
          toasts: [],
        });
      });

      it('starts with empty state', () => {
        expect(toastManagerInitialState.state).toBe('empty');
      });

      it('starts with empty toasts array', () => {
        expect(toastManagerInitialState.toasts).toEqual([]);
      });
    });

    describe('TOAST_ADDED', () => {
      it('adds a toast to empty state and transitions to hasToasts', () => {
        const toast = { id: '1', content: 'Hello' };
        const result = toastManagerReducer(toastManagerInitialState, {
          type: 'TOAST_ADDED',
          toast,
        });
        expect(result.state).toBe('hasToasts');
        expect(result.toasts).toEqual([toast]);
      });

      it('appends a toast to existing toasts', () => {
        const existing = { id: '1', content: 'First' };
        const newToast = { id: '2', content: 'Second' };
        const current = { state: 'hasToasts' as const, toasts: [existing] };
        const result = toastManagerReducer(current, {
          type: 'TOAST_ADDED',
          toast: newToast,
        });
        expect(result.state).toBe('hasToasts');
        expect(result.toasts).toEqual([existing, newToast]);
      });

      it('preserves existing toasts when adding new ones', () => {
        const t1 = { id: '1', content: 'A' };
        const t2 = { id: '2', content: 'B' };
        const t3 = { id: '3', content: 'C' };
        let state = toastManagerReducer(toastManagerInitialState, {
          type: 'TOAST_ADDED',
          toast: t1,
        });
        state = toastManagerReducer(state, { type: 'TOAST_ADDED', toast: t2 });
        state = toastManagerReducer(state, { type: 'TOAST_ADDED', toast: t3 });
        expect(state.toasts).toHaveLength(3);
        expect(state.toasts).toEqual([t1, t2, t3]);
      });
    });

    describe('TOAST_REMOVED', () => {
      it('removes a toast and stays in hasToasts when others remain', () => {
        const t1 = { id: '1', content: 'First' };
        const t2 = { id: '2', content: 'Second' };
        const current = { state: 'hasToasts' as const, toasts: [t1, t2] };
        const result = toastManagerReducer(current, {
          type: 'TOAST_REMOVED',
          id: '1',
        });
        expect(result.state).toBe('hasToasts');
        expect(result.toasts).toEqual([t2]);
      });

      it('transitions to empty when removing the last toast', () => {
        const t1 = { id: '1', content: 'Only' };
        const current = { state: 'hasToasts' as const, toasts: [t1] };
        const result = toastManagerReducer(current, {
          type: 'TOAST_REMOVED',
          id: '1',
        });
        expect(result.state).toBe('empty');
        expect(result.toasts).toEqual([]);
      });

      it('does not modify state when removing a non-existent id', () => {
        const t1 = { id: '1', content: 'Present' };
        const current = { state: 'hasToasts' as const, toasts: [t1] };
        const result = toastManagerReducer(current, {
          type: 'TOAST_REMOVED',
          id: 'nonexistent',
        });
        expect(result.state).toBe('hasToasts');
        expect(result.toasts).toEqual([t1]);
      });

      it('returns empty state when removing from empty toasts list', () => {
        const result = toastManagerReducer(toastManagerInitialState, {
          type: 'TOAST_REMOVED',
          id: '1',
        });
        expect(result.state).toBe('empty');
        expect(result.toasts).toEqual([]);
      });
    });

    describe('ALL_REMOVED', () => {
      it('clears all toasts and transitions to empty', () => {
        const t1 = { id: '1', content: 'First' };
        const t2 = { id: '2', content: 'Second' };
        const current = { state: 'hasToasts' as const, toasts: [t1, t2] };
        const result = toastManagerReducer(current, { type: 'ALL_REMOVED' });
        expect(result.state).toBe('empty');
        expect(result.toasts).toEqual([]);
      });

      it('stays empty when already empty', () => {
        const result = toastManagerReducer(toastManagerInitialState, {
          type: 'ALL_REMOVED',
        });
        expect(result.state).toBe('empty');
        expect(result.toasts).toEqual([]);
      });
    });

    describe('unknown events', () => {
      it('returns current state for unknown event types', () => {
        const current = { state: 'hasToasts' as const, toasts: [{ id: '1', content: 'X' }] };
        const result = toastManagerReducer(current, { type: 'UNKNOWN' } as any);
        expect(result).toBe(current);
      });
    });
  });
});

/* ===========================================================================
 * Tooltip
 * ========================================================================= */

describe('Tooltip', () => {
  describe('tooltipReducer', () => {
    // hidden state
    it('transitions from hidden to showing on POINTER_ENTER', () => {
      expect(tooltipReducer('hidden', { type: 'POINTER_ENTER' })).toBe('showing');
    });

    it('transitions from hidden to showing on FOCUS', () => {
      expect(tooltipReducer('hidden', { type: 'FOCUS' })).toBe('showing');
    });

    it('stays hidden on POINTER_LEAVE', () => {
      expect(tooltipReducer('hidden', { type: 'POINTER_LEAVE' })).toBe('hidden');
    });

    it('stays hidden on BLUR', () => {
      expect(tooltipReducer('hidden', { type: 'BLUR' })).toBe('hidden');
    });

    it('stays hidden on ESCAPE', () => {
      expect(tooltipReducer('hidden', { type: 'ESCAPE' })).toBe('hidden');
    });

    it('stays hidden on DELAY_ELAPSED', () => {
      expect(tooltipReducer('hidden', { type: 'DELAY_ELAPSED' })).toBe('hidden');
    });

    // showing state
    it('transitions from showing to visible on DELAY_ELAPSED', () => {
      expect(tooltipReducer('showing', { type: 'DELAY_ELAPSED' })).toBe('visible');
    });

    it('transitions from showing to hidden on POINTER_LEAVE', () => {
      expect(tooltipReducer('showing', { type: 'POINTER_LEAVE' })).toBe('hidden');
    });

    it('transitions from showing to hidden on BLUR', () => {
      expect(tooltipReducer('showing', { type: 'BLUR' })).toBe('hidden');
    });

    it('transitions from showing to hidden on ESCAPE', () => {
      expect(tooltipReducer('showing', { type: 'ESCAPE' })).toBe('hidden');
    });

    it('stays in showing on POINTER_ENTER', () => {
      expect(tooltipReducer('showing', { type: 'POINTER_ENTER' })).toBe('showing');
    });

    it('stays in showing on FOCUS', () => {
      expect(tooltipReducer('showing', { type: 'FOCUS' })).toBe('showing');
    });

    // visible state
    it('transitions from visible to hiding on POINTER_LEAVE', () => {
      expect(tooltipReducer('visible', { type: 'POINTER_LEAVE' })).toBe('hiding');
    });

    it('transitions from visible to hiding on BLUR', () => {
      expect(tooltipReducer('visible', { type: 'BLUR' })).toBe('hiding');
    });

    it('transitions from visible to hidden on ESCAPE', () => {
      expect(tooltipReducer('visible', { type: 'ESCAPE' })).toBe('hidden');
    });

    it('stays in visible on POINTER_ENTER', () => {
      expect(tooltipReducer('visible', { type: 'POINTER_ENTER' })).toBe('visible');
    });

    it('stays in visible on FOCUS', () => {
      expect(tooltipReducer('visible', { type: 'FOCUS' })).toBe('visible');
    });

    it('stays in visible on DELAY_ELAPSED', () => {
      expect(tooltipReducer('visible', { type: 'DELAY_ELAPSED' })).toBe('visible');
    });

    // hiding state
    it('transitions from hiding to hidden on DELAY_ELAPSED', () => {
      expect(tooltipReducer('hiding', { type: 'DELAY_ELAPSED' })).toBe('hidden');
    });

    it('transitions from hiding to visible on POINTER_ENTER', () => {
      expect(tooltipReducer('hiding', { type: 'POINTER_ENTER' })).toBe('visible');
    });

    it('transitions from hiding to visible on FOCUS', () => {
      expect(tooltipReducer('hiding', { type: 'FOCUS' })).toBe('visible');
    });

    it('stays in hiding on ESCAPE', () => {
      expect(tooltipReducer('hiding', { type: 'ESCAPE' })).toBe('hiding');
    });

    it('stays in hiding on BLUR', () => {
      expect(tooltipReducer('hiding', { type: 'BLUR' })).toBe('hiding');
    });

    it('stays in hiding on POINTER_LEAVE', () => {
      expect(tooltipReducer('hiding', { type: 'POINTER_LEAVE' })).toBe('hiding');
    });

    it('ignores unknown event types', () => {
      expect(tooltipReducer('hidden', { type: 'UNKNOWN' } as any)).toBe('hidden');
      expect(tooltipReducer('visible', { type: 'UNKNOWN' } as any)).toBe('visible');
    });
  });
});
