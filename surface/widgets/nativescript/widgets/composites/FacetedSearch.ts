// ============================================================
// Clef Surface NativeScript Widget — FacetedSearch
//
// Search interface with facet-based filtering. Provides a
// search text field at the top, collapsible facet groups with
// checkable options, and a scrollable result list.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, TextField, Button, ScrollView, Switch } from '@nativescript/core';

// --------------- Types ---------------

export interface FacetOption {
  id: string;
  label: string;
  count: number;
  selected?: boolean;
}

export interface FacetGroup {
  name: string;
  options: FacetOption[];
  collapsed?: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  score?: number;
}

// --------------- Props ---------------

export interface FacetedSearchProps {
  /** Current search query. */
  query?: string;
  /** Facet filter groups. */
  facets?: FacetGroup[];
  /** Search results to display. */
  results?: SearchResult[];
  /** Placeholder for the search field. */
  placeholder?: string;
  /** Called when query text changes. */
  onQueryChange?: (query: string) => void;
  /** Called when a facet option is toggled. */
  onFacetToggle?: (groupName: string, optionId: string, selected: boolean) => void;
  /** Called when a result is tapped. */
  onResultSelect?: (result: SearchResult) => void;
}

// --------------- Component ---------------

export function createFacetedSearch(props: FacetedSearchProps = {}): GridLayout {
  const {
    query = '',
    facets = [],
    results = [],
    placeholder = 'Search...',
    onQueryChange,
    onFacetToggle,
    onResultSelect,
  } = props;

  const container = new GridLayout();
  container.className = 'clef-widget-faceted-search';
  container.columns = '200, *';
  container.rows = 'auto, *';
  container.padding = 12;

  // Search field (spans full width)
  const searchRow = new GridLayout();
  searchRow.columns = '*, auto';
  searchRow.marginBottom = 8;
  GridLayout.setRow(searchRow as any, 0);
  GridLayout.setColumnSpan(searchRow as any, 2);

  const searchField = new TextField();
  searchField.hint = placeholder;
  searchField.text = query;
  searchField.fontSize = 14;
  GridLayout.setColumn(searchField, 0);
  if (onQueryChange) {
    searchField.on('textChange', () => onQueryChange(searchField.text));
  }
  searchRow.addChild(searchField);

  const clearBtn = new Button();
  clearBtn.text = 'Clear';
  clearBtn.fontSize = 11;
  clearBtn.padding = 4;
  clearBtn.visibility = query ? 'visible' : 'collapse';
  GridLayout.setColumn(clearBtn, 1);
  clearBtn.on('tap', () => {
    searchField.text = '';
    if (onQueryChange) onQueryChange('');
  });
  searchRow.addChild(clearBtn);
  container.addChild(searchRow);

  // Left sidebar: facets
  const facetScroll = new ScrollView();
  GridLayout.setRow(facetScroll as any, 1);
  GridLayout.setColumn(facetScroll as any, 0);

  const facetList = new StackLayout();
  facetList.paddingRight = 8;

  facets.forEach((group) => {
    const groupContainer = new StackLayout();
    groupContainer.marginBottom = 12;

    const groupHeader = new Label();
    groupHeader.text = group.name;
    groupHeader.fontWeight = 'bold';
    groupHeader.fontSize = 13;
    groupHeader.marginBottom = 4;
    groupContainer.addChild(groupHeader);

    if (!group.collapsed) {
      group.options.forEach((option) => {
        const optionRow = new GridLayout();
        optionRow.columns = 'auto, *, auto';
        optionRow.padding = 2;

        const toggle = new Switch();
        toggle.checked = option.selected ?? false;
        GridLayout.setColumn(toggle, 0);
        if (onFacetToggle) {
          toggle.on('checkedChange', () => {
            onFacetToggle(group.name, option.id, toggle.checked);
          });
        }
        optionRow.addChild(toggle);

        const optLabel = new Label();
        optLabel.text = option.label;
        optLabel.fontSize = 12;
        optLabel.verticalAlignment = 'middle';
        optLabel.marginLeft = 4;
        GridLayout.setColumn(optLabel, 1);
        optionRow.addChild(optLabel);

        const countLabel = new Label();
        countLabel.text = `${option.count}`;
        countLabel.opacity = 0.5;
        countLabel.fontSize = 11;
        countLabel.verticalAlignment = 'middle';
        GridLayout.setColumn(countLabel, 2);
        optionRow.addChild(countLabel);

        groupContainer.addChild(optionRow);
      });
    }

    facetList.addChild(groupContainer);
  });

  facetScroll.content = facetList;
  container.addChild(facetScroll);

  // Right panel: results
  const resultScroll = new ScrollView();
  GridLayout.setRow(resultScroll as any, 1);
  GridLayout.setColumn(resultScroll as any, 1);

  const resultList = new StackLayout();
  resultList.paddingLeft = 8;

  if (results.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No results found.';
    emptyLabel.opacity = 0.5;
    emptyLabel.marginTop = 16;
    resultList.addChild(emptyLabel);
  }

  results.forEach((result) => {
    const row = new StackLayout();
    row.padding = 8;
    row.marginBottom = 4;
    row.borderRadius = 4;
    row.backgroundColor = '#F5F5F5' as any;

    const resultTitle = new Label();
    resultTitle.text = result.title;
    resultTitle.fontWeight = 'bold';
    resultTitle.fontSize = 13;
    row.addChild(resultTitle);

    if (result.description) {
      const descLabel = new Label();
      descLabel.text = result.description;
      descLabel.textWrap = true;
      descLabel.opacity = 0.6;
      descLabel.fontSize = 12;
      descLabel.marginTop = 2;
      row.addChild(descLabel);
    }

    if (result.score != null) {
      const scoreLabel = new Label();
      scoreLabel.text = `Score: ${result.score.toFixed(2)}`;
      scoreLabel.opacity = 0.4;
      scoreLabel.fontSize = 10;
      scoreLabel.marginTop = 2;
      row.addChild(scoreLabel);
    }

    if (onResultSelect) {
      row.on('tap', () => onResultSelect(result));
    }

    resultList.addChild(row);
  });

  resultScroll.content = resultList;
  container.addChild(resultScroll);

  return container;
}

createFacetedSearch.displayName = 'FacetedSearch';
export default createFacetedSearch;
