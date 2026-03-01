import { describe, it, expect } from 'vitest';

import {
  accordionReducer,
  type AccordionState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Accordion.reducer.js';

import {
  paletteReducer,
  defaultFilter,
  type PaletteState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/CommandPalette.reducer.js';

import {
  disclosureReducer,
  type DisclosureState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Disclosure.reducer.js';

import {
  fieldsetDisclosureReducer,
  type FieldsetDisclosureState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Fieldset.reducer.js';

import {
  visibilityReducer,
  type VisibilityState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/FloatingToolbar.reducer.js';

import {
  formReducer,
  initialFormState,
  type FormState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Form.reducer.js';

import {
  menuReducer,
  type MenuState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Menu.reducer.js';

import {
  navMenuReducer,
  type NavMenuState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/NavigationMenu.reducer.js';

import {
  paginationReducer,
  computePageRange,
  type PaginationState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Pagination.reducer.js';

import {
  sidebarReducer,
  type SidebarState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Sidebar.reducer.js';

import {
  splitterReducer,
  type SplitterState,
} from '../../surface/widgets/nextjs/components/widgets/navigation/Splitter.reducer.js';

// ===========================================================================
// Accordion
// ===========================================================================
describe('Accordion', () => {
  describe('accordionReducer', () => {
    const empty: AccordionState = { expandedItems: [] };
    const oneOpen: AccordionState = { expandedItems: ['a'] };
    const twoOpen: AccordionState = { expandedItems: ['a', 'b'] };

    describe('TOGGLE', () => {
      it('expands a collapsed item in single mode', () => {
        const result = accordionReducer(empty, {
          type: 'TOGGLE',
          value: 'a',
          multiple: false,
          collapsible: true,
        });
        expect(result.expandedItems).toEqual(['a']);
      });

      it('collapses an expanded item when collapsible', () => {
        const result = accordionReducer(oneOpen, {
          type: 'TOGGLE',
          value: 'a',
          multiple: false,
          collapsible: true,
        });
        expect(result.expandedItems).toEqual([]);
      });

      it('prevents collapsing the last item when not collapsible', () => {
        const result = accordionReducer(oneOpen, {
          type: 'TOGGLE',
          value: 'a',
          multiple: false,
          collapsible: false,
        });
        expect(result).toBe(oneOpen);
      });

      it('replaces expanded item in single mode', () => {
        const result = accordionReducer(oneOpen, {
          type: 'TOGGLE',
          value: 'b',
          multiple: false,
          collapsible: true,
        });
        expect(result.expandedItems).toEqual(['b']);
      });

      it('adds to expanded items in multiple mode', () => {
        const result = accordionReducer(oneOpen, {
          type: 'TOGGLE',
          value: 'b',
          multiple: true,
          collapsible: true,
        });
        expect(result.expandedItems).toEqual(['a', 'b']);
      });

      it('removes one item from multiple expanded items when collapsible', () => {
        const result = accordionReducer(twoOpen, {
          type: 'TOGGLE',
          value: 'a',
          multiple: true,
          collapsible: true,
        });
        expect(result.expandedItems).toEqual(['b']);
      });

      it('allows collapsing when multiple items are expanded even if not collapsible', () => {
        const result = accordionReducer(twoOpen, {
          type: 'TOGGLE',
          value: 'a',
          multiple: true,
          collapsible: false,
        });
        expect(result.expandedItems).toEqual(['b']);
      });
    });

    describe('EXPAND', () => {
      it('expands an item in single mode', () => {
        const result = accordionReducer(empty, {
          type: 'EXPAND',
          value: 'a',
          multiple: false,
        });
        expect(result.expandedItems).toEqual(['a']);
      });

      it('returns same state if already expanded', () => {
        const result = accordionReducer(oneOpen, {
          type: 'EXPAND',
          value: 'a',
          multiple: false,
        });
        expect(result).toBe(oneOpen);
      });

      it('replaces expanded item in single mode', () => {
        const result = accordionReducer(oneOpen, {
          type: 'EXPAND',
          value: 'b',
          multiple: false,
        });
        expect(result.expandedItems).toEqual(['b']);
      });

      it('adds to expanded items in multiple mode', () => {
        const result = accordionReducer(oneOpen, {
          type: 'EXPAND',
          value: 'b',
          multiple: true,
        });
        expect(result.expandedItems).toEqual(['a', 'b']);
      });
    });

    describe('COLLAPSE', () => {
      it('collapses an expanded item when collapsible', () => {
        const result = accordionReducer(oneOpen, {
          type: 'COLLAPSE',
          value: 'a',
          collapsible: true,
        });
        expect(result.expandedItems).toEqual([]);
      });

      it('prevents collapsing the last item when not collapsible', () => {
        const result = accordionReducer(oneOpen, {
          type: 'COLLAPSE',
          value: 'a',
          collapsible: false,
        });
        expect(result).toBe(oneOpen);
      });

      it('allows collapsing when multiple items are expanded and not collapsible', () => {
        const result = accordionReducer(twoOpen, {
          type: 'COLLAPSE',
          value: 'a',
          collapsible: false,
        });
        expect(result.expandedItems).toEqual(['b']);
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged for unknown action type', () => {
        const result = accordionReducer(oneOpen, { type: 'UNKNOWN' } as any);
        expect(result).toBe(oneOpen);
      });
    });
  });
});

// ===========================================================================
// CommandPalette
// ===========================================================================
describe('CommandPalette', () => {
  describe('paletteReducer', () => {
    const closed: PaletteState = { visibility: 'closed', query: '', highlightedIndex: 0 };
    const openState: PaletteState = { visibility: 'open', query: 'test', highlightedIndex: 3 };

    describe('OPEN', () => {
      it('opens the palette and resets query and highlight', () => {
        const result = paletteReducer(closed, { type: 'OPEN' });
        expect(result).toEqual({ visibility: 'open', query: '', highlightedIndex: 0 });
      });

      it('resets query and highlight when already open', () => {
        const result = paletteReducer(openState, { type: 'OPEN' });
        expect(result).toEqual({ visibility: 'open', query: '', highlightedIndex: 0 });
      });
    });

    describe('CLOSE', () => {
      it('closes the palette and resets query and highlight', () => {
        const result = paletteReducer(openState, { type: 'CLOSE' });
        expect(result).toEqual({ visibility: 'closed', query: '', highlightedIndex: 0 });
      });

      it('remains closed when already closed', () => {
        const result = paletteReducer(closed, { type: 'CLOSE' });
        expect(result).toEqual(closed);
      });
    });

    describe('ACTIVATE', () => {
      it('closes the palette just like CLOSE', () => {
        const result = paletteReducer(openState, { type: 'ACTIVATE' });
        expect(result).toEqual({ visibility: 'closed', query: '', highlightedIndex: 0 });
      });
    });

    describe('INPUT', () => {
      it('updates the query and resets highlighted index', () => {
        const state: PaletteState = { visibility: 'open', query: 'old', highlightedIndex: 5 };
        const result = paletteReducer(state, { type: 'INPUT', query: 'new' });
        expect(result).toEqual({ visibility: 'open', query: 'new', highlightedIndex: 0 });
      });
    });

    describe('HIGHLIGHT', () => {
      it('sets the highlighted index', () => {
        const result = paletteReducer(closed, { type: 'HIGHLIGHT', index: 7 });
        expect(result.highlightedIndex).toBe(7);
      });
    });

    describe('NAVIGATE_NEXT', () => {
      it('advances highlight index by 1', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 2 };
        const result = paletteReducer(state, { type: 'NAVIGATE_NEXT', count: 5, loop: false });
        expect(result.highlightedIndex).toBe(3);
      });

      it('clamps at count - 1 without looping', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 4 };
        const result = paletteReducer(state, { type: 'NAVIGATE_NEXT', count: 5, loop: false });
        expect(result.highlightedIndex).toBe(4);
      });

      it('wraps around with looping', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 4 };
        const result = paletteReducer(state, { type: 'NAVIGATE_NEXT', count: 5, loop: true });
        expect(result.highlightedIndex).toBe(0);
      });

      it('returns same state when count is 0', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 0 };
        const result = paletteReducer(state, { type: 'NAVIGATE_NEXT', count: 0, loop: true });
        expect(result).toBe(state);
      });
    });

    describe('NAVIGATE_PREV', () => {
      it('decrements highlight index by 1', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 3 };
        const result = paletteReducer(state, { type: 'NAVIGATE_PREV', count: 5, loop: false });
        expect(result.highlightedIndex).toBe(2);
      });

      it('clamps at 0 without looping', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 0 };
        const result = paletteReducer(state, { type: 'NAVIGATE_PREV', count: 5, loop: false });
        expect(result.highlightedIndex).toBe(0);
      });

      it('wraps to end with looping', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 0 };
        const result = paletteReducer(state, { type: 'NAVIGATE_PREV', count: 5, loop: true });
        expect(result.highlightedIndex).toBe(4);
      });

      it('returns same state when count is 0', () => {
        const state: PaletteState = { visibility: 'open', query: '', highlightedIndex: 0 };
        const result = paletteReducer(state, { type: 'NAVIGATE_PREV', count: 0, loop: true });
        expect(result).toBe(state);
      });
    });

    describe('RESET', () => {
      it('clears query and resets highlighted index without changing visibility', () => {
        const result = paletteReducer(openState, { type: 'RESET' });
        expect(result).toEqual({ visibility: 'open', query: '', highlightedIndex: 0 });
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged', () => {
        const result = paletteReducer(openState, { type: 'UNKNOWN' } as any);
        expect(result).toBe(openState);
      });
    });
  });

  describe('defaultFilter', () => {
    it('matches case-insensitively', () => {
      expect(defaultFilter({ label: 'Save File' }, 'save')).toBe(true);
      expect(defaultFilter({ label: 'Save File' }, 'SAVE')).toBe(true);
    });

    it('matches partial labels', () => {
      expect(defaultFilter({ label: 'Open Recent File' }, 'recent')).toBe(true);
    });

    it('returns false when no match', () => {
      expect(defaultFilter({ label: 'Save File' }, 'delete')).toBe(false);
    });

    it('matches empty query to everything', () => {
      expect(defaultFilter({ label: 'Anything' }, '')).toBe(true);
    });
  });
});

// ===========================================================================
// Disclosure
// ===========================================================================
describe('Disclosure', () => {
  describe('disclosureReducer', () => {
    describe('from collapsed state', () => {
      const state: DisclosureState = 'collapsed';

      it('transitions to expanded on TOGGLE', () => {
        expect(disclosureReducer(state, { type: 'TOGGLE' })).toBe('expanded');
      });

      it('transitions to expanded on EXPAND', () => {
        expect(disclosureReducer(state, { type: 'EXPAND' })).toBe('expanded');
      });

      it('stays collapsed on COLLAPSE', () => {
        expect(disclosureReducer(state, { type: 'COLLAPSE' })).toBe('collapsed');
      });
    });

    describe('from expanded state', () => {
      const state: DisclosureState = 'expanded';

      it('transitions to collapsed on TOGGLE', () => {
        expect(disclosureReducer(state, { type: 'TOGGLE' })).toBe('collapsed');
      });

      it('stays expanded on EXPAND', () => {
        expect(disclosureReducer(state, { type: 'EXPAND' })).toBe('expanded');
      });

      it('transitions to collapsed on COLLAPSE', () => {
        expect(disclosureReducer(state, { type: 'COLLAPSE' })).toBe('collapsed');
      });
    });

    describe('unknown state', () => {
      it('returns state unchanged', () => {
        const result = disclosureReducer('unknown' as any, { type: 'TOGGLE' });
        expect(result).toBe('unknown');
      });
    });
  });
});

// ===========================================================================
// Fieldset
// ===========================================================================
describe('Fieldset', () => {
  describe('fieldsetDisclosureReducer', () => {
    describe('EXPAND', () => {
      it('transitions collapsed to expanded', () => {
        expect(fieldsetDisclosureReducer('collapsed', { type: 'EXPAND' })).toBe('expanded');
      });

      it('stays expanded when already expanded', () => {
        expect(fieldsetDisclosureReducer('expanded', { type: 'EXPAND' })).toBe('expanded');
      });
    });

    describe('COLLAPSE', () => {
      it('transitions expanded to collapsed', () => {
        expect(fieldsetDisclosureReducer('expanded', { type: 'COLLAPSE' })).toBe('collapsed');
      });

      it('stays collapsed when already collapsed', () => {
        expect(fieldsetDisclosureReducer('collapsed', { type: 'COLLAPSE' })).toBe('collapsed');
      });
    });

    describe('TOGGLE', () => {
      it('toggles expanded to collapsed', () => {
        expect(fieldsetDisclosureReducer('expanded', { type: 'TOGGLE' })).toBe('collapsed');
      });

      it('toggles collapsed to expanded', () => {
        expect(fieldsetDisclosureReducer('collapsed', { type: 'TOGGLE' })).toBe('expanded');
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged', () => {
        const result = fieldsetDisclosureReducer('expanded', { type: 'UNKNOWN' } as any);
        expect(result).toBe('expanded');
      });
    });
  });
});

// ===========================================================================
// FloatingToolbar
// ===========================================================================
describe('FloatingToolbar', () => {
  describe('visibilityReducer', () => {
    describe('from hidden state', () => {
      const state: VisibilityState = 'hidden';

      it('transitions to visible on SHOW', () => {
        expect(visibilityReducer(state, { type: 'SHOW' })).toBe('visible');
      });

      it('stays hidden on HIDE', () => {
        expect(visibilityReducer(state, { type: 'HIDE' })).toBe('hidden');
      });

      it('stays hidden on CLICK_OUTSIDE', () => {
        expect(visibilityReducer(state, { type: 'CLICK_OUTSIDE' })).toBe('hidden');
      });

      it('stays hidden on ESCAPE', () => {
        expect(visibilityReducer(state, { type: 'ESCAPE' })).toBe('hidden');
      });
    });

    describe('from visible state', () => {
      const state: VisibilityState = 'visible';

      it('stays visible on SHOW', () => {
        expect(visibilityReducer(state, { type: 'SHOW' })).toBe('visible');
      });

      it('transitions to hidden on HIDE', () => {
        expect(visibilityReducer(state, { type: 'HIDE' })).toBe('hidden');
      });

      it('transitions to hidden on CLICK_OUTSIDE', () => {
        expect(visibilityReducer(state, { type: 'CLICK_OUTSIDE' })).toBe('hidden');
      });

      it('transitions to hidden on ESCAPE', () => {
        expect(visibilityReducer(state, { type: 'ESCAPE' })).toBe('hidden');
      });
    });

    describe('unknown state', () => {
      it('returns state unchanged', () => {
        const result = visibilityReducer('unknown' as any, { type: 'SHOW' });
        expect(result).toBe('unknown');
      });
    });
  });
});

// ===========================================================================
// Form
// ===========================================================================
describe('Form', () => {
  describe('formReducer', () => {
    describe('initial state', () => {
      it('has idle submission and empty errors', () => {
        expect(initialFormState).toEqual({ submission: 'idle', errors: [] });
      });
    });

    describe('SUBMIT', () => {
      it('transitions to validating and clears errors', () => {
        const state: FormState = { submission: 'idle', errors: ['old error'] };
        const result = formReducer(state, { type: 'SUBMIT' });
        expect(result).toEqual({ submission: 'validating', errors: [] });
      });
    });

    describe('VALIDATE', () => {
      it('transitions to validating and clears errors', () => {
        const state: FormState = { submission: 'error', errors: ['err'] };
        const result = formReducer(state, { type: 'VALIDATE' });
        expect(result).toEqual({ submission: 'validating', errors: [] });
      });
    });

    describe('VALID', () => {
      it('transitions to submitting', () => {
        const state: FormState = { submission: 'validating', errors: [] };
        const result = formReducer(state, { type: 'VALID' });
        expect(result.submission).toBe('submitting');
      });
    });

    describe('INVALID', () => {
      it('transitions to error with provided errors', () => {
        const state: FormState = { submission: 'validating', errors: [] };
        const result = formReducer(state, { type: 'INVALID', errors: ['field required'] });
        expect(result).toEqual({ submission: 'error', errors: ['field required'] });
      });
    });

    describe('SUCCESS', () => {
      it('transitions to success and clears errors', () => {
        const state: FormState = { submission: 'submitting', errors: [] };
        const result = formReducer(state, { type: 'SUCCESS' });
        expect(result).toEqual({ submission: 'success', errors: [] });
      });
    });

    describe('FAILURE', () => {
      it('transitions to error with provided errors', () => {
        const state: FormState = { submission: 'submitting', errors: [] };
        const result = formReducer(state, { type: 'FAILURE', errors: ['server error'] });
        expect(result).toEqual({ submission: 'error', errors: ['server error'] });
      });
    });

    describe('RESET', () => {
      it('transitions to idle and clears errors', () => {
        const state: FormState = { submission: 'error', errors: ['err'] };
        const result = formReducer(state, { type: 'RESET' });
        expect(result).toEqual({ submission: 'idle', errors: [] });
      });
    });

    describe('FIX', () => {
      it('transitions to idle and clears errors, same as RESET', () => {
        const state: FormState = { submission: 'error', errors: ['err'] };
        const result = formReducer(state, { type: 'FIX' });
        expect(result).toEqual({ submission: 'idle', errors: [] });
      });
    });

    describe('full lifecycle', () => {
      it('follows idle -> validating -> submitting -> success', () => {
        let state = initialFormState;
        state = formReducer(state, { type: 'SUBMIT' });
        expect(state.submission).toBe('validating');
        state = formReducer(state, { type: 'VALID' });
        expect(state.submission).toBe('submitting');
        state = formReducer(state, { type: 'SUCCESS' });
        expect(state.submission).toBe('success');
      });

      it('follows idle -> validating -> error (invalid) -> idle (fix)', () => {
        let state = initialFormState;
        state = formReducer(state, { type: 'SUBMIT' });
        state = formReducer(state, { type: 'INVALID', errors: ['bad input'] });
        expect(state.submission).toBe('error');
        expect(state.errors).toEqual(['bad input']);
        state = formReducer(state, { type: 'FIX' });
        expect(state).toEqual(initialFormState);
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged', () => {
        const state = initialFormState;
        const result = formReducer(state, { type: 'UNKNOWN' } as any);
        expect(result).toBe(state);
      });
    });
  });
});

// ===========================================================================
// Menu
// ===========================================================================
describe('Menu', () => {
  describe('menuReducer', () => {
    describe('from closed state', () => {
      const state: MenuState = 'closed';

      it('transitions to open on OPEN', () => {
        expect(menuReducer(state, { type: 'OPEN' })).toBe('open');
      });

      it('stays closed on CLOSE', () => {
        expect(menuReducer(state, { type: 'CLOSE' })).toBe('closed');
      });

      it('stays closed on SELECT', () => {
        expect(menuReducer(state, { type: 'SELECT' })).toBe('closed');
      });
    });

    describe('from open state', () => {
      const state: MenuState = 'open';

      it('stays open on OPEN', () => {
        expect(menuReducer(state, { type: 'OPEN' })).toBe('open');
      });

      it('transitions to closed on CLOSE', () => {
        expect(menuReducer(state, { type: 'CLOSE' })).toBe('closed');
      });

      it('transitions to closed on SELECT', () => {
        expect(menuReducer(state, { type: 'SELECT' })).toBe('closed');
      });
    });

    describe('unknown state', () => {
      it('returns state unchanged', () => {
        const result = menuReducer('unknown' as any, { type: 'OPEN' });
        expect(result).toBe('unknown');
      });
    });
  });
});

// ===========================================================================
// NavigationMenu
// ===========================================================================
describe('NavigationMenu', () => {
  describe('navMenuReducer', () => {
    const initial: NavMenuState = { openItem: null, mobileExpanded: false };

    describe('OPEN', () => {
      it('sets the open item index', () => {
        const result = navMenuReducer(initial, { type: 'OPEN', index: 2 });
        expect(result.openItem).toBe(2);
        expect(result.mobileExpanded).toBe(false);
      });

      it('changes from one open item to another', () => {
        const state: NavMenuState = { openItem: 1, mobileExpanded: false };
        const result = navMenuReducer(state, { type: 'OPEN', index: 3 });
        expect(result.openItem).toBe(3);
      });
    });

    describe('CLOSE', () => {
      it('clears the open item', () => {
        const state: NavMenuState = { openItem: 2, mobileExpanded: true };
        const result = navMenuReducer(state, { type: 'CLOSE' });
        expect(result.openItem).toBeNull();
        expect(result.mobileExpanded).toBe(true);
      });

      it('is a no-op when already closed', () => {
        const result = navMenuReducer(initial, { type: 'CLOSE' });
        expect(result.openItem).toBeNull();
      });
    });

    describe('TOGGLE_MOBILE', () => {
      it('toggles mobile expanded from false to true', () => {
        const result = navMenuReducer(initial, { type: 'TOGGLE_MOBILE' });
        expect(result.mobileExpanded).toBe(true);
      });

      it('toggles mobile expanded from true to false', () => {
        const state: NavMenuState = { openItem: null, mobileExpanded: true };
        const result = navMenuReducer(state, { type: 'TOGGLE_MOBILE' });
        expect(result.mobileExpanded).toBe(false);
      });

      it('preserves openItem when toggling mobile', () => {
        const state: NavMenuState = { openItem: 1, mobileExpanded: false };
        const result = navMenuReducer(state, { type: 'TOGGLE_MOBILE' });
        expect(result.openItem).toBe(1);
        expect(result.mobileExpanded).toBe(true);
      });
    });

    describe('NAVIGATE', () => {
      it('closes mobile and clears open item', () => {
        const state: NavMenuState = { openItem: 2, mobileExpanded: true };
        const result = navMenuReducer(state, { type: 'NAVIGATE' });
        expect(result.openItem).toBeNull();
        expect(result.mobileExpanded).toBe(false);
      });

      it('is safe when already in initial state', () => {
        const result = navMenuReducer(initial, { type: 'NAVIGATE' });
        expect(result).toEqual(initial);
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged', () => {
        const result = navMenuReducer(initial, { type: 'UNKNOWN' } as any);
        expect(result).toBe(initial);
      });
    });
  });
});

// ===========================================================================
// Pagination
// ===========================================================================
describe('Pagination', () => {
  describe('paginationReducer', () => {
    describe('NAVIGATE_PREV', () => {
      it('decrements page by 1', () => {
        const state: PaginationState = { page: 5 };
        const result = paginationReducer(state, { type: 'NAVIGATE_PREV' });
        expect(result.page).toBe(4);
      });

      it('clamps at page 1', () => {
        const state: PaginationState = { page: 1 };
        const result = paginationReducer(state, { type: 'NAVIGATE_PREV' });
        expect(result.page).toBe(1);
      });
    });

    describe('NAVIGATE_NEXT', () => {
      it('increments page by 1', () => {
        const state: PaginationState = { page: 3 };
        const result = paginationReducer(state, { type: 'NAVIGATE_NEXT', totalPages: 10 });
        expect(result.page).toBe(4);
      });

      it('clamps at totalPages', () => {
        const state: PaginationState = { page: 10 };
        const result = paginationReducer(state, { type: 'NAVIGATE_NEXT', totalPages: 10 });
        expect(result.page).toBe(10);
      });
    });

    describe('NAVIGATE_TO', () => {
      it('navigates to the specified page', () => {
        const state: PaginationState = { page: 1 };
        const result = paginationReducer(state, { type: 'NAVIGATE_TO', page: 7, totalPages: 10 });
        expect(result.page).toBe(7);
      });

      it('clamps below at 1', () => {
        const state: PaginationState = { page: 5 };
        const result = paginationReducer(state, { type: 'NAVIGATE_TO', page: 0, totalPages: 10 });
        expect(result.page).toBe(1);
      });

      it('clamps above at totalPages', () => {
        const state: PaginationState = { page: 5 };
        const result = paginationReducer(state, { type: 'NAVIGATE_TO', page: 999, totalPages: 10 });
        expect(result.page).toBe(10);
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged', () => {
        const state: PaginationState = { page: 3 };
        const result = paginationReducer(state, { type: 'UNKNOWN' } as any);
        expect(result).toBe(state);
      });
    });
  });

  describe('computePageRange', () => {
    it('returns all pages for small total', () => {
      const result = computePageRange(1, 3, 1, 1);
      expect(result).toEqual([1, 2, 3]);
    });

    it('includes ellipsis for large total when on first page', () => {
      const result = computePageRange(1, 10, 1, 1);
      expect(result[0]).toBe(1);
      expect(result).toContain('ellipsis');
      expect(result[result.length - 1]).toBe(10);
    });

    it('includes ellipsis for large total when on last page', () => {
      const result = computePageRange(10, 10, 1, 1);
      expect(result[0]).toBe(1);
      expect(result).toContain('ellipsis');
      expect(result[result.length - 1]).toBe(10);
    });

    it('shows siblings around current page', () => {
      const result = computePageRange(5, 10, 1, 1);
      expect(result).toContain(4);
      expect(result).toContain(5);
      expect(result).toContain(6);
    });

    it('shows two ellipses when current page is in the middle', () => {
      const result = computePageRange(5, 10, 1, 1);
      const ellipsisCounts = result.filter((r) => r === 'ellipsis').length;
      expect(ellipsisCounts).toBe(2);
    });

    it('handles boundary count of 2', () => {
      const result = computePageRange(5, 10, 1, 2);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(9);
      expect(result).toContain(10);
    });

    it('handles single page', () => {
      const result = computePageRange(1, 1, 1, 1);
      expect(result).toEqual([1]);
    });

    it('never contains duplicates', () => {
      const result = computePageRange(3, 5, 2, 1);
      const numbers = result.filter((r) => typeof r === 'number') as number[];
      const unique = new Set(numbers);
      expect(unique.size).toBe(numbers.length);
    });

    it('returns pages in ascending order', () => {
      const result = computePageRange(5, 20, 1, 1);
      const numbers = result.filter((r) => typeof r === 'number') as number[];
      for (let i = 1; i < numbers.length; i++) {
        expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
      }
    });
  });
});

// ===========================================================================
// Sidebar
// ===========================================================================
describe('Sidebar', () => {
  describe('sidebarReducer', () => {
    describe('EXPAND', () => {
      it('transitions collapsed to expanded', () => {
        expect(sidebarReducer('collapsed', { type: 'EXPAND' })).toBe('expanded');
      });

      it('stays expanded when already expanded', () => {
        expect(sidebarReducer('expanded', { type: 'EXPAND' })).toBe('expanded');
      });
    });

    describe('COLLAPSE', () => {
      it('transitions expanded to collapsed', () => {
        expect(sidebarReducer('expanded', { type: 'COLLAPSE' })).toBe('collapsed');
      });

      it('stays collapsed when already collapsed', () => {
        expect(sidebarReducer('collapsed', { type: 'COLLAPSE' })).toBe('collapsed');
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged', () => {
        const result = sidebarReducer('expanded', { type: 'UNKNOWN' } as any);
        expect(result).toBe('expanded');
      });
    });
  });
});

// ===========================================================================
// Splitter
// ===========================================================================
describe('Splitter', () => {
  describe('splitterReducer', () => {
    const idle: SplitterState = { interaction: 'idle', panelSize: 50 };

    describe('DRAG_START', () => {
      it('transitions interaction to dragging', () => {
        const result = splitterReducer(idle, { type: 'DRAG_START' });
        expect(result.interaction).toBe('dragging');
        expect(result.panelSize).toBe(50);
      });
    });

    describe('DRAG_MOVE', () => {
      it('updates panel size', () => {
        const dragging: SplitterState = { interaction: 'dragging', panelSize: 50 };
        const result = splitterReducer(dragging, { type: 'DRAG_MOVE', panelSize: 65.5 });
        expect(result.panelSize).toBe(65.5);
        expect(result.interaction).toBe('dragging');
      });
    });

    describe('DRAG_END', () => {
      it('transitions interaction to idle', () => {
        const dragging: SplitterState = { interaction: 'dragging', panelSize: 70 };
        const result = splitterReducer(dragging, { type: 'DRAG_END' });
        expect(result.interaction).toBe('idle');
        expect(result.panelSize).toBe(70);
      });
    });

    describe('FOCUS', () => {
      it('transitions interaction to focused', () => {
        const result = splitterReducer(idle, { type: 'FOCUS' });
        expect(result.interaction).toBe('focused');
        expect(result.panelSize).toBe(50);
      });
    });

    describe('BLUR', () => {
      it('transitions interaction to idle', () => {
        const focused: SplitterState = { interaction: 'focused', panelSize: 50 };
        const result = splitterReducer(focused, { type: 'BLUR' });
        expect(result.interaction).toBe('idle');
      });
    });

    describe('RESIZE_INCREMENT', () => {
      it('increases panel size by step', () => {
        const result = splitterReducer(idle, { type: 'RESIZE_INCREMENT', step: 5, max: 90 });
        expect(result.panelSize).toBe(55);
      });

      it('clamps at max', () => {
        const state: SplitterState = { interaction: 'idle', panelSize: 88 };
        const result = splitterReducer(state, { type: 'RESIZE_INCREMENT', step: 5, max: 90 });
        expect(result.panelSize).toBe(90);
      });

      it('does not exceed max when already at max', () => {
        const state: SplitterState = { interaction: 'idle', panelSize: 90 };
        const result = splitterReducer(state, { type: 'RESIZE_INCREMENT', step: 5, max: 90 });
        expect(result.panelSize).toBe(90);
      });
    });

    describe('RESIZE_DECREMENT', () => {
      it('decreases panel size by step', () => {
        const result = splitterReducer(idle, { type: 'RESIZE_DECREMENT', step: 5, min: 10 });
        expect(result.panelSize).toBe(45);
      });

      it('clamps at min', () => {
        const state: SplitterState = { interaction: 'idle', panelSize: 12 };
        const result = splitterReducer(state, { type: 'RESIZE_DECREMENT', step: 5, min: 10 });
        expect(result.panelSize).toBe(10);
      });

      it('does not go below min when already at min', () => {
        const state: SplitterState = { interaction: 'idle', panelSize: 10 };
        const result = splitterReducer(state, { type: 'RESIZE_DECREMENT', step: 5, min: 10 });
        expect(result.panelSize).toBe(10);
      });
    });

    describe('RESIZE_MIN', () => {
      it('sets panel size to min', () => {
        const result = splitterReducer(idle, { type: 'RESIZE_MIN', min: 10 });
        expect(result.panelSize).toBe(10);
      });
    });

    describe('RESIZE_MAX', () => {
      it('sets panel size to max', () => {
        const result = splitterReducer(idle, { type: 'RESIZE_MAX', max: 90 });
        expect(result.panelSize).toBe(90);
      });
    });

    describe('preserves unrelated fields', () => {
      it('DRAG_MOVE preserves interaction', () => {
        const state: SplitterState = { interaction: 'dragging', panelSize: 50 };
        const result = splitterReducer(state, { type: 'DRAG_MOVE', panelSize: 60 });
        expect(result.interaction).toBe('dragging');
      });

      it('RESIZE_INCREMENT preserves interaction', () => {
        const focused: SplitterState = { interaction: 'focused', panelSize: 50 };
        const result = splitterReducer(focused, { type: 'RESIZE_INCREMENT', step: 1, max: 90 });
        expect(result.interaction).toBe('focused');
      });
    });

    describe('unknown action', () => {
      it('returns state unchanged', () => {
        const result = splitterReducer(idle, { type: 'UNKNOWN' } as any);
        expect(result).toBe(idle);
      });
    });
  });
});
