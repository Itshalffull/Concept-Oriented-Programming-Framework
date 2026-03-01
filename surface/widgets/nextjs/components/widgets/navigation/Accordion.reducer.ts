// ---------------------------------------------------------------------------
// Accordion reducer — state management for vertically stacked collapsible sections.
// ---------------------------------------------------------------------------

export interface AccordionState {
  expandedItems: string[];
}

export type AccordionAction =
  | { type: 'TOGGLE'; value: string; multiple: boolean; collapsible: boolean }
  | { type: 'EXPAND'; value: string; multiple: boolean }
  | { type: 'COLLAPSE'; value: string; collapsible: boolean };

export function accordionReducer(state: AccordionState, action: AccordionAction): AccordionState {
  switch (action.type) {
    case 'TOGGLE': {
      const isExpanded = state.expandedItems.includes(action.value);
      if (isExpanded) {
        if (!action.collapsible && state.expandedItems.length === 1) return state;
        return { expandedItems: state.expandedItems.filter((v) => v !== action.value) };
      }
      if (action.multiple) {
        return { expandedItems: [...state.expandedItems, action.value] };
      }
      return { expandedItems: [action.value] };
    }
    case 'EXPAND': {
      if (state.expandedItems.includes(action.value)) return state;
      if (action.multiple) {
        return { expandedItems: [...state.expandedItems, action.value] };
      }
      return { expandedItems: [action.value] };
    }
    case 'COLLAPSE': {
      if (!action.collapsible && state.expandedItems.length === 1) return state;
      return { expandedItems: state.expandedItems.filter((v) => v !== action.value) };
    }
    default:
      return state;
  }
}
