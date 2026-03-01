/* ---------------------------------------------------------------------------
 * FacetedSearch reducer — extracted state machine
 * States: search, facetGroup, facetShowMore
 * ------------------------------------------------------------------------- */

export interface FacetedSearchState {
  search: 'idle' | 'searching' | 'hasResults' | 'noResults' | 'error';
  expandedFacets: Set<string>;
  expandedShowMore: Set<string>;
  query: string;
}

export type FacetedSearchEvent =
  | { type: 'SEARCH'; query: string }
  | { type: 'SEARCH_COMPLETE'; hasResults: boolean }
  | { type: 'SEARCH_ERROR' }
  | { type: 'COLLAPSE_FACET'; key: string }
  | { type: 'EXPAND_FACET'; key: string }
  | { type: 'SHOW_MORE'; key: string }
  | { type: 'SHOW_LESS'; key: string }
  | { type: 'SET_QUERY'; query: string };

export function facetedSearchReducer(
  state: FacetedSearchState,
  event: FacetedSearchEvent,
): FacetedSearchState {
  switch (event.type) {
    case 'SEARCH':
      return { ...state, search: 'searching', query: event.query };
    case 'SEARCH_COMPLETE':
      return { ...state, search: event.hasResults ? 'hasResults' : 'noResults' };
    case 'SEARCH_ERROR':
      return { ...state, search: 'error' };
    case 'COLLAPSE_FACET': {
      const s = new Set(state.expandedFacets);
      s.delete(event.key);
      return { ...state, expandedFacets: s };
    }
    case 'EXPAND_FACET': {
      const s = new Set(state.expandedFacets);
      s.add(event.key);
      return { ...state, expandedFacets: s };
    }
    case 'SHOW_MORE': {
      const s = new Set(state.expandedShowMore);
      s.add(event.key);
      return { ...state, expandedShowMore: s };
    }
    case 'SHOW_LESS': {
      const s = new Set(state.expandedShowMore);
      s.delete(event.key);
      return { ...state, expandedShowMore: s };
    }
    case 'SET_QUERY':
      return { ...state, query: event.query };
    default:
      return state;
  }
}
