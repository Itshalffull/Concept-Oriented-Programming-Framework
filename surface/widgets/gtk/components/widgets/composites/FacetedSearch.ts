// ============================================================
// Clef Surface GTK Widget — FacetedSearch
//
// Search interface with facet filters. Combines a search entry
// with faceted filter sidebar and result list.
//
// Adapts the faceted-search.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface FacetOption { id: string; label: string; count?: number; }
export interface Facet { id: string; label: string; options: FacetOption[]; }
export interface SearchResult { id: string; title: string; description?: string; }

// --------------- Props ---------------

export interface FacetedSearchProps {
  facets?: Facet[];
  results?: SearchResult[];
  query?: string;
  onSearch?: (query: string) => void;
  onFacetChange?: (facetId: string, optionId: string, selected: boolean) => void;
  onResultClick?: (id: string) => void;
}

// --------------- Component ---------------

export function createFacetedSearch(props: FacetedSearchProps = {}): Gtk.Widget {
  const { facets = [], results = [], query = '', onSearch, onFacetChange, onResultClick } = props;

  const paned = new Gtk.Paned({ orientation: Gtk.Orientation.HORIZONTAL, position: 220 });

  // Facet sidebar
  const sidebar = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  facets.forEach((facet) => {
    const expander = new Gtk.Expander({ label: facet.label, expanded: true });
    const optBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
    facet.options.forEach((opt) => {
      const check = new Gtk.CheckButton({ label: `${opt.label}${opt.count !== undefined ? ` (${opt.count})` : ''}` });
      check.connect('toggled', () => onFacetChange?.(facet.id, opt.id, check.get_active()));
      optBox.append(check);
    });
    expander.set_child(optBox);
    sidebar.append(expander);
  });
  paned.set_start_child(sidebar);

  // Main content
  const main = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const searchEntry = new Gtk.SearchEntry({ text: query, placeholderText: 'Search...' });
  searchEntry.connect('search-changed', () => onSearch?.(searchEntry.get_text()));
  main.append(searchEntry);

  const resultList = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  resultList.get_style_context().add_class('boxed-list');
  results.forEach((r) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
    const btn = new Gtk.Button({ label: r.title });
    btn.get_style_context().add_class('flat');
    btn.connect('clicked', () => onResultClick?.(r.id));
    row.append(btn);
    if (r.description) {
      const d = new Gtk.Label({ label: r.description, xalign: 0, wrap: true });
      d.get_style_context().add_class('dim-label');
      row.append(d);
    }
    resultList.append(row);
  });
  main.append(resultList);
  paned.set_end_child(main);

  return paned;
}
