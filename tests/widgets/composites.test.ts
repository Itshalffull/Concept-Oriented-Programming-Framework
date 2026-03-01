import { describe, it, expect, beforeEach } from 'vitest';

import {
  backlinkPanelReducer,
  type BacklinkPanelState,
} from '../../surface/widgets/nextjs/components/widgets/composites/BacklinkPanel.reducer.js';

import {
  cacheDashboardReducer,
  formatBytes,
  gaugeStatus,
  type CacheDashboardState,
} from '../../surface/widgets/nextjs/components/widgets/composites/CacheDashboard.reducer.js';

import {
  diffViewerReducer,
  computeDiffLines,
  type DiffViewerState,
} from '../../surface/widgets/nextjs/components/widgets/composites/DiffViewer.reducer.js';

import {
  facetedSearchReducer,
  type FacetedSearchState,
} from '../../surface/widgets/nextjs/components/widgets/composites/FacetedSearch.reducer.js';

import {
  fileBrowserReducer,
  type FileBrowserState,
} from '../../surface/widgets/nextjs/components/widgets/composites/FileBrowser.reducer.js';

import {
  filterBuilderReducer,
  resetFilterCounter,
  type FilterBuilderState,
} from '../../surface/widgets/nextjs/components/widgets/composites/FilterBuilder.reducer.js';

import {
  masterDetailReducer,
  type MasterDetailState,
} from '../../surface/widgets/nextjs/components/widgets/composites/MasterDetail.reducer.js';

import {
  notificationCenterReducer,
  type NotificationCenterState,
} from '../../surface/widgets/nextjs/components/widgets/composites/NotificationCenter.reducer.js';

import {
  permissionMatrixReducer,
  isGranted,
  allActionsGranted,
  someActionsGranted,
  allGranted,
  someGranted,
  type PermissionMatrixState,
} from '../../surface/widgets/nextjs/components/widgets/composites/PermissionMatrix.reducer.js';

import {
  pluginCardReducer,
  formatNumber,
  buttonLabel,
  type PluginCardState,
} from '../../surface/widgets/nextjs/components/widgets/composites/PluginCard.reducer.js';

import {
  preferenceMatrixReducer,
  type PreferenceMatrixState,
} from '../../surface/widgets/nextjs/components/widgets/composites/PreferenceMatrix.reducer.js';

import {
  propertyPanelReducer,
  type PropertyPanelState,
} from '../../surface/widgets/nextjs/components/widgets/composites/PropertyPanel.reducer.js';

import {
  queueDashboardReducer,
  type QueueDashboardState,
} from '../../surface/widgets/nextjs/components/widgets/composites/QueueDashboard.reducer.js';

import {
  schemaEditorReducer,
  resetFieldCounter,
  type SchemaEditorState,
} from '../../surface/widgets/nextjs/components/widgets/composites/SchemaEditor.reducer.js';

import {
  sortBuilderReducer,
  ordinalSuffix,
  resetSortCounter,
  type SortBuilderState,
} from '../../surface/widgets/nextjs/components/widgets/composites/SortBuilder.reducer.js';

import {
  viewSwitcherReducer,
  type ViewSwitcherState,
} from '../../surface/widgets/nextjs/components/widgets/composites/ViewSwitcher.reducer.js';

/* ===========================================================================
 * BacklinkPanel
 * ========================================================================= */

describe('BacklinkPanel', () => {
  describe('backlinkPanelReducer', () => {
    const initial: BacklinkPanelState = {
      panel: 'expanded',
      linkedSection: 'expanded',
      unlinkedSection: 'collapsed',
      loading: 'idle',
    };

    it('returns the initial state for unknown events', () => {
      const result = backlinkPanelReducer(initial, { type: 'UNKNOWN' } as never);
      expect(result).toEqual(initial);
    });

    it('EXPAND sets panel to expanded', () => {
      const collapsed = { ...initial, panel: 'collapsed' as const };
      const result = backlinkPanelReducer(collapsed, { type: 'EXPAND' });
      expect(result.panel).toBe('expanded');
    });

    it('COLLAPSE sets panel to collapsed', () => {
      const result = backlinkPanelReducer(initial, { type: 'COLLAPSE' });
      expect(result.panel).toBe('collapsed');
    });

    it('EXPAND_LINKED sets linkedSection to expanded', () => {
      const collapsed = { ...initial, linkedSection: 'collapsed' as const };
      const result = backlinkPanelReducer(collapsed, { type: 'EXPAND_LINKED' });
      expect(result.linkedSection).toBe('expanded');
    });

    it('COLLAPSE_LINKED sets linkedSection to collapsed', () => {
      const result = backlinkPanelReducer(initial, { type: 'COLLAPSE_LINKED' });
      expect(result.linkedSection).toBe('collapsed');
    });

    it('EXPAND_UNLINKED sets unlinkedSection to expanded', () => {
      const result = backlinkPanelReducer(initial, { type: 'EXPAND_UNLINKED' });
      expect(result.unlinkedSection).toBe('expanded');
    });

    it('COLLAPSE_UNLINKED sets unlinkedSection to collapsed', () => {
      const expanded = { ...initial, unlinkedSection: 'expanded' as const };
      const result = backlinkPanelReducer(expanded, { type: 'COLLAPSE_UNLINKED' });
      expect(result.unlinkedSection).toBe('collapsed');
    });

    it('LOAD sets loading to loading', () => {
      const result = backlinkPanelReducer(initial, { type: 'LOAD' });
      expect(result.loading).toBe('loading');
    });

    it('LOAD_COMPLETE sets loading to idle', () => {
      const loading = { ...initial, loading: 'loading' as const };
      const result = backlinkPanelReducer(loading, { type: 'LOAD_COMPLETE' });
      expect(result.loading).toBe('idle');
    });

    it('LOAD_ERROR sets loading to error', () => {
      const loading = { ...initial, loading: 'loading' as const };
      const result = backlinkPanelReducer(loading, { type: 'LOAD_ERROR' });
      expect(result.loading).toBe('error');
    });

    it('does not mutate unrelated state fields', () => {
      const result = backlinkPanelReducer(initial, { type: 'COLLAPSE' });
      expect(result.linkedSection).toBe(initial.linkedSection);
      expect(result.unlinkedSection).toBe(initial.unlinkedSection);
      expect(result.loading).toBe(initial.loading);
    });
  });
});

/* ===========================================================================
 * CacheDashboard
 * ========================================================================= */

describe('CacheDashboard', () => {
  describe('cacheDashboardReducer', () => {
    const initial: CacheDashboardState = {
      loading: 'idle',
      keySelection: 'none',
      flushConfirm: 'closed',
      autoRefresh: 'disabled',
      selectedKey: null,
      keySearch: '',
      chartTimeRange: '15m',
      chartMetric: 'throughput',
    };

    it('returns the initial state for unknown events', () => {
      const result = cacheDashboardReducer(initial, { type: 'UNKNOWN' } as never);
      expect(result).toEqual(initial);
    });

    it('LOAD sets loading to loading', () => {
      expect(cacheDashboardReducer(initial, { type: 'LOAD' }).loading).toBe('loading');
    });

    it('LOAD_COMPLETE sets loading to idle', () => {
      const s = { ...initial, loading: 'loading' as const };
      expect(cacheDashboardReducer(s, { type: 'LOAD_COMPLETE' }).loading).toBe('idle');
    });

    it('LOAD_ERROR sets loading to error', () => {
      const s = { ...initial, loading: 'loading' as const };
      expect(cacheDashboardReducer(s, { type: 'LOAD_ERROR' }).loading).toBe('error');
    });

    it('SELECT_KEY selects a key and updates keySelection', () => {
      const result = cacheDashboardReducer(initial, { type: 'SELECT_KEY', key: 'my-key' });
      expect(result.keySelection).toBe('selected');
      expect(result.selectedKey).toBe('my-key');
    });

    it('DESELECT clears the key selection', () => {
      const s = { ...initial, keySelection: 'selected' as const, selectedKey: 'my-key' };
      const result = cacheDashboardReducer(s, { type: 'DESELECT' });
      expect(result.keySelection).toBe('none');
      expect(result.selectedKey).toBeNull();
    });

    it('DELETE_KEY_COMPLETE clears the key selection', () => {
      const s = { ...initial, keySelection: 'selected' as const, selectedKey: 'my-key' };
      const result = cacheDashboardReducer(s, { type: 'DELETE_KEY_COMPLETE' });
      expect(result.keySelection).toBe('none');
      expect(result.selectedKey).toBeNull();
    });

    it('REQUEST_FLUSH opens the flush confirm dialog', () => {
      const result = cacheDashboardReducer(initial, { type: 'REQUEST_FLUSH' });
      expect(result.flushConfirm).toBe('open');
    });

    it('CONFIRM_FLUSH transitions to flushing', () => {
      const s = { ...initial, flushConfirm: 'open' as const };
      expect(cacheDashboardReducer(s, { type: 'CONFIRM_FLUSH' }).flushConfirm).toBe('flushing');
    });

    it('CANCEL_FLUSH closes the dialog', () => {
      const s = { ...initial, flushConfirm: 'open' as const };
      expect(cacheDashboardReducer(s, { type: 'CANCEL_FLUSH' }).flushConfirm).toBe('closed');
    });

    it('FLUSH_COMPLETE closes the dialog', () => {
      const s = { ...initial, flushConfirm: 'flushing' as const };
      expect(cacheDashboardReducer(s, { type: 'FLUSH_COMPLETE' }).flushConfirm).toBe('closed');
    });

    it('FLUSH_ERROR returns to open', () => {
      const s = { ...initial, flushConfirm: 'flushing' as const };
      expect(cacheDashboardReducer(s, { type: 'FLUSH_ERROR' }).flushConfirm).toBe('open');
    });

    it('ENABLE_REFRESH enables auto-refresh', () => {
      expect(cacheDashboardReducer(initial, { type: 'ENABLE_REFRESH' }).autoRefresh).toBe('enabled');
    });

    it('DISABLE_REFRESH disables auto-refresh', () => {
      const s = { ...initial, autoRefresh: 'enabled' as const };
      expect(cacheDashboardReducer(s, { type: 'DISABLE_REFRESH' }).autoRefresh).toBe('disabled');
    });

    it('SET_KEY_SEARCH updates keySearch', () => {
      const result = cacheDashboardReducer(initial, { type: 'SET_KEY_SEARCH', value: 'test' });
      expect(result.keySearch).toBe('test');
    });

    it('SET_TIME_RANGE updates chartTimeRange', () => {
      const result = cacheDashboardReducer(initial, { type: 'SET_TIME_RANGE', value: '1h' });
      expect(result.chartTimeRange).toBe('1h');
    });

    it('SET_METRIC updates chartMetric', () => {
      const result = cacheDashboardReducer(initial, { type: 'SET_METRIC', value: 'latency' });
      expect(result.chartMetric).toBe('latency');
    });
  });

  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('gaugeStatus', () => {
    it('returns good for >= 90', () => {
      expect(gaugeStatus(90)).toBe('good');
      expect(gaugeStatus(100)).toBe('good');
    });

    it('returns warning for >= 50 and < 90', () => {
      expect(gaugeStatus(50)).toBe('warning');
      expect(gaugeStatus(89)).toBe('warning');
    });

    it('returns critical for < 50', () => {
      expect(gaugeStatus(0)).toBe('critical');
      expect(gaugeStatus(49)).toBe('critical');
    });
  });
});

/* ===========================================================================
 * DiffViewer
 * ========================================================================= */

describe('DiffViewer', () => {
  describe('diffViewerReducer', () => {
    const initial: DiffViewerState = {
      mode: 'sideBySide',
      loading: 'idle',
      expandedRanges: new Set(),
      selectedFile: null,
      currentChangeIndex: 0,
    };

    it('returns the initial state for unknown events', () => {
      const result = diffViewerReducer(initial, { type: 'UNKNOWN' } as never);
      expect(result).toEqual(initial);
    });

    it('SWITCH_TO_UNIFIED sets mode to unified', () => {
      expect(diffViewerReducer(initial, { type: 'SWITCH_TO_UNIFIED' }).mode).toBe('unified');
    });

    it('SWITCH_TO_SIDE_BY_SIDE sets mode to sideBySide', () => {
      const s = { ...initial, mode: 'unified' as const };
      expect(diffViewerReducer(s, { type: 'SWITCH_TO_SIDE_BY_SIDE' }).mode).toBe('sideBySide');
    });

    it('EXPAND adds a key to expandedRanges', () => {
      const result = diffViewerReducer(initial, { type: 'EXPAND', key: 'range-1' });
      expect(result.expandedRanges.has('range-1')).toBe(true);
    });

    it('COLLAPSE removes a key from expandedRanges', () => {
      const s = { ...initial, expandedRanges: new Set(['range-1']) };
      const result = diffViewerReducer(s, { type: 'COLLAPSE', key: 'range-1' });
      expect(result.expandedRanges.has('range-1')).toBe(false);
    });

    it('COLLAPSE is a no-op for absent key', () => {
      const result = diffViewerReducer(initial, { type: 'COLLAPSE', key: 'non-existent' });
      expect(result.expandedRanges.size).toBe(0);
    });

    it('SELECT_FILE updates selectedFile', () => {
      const result = diffViewerReducer(initial, { type: 'SELECT_FILE', fileName: 'file.ts' });
      expect(result.selectedFile).toBe('file.ts');
    });

    it('NEXT_CHANGE increments currentChangeIndex', () => {
      const result = diffViewerReducer(initial, { type: 'NEXT_CHANGE' });
      expect(result.currentChangeIndex).toBe(1);
    });

    it('PREV_CHANGE decrements currentChangeIndex but floors at 0', () => {
      const result = diffViewerReducer(initial, { type: 'PREV_CHANGE' });
      expect(result.currentChangeIndex).toBe(0);

      const s = { ...initial, currentChangeIndex: 5 };
      expect(diffViewerReducer(s, { type: 'PREV_CHANGE' }).currentChangeIndex).toBe(4);
    });
  });

  describe('computeDiffLines', () => {
    it('returns unchanged lines for identical strings', () => {
      const lines = computeDiffLines('a\nb', 'a\nb');
      expect(lines).toHaveLength(2);
      expect(lines.every((l) => l.type === 'unchanged')).toBe(true);
    });

    it('detects added lines', () => {
      const lines = computeDiffLines('', 'new');
      expect(lines.some((l) => l.type === 'added')).toBe(true);
    });

    it('detects removed lines', () => {
      const lines = computeDiffLines('old', '');
      expect(lines.some((l) => l.type === 'removed')).toBe(true);
    });

    it('handles both additions and removals', () => {
      const lines = computeDiffLines('line1\nline2', 'line1\nline3');
      const types = lines.map((l) => l.type);
      expect(types).toContain('unchanged');
      expect(types.some((t) => t === 'removed' || t === 'added')).toBe(true);
    });
  });
});

/* ===========================================================================
 * FacetedSearch
 * ========================================================================= */

describe('FacetedSearch', () => {
  describe('facetedSearchReducer', () => {
    const initial: FacetedSearchState = {
      search: 'idle',
      expandedFacets: new Set(['color', 'size']),
      expandedShowMore: new Set(),
      query: '',
    };

    it('returns initial state for unknown events', () => {
      const result = facetedSearchReducer(initial, { type: 'UNKNOWN' } as never);
      expect(result).toEqual(initial);
    });

    it('SEARCH sets search to searching and updates query', () => {
      const result = facetedSearchReducer(initial, { type: 'SEARCH', query: 'shoes' });
      expect(result.search).toBe('searching');
      expect(result.query).toBe('shoes');
    });

    it('SEARCH_COMPLETE with results sets hasResults', () => {
      const s = { ...initial, search: 'searching' as const };
      const result = facetedSearchReducer(s, { type: 'SEARCH_COMPLETE', hasResults: true });
      expect(result.search).toBe('hasResults');
    });

    it('SEARCH_COMPLETE without results sets noResults', () => {
      const s = { ...initial, search: 'searching' as const };
      const result = facetedSearchReducer(s, { type: 'SEARCH_COMPLETE', hasResults: false });
      expect(result.search).toBe('noResults');
    });

    it('SEARCH_ERROR sets search to error', () => {
      const s = { ...initial, search: 'searching' as const };
      expect(facetedSearchReducer(s, { type: 'SEARCH_ERROR' }).search).toBe('error');
    });

    it('COLLAPSE_FACET removes a key from expandedFacets', () => {
      const result = facetedSearchReducer(initial, { type: 'COLLAPSE_FACET', key: 'color' });
      expect(result.expandedFacets.has('color')).toBe(false);
      expect(result.expandedFacets.has('size')).toBe(true);
    });

    it('EXPAND_FACET adds a key to expandedFacets', () => {
      const result = facetedSearchReducer(initial, { type: 'EXPAND_FACET', key: 'brand' });
      expect(result.expandedFacets.has('brand')).toBe(true);
    });

    it('SHOW_MORE adds a key to expandedShowMore', () => {
      const result = facetedSearchReducer(initial, { type: 'SHOW_MORE', key: 'color' });
      expect(result.expandedShowMore.has('color')).toBe(true);
    });

    it('SHOW_LESS removes a key from expandedShowMore', () => {
      const s = { ...initial, expandedShowMore: new Set(['color']) };
      const result = facetedSearchReducer(s, { type: 'SHOW_LESS', key: 'color' });
      expect(result.expandedShowMore.has('color')).toBe(false);
    });

    it('SET_QUERY updates query without changing search state', () => {
      const result = facetedSearchReducer(initial, { type: 'SET_QUERY', query: 'test' });
      expect(result.query).toBe('test');
      expect(result.search).toBe('idle');
    });
  });
});

/* ===========================================================================
 * FileBrowser
 * ========================================================================= */

describe('FileBrowser', () => {
  describe('fileBrowserReducer', () => {
    const initial: FileBrowserState = {
      view: 'grid',
      selection: 'none',
      upload: 'idle',
      sidebar: 'hidden',
      loading: 'idle',
      rename: 'idle',
      selectedIds: [],
      renamingId: null,
      renameValue: '',
      searchQuery: '',
    };

    it('returns initial state for unknown events', () => {
      expect(fileBrowserReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('SWITCH_TO_GRID sets view to grid', () => {
      const s = { ...initial, view: 'list' as const };
      expect(fileBrowserReducer(s, { type: 'SWITCH_TO_GRID' }).view).toBe('grid');
    });

    it('SWITCH_TO_LIST sets view to list', () => {
      expect(fileBrowserReducer(initial, { type: 'SWITCH_TO_LIST' }).view).toBe('list');
    });

    it('SELECT selects a single item and shows sidebar', () => {
      const result = fileBrowserReducer(initial, { type: 'SELECT', id: 'f1' });
      expect(result.selectedIds).toEqual(['f1']);
      expect(result.selection).toBe('single');
      expect(result.sidebar).toBe('visible');
    });

    it('SELECT_ADDITIONAL adds an item to selection', () => {
      const s = { ...initial, selectedIds: ['f1'], selection: 'single' as const };
      const result = fileBrowserReducer(s, { type: 'SELECT_ADDITIONAL', id: 'f2' });
      expect(result.selectedIds).toEqual(['f1', 'f2']);
      expect(result.selection).toBe('multiple');
      expect(result.sidebar).toBe('visible');
    });

    it('SELECT_ADDITIONAL toggles off a selected item', () => {
      const s = { ...initial, selectedIds: ['f1', 'f2'], selection: 'multiple' as const };
      const result = fileBrowserReducer(s, { type: 'SELECT_ADDITIONAL', id: 'f1' });
      expect(result.selectedIds).toEqual(['f2']);
      expect(result.selection).toBe('single');
    });

    it('SELECT_ADDITIONAL deselecting last item sets selection to none', () => {
      const s = { ...initial, selectedIds: ['f1'], selection: 'single' as const, sidebar: 'visible' as const };
      const result = fileBrowserReducer(s, { type: 'SELECT_ADDITIONAL', id: 'f1' });
      expect(result.selectedIds).toEqual([]);
      expect(result.selection).toBe('none');
      expect(result.sidebar).toBe('hidden');
    });

    it('DESELECT_ALL clears selection and hides sidebar', () => {
      const s = { ...initial, selectedIds: ['f1', 'f2'], selection: 'multiple' as const, sidebar: 'visible' as const };
      const result = fileBrowserReducer(s, { type: 'DESELECT_ALL' });
      expect(result.selectedIds).toEqual([]);
      expect(result.selection).toBe('none');
      expect(result.sidebar).toBe('hidden');
    });

    it('DRAG_ENTER sets upload to dragOver', () => {
      expect(fileBrowserReducer(initial, { type: 'DRAG_ENTER' }).upload).toBe('dragOver');
    });

    it('DRAG_LEAVE sets upload to idle', () => {
      const s = { ...initial, upload: 'dragOver' as const };
      expect(fileBrowserReducer(s, { type: 'DRAG_LEAVE' }).upload).toBe('idle');
    });

    it('DROP sets upload to uploading', () => {
      const s = { ...initial, upload: 'dragOver' as const };
      expect(fileBrowserReducer(s, { type: 'DROP' }).upload).toBe('uploading');
    });

    it('UPLOAD_COMPLETE sets upload to idle', () => {
      const s = { ...initial, upload: 'uploading' as const };
      expect(fileBrowserReducer(s, { type: 'UPLOAD_COMPLETE' }).upload).toBe('idle');
    });

    it('START_RENAME begins renaming', () => {
      const result = fileBrowserReducer(initial, { type: 'START_RENAME', id: 'f1', name: 'old.txt' });
      expect(result.rename).toBe('renaming');
      expect(result.renamingId).toBe('f1');
      expect(result.renameValue).toBe('old.txt');
    });

    it('COMMIT_RENAME finishes renaming', () => {
      const s = { ...initial, rename: 'renaming' as const, renamingId: 'f1', renameValue: 'new.txt' };
      const result = fileBrowserReducer(s, { type: 'COMMIT_RENAME' });
      expect(result.rename).toBe('idle');
      expect(result.renamingId).toBeNull();
      expect(result.renameValue).toBe('');
    });

    it('CANCEL_RENAME finishes renaming', () => {
      const s = { ...initial, rename: 'renaming' as const, renamingId: 'f1', renameValue: 'new.txt' };
      const result = fileBrowserReducer(s, { type: 'CANCEL_RENAME' });
      expect(result.rename).toBe('idle');
      expect(result.renamingId).toBeNull();
    });

    it('UPDATE_RENAME updates renameValue', () => {
      const s = { ...initial, rename: 'renaming' as const, renamingId: 'f1', renameValue: 'old' };
      expect(fileBrowserReducer(s, { type: 'UPDATE_RENAME', value: 'new' }).renameValue).toBe('new');
    });

    it('SET_SEARCH updates searchQuery', () => {
      expect(fileBrowserReducer(initial, { type: 'SET_SEARCH', value: 'hello' }).searchQuery).toBe('hello');
    });

    it('SHOW_DETAIL sets sidebar to visible', () => {
      expect(fileBrowserReducer(initial, { type: 'SHOW_DETAIL' }).sidebar).toBe('visible');
    });

    it('HIDE_DETAIL sets sidebar to hidden', () => {
      const s = { ...initial, sidebar: 'visible' as const };
      expect(fileBrowserReducer(s, { type: 'HIDE_DETAIL' }).sidebar).toBe('hidden');
    });
  });
});

/* ===========================================================================
 * FilterBuilder
 * ========================================================================= */

describe('FilterBuilder', () => {
  describe('filterBuilderReducer', () => {
    beforeEach(() => {
      resetFilterCounter();
    });

    const initial: FilterBuilderState = {
      filterCount: 'empty',
      editingRowId: null,
      filters: [],
      logic: 'and',
    };

    it('returns initial state for unknown events', () => {
      expect(filterBuilderReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('ADD_FILTER adds a filter and sets filterCount to hasFilters', () => {
      const result = filterBuilderReducer(initial, { type: 'ADD_FILTER' });
      expect(result.filterCount).toBe('hasFilters');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].field).toBe('');
      expect(result.filters[0].operator).toBe('');
      expect(result.filters[0].value).toBe('');
      expect(result.filters[0].logic).toBe('and');
    });

    it('REMOVE_FILTER removes the targeted filter', () => {
      const withFilter: FilterBuilderState = {
        ...initial,
        filterCount: 'hasFilters',
        filters: [{ id: 'f1', field: 'name', operator: 'eq', value: 'test', logic: 'and' }],
      };
      const result = filterBuilderReducer(withFilter, { type: 'REMOVE_FILTER', id: 'f1' });
      expect(result.filters).toHaveLength(0);
      expect(result.filterCount).toBe('empty');
    });

    it('REMOVE_FILTER clears editingRowId if it matches', () => {
      const s: FilterBuilderState = {
        ...initial,
        filterCount: 'hasFilters',
        editingRowId: 'f1',
        filters: [{ id: 'f1', field: 'a', operator: 'eq', value: '1' }],
      };
      const result = filterBuilderReducer(s, { type: 'REMOVE_FILTER', id: 'f1' });
      expect(result.editingRowId).toBeNull();
    });

    it('REMOVE_FILTER preserves editingRowId if it does not match', () => {
      const s: FilterBuilderState = {
        ...initial,
        filterCount: 'hasFilters',
        editingRowId: 'f2',
        filters: [
          { id: 'f1', field: 'a', operator: 'eq', value: '1' },
          { id: 'f2', field: 'b', operator: 'eq', value: '2' },
        ],
      };
      const result = filterBuilderReducer(s, { type: 'REMOVE_FILTER', id: 'f1' });
      expect(result.editingRowId).toBe('f2');
    });

    it('CLEAR_ALL removes all filters', () => {
      const s: FilterBuilderState = {
        ...initial,
        filterCount: 'hasFilters',
        editingRowId: 'f1',
        filters: [{ id: 'f1', field: 'a', operator: 'eq', value: '1' }],
      };
      const result = filterBuilderReducer(s, { type: 'CLEAR_ALL' });
      expect(result.filters).toHaveLength(0);
      expect(result.filterCount).toBe('empty');
      expect(result.editingRowId).toBeNull();
    });

    it('FIELD_CHANGE updates the field and resets operator and value', () => {
      const s: FilterBuilderState = {
        ...initial,
        filters: [{ id: 'f1', field: 'old', operator: 'eq', value: 'val' }],
        filterCount: 'hasFilters',
      };
      const result = filterBuilderReducer(s, { type: 'FIELD_CHANGE', id: 'f1', field: 'new' });
      expect(result.filters[0].field).toBe('new');
      expect(result.filters[0].operator).toBe('');
      expect(result.filters[0].value).toBe('');
    });

    it('OPERATOR_CHANGE updates operator and resets value', () => {
      const s: FilterBuilderState = {
        ...initial,
        filters: [{ id: 'f1', field: 'name', operator: 'eq', value: 'val' }],
        filterCount: 'hasFilters',
      };
      const result = filterBuilderReducer(s, { type: 'OPERATOR_CHANGE', id: 'f1', operator: 'neq' });
      expect(result.filters[0].operator).toBe('neq');
      expect(result.filters[0].value).toBe('');
    });

    it('VALUE_CHANGE updates the value', () => {
      const s: FilterBuilderState = {
        ...initial,
        filters: [{ id: 'f1', field: 'name', operator: 'eq', value: '' }],
        filterCount: 'hasFilters',
      };
      const result = filterBuilderReducer(s, { type: 'VALUE_CHANGE', id: 'f1', value: 'hello' });
      expect(result.filters[0].value).toBe('hello');
    });

    it('TOGGLE_LOGIC toggles a filter row logic', () => {
      const s: FilterBuilderState = {
        ...initial,
        filters: [{ id: 'f1', field: 'a', operator: 'eq', value: '1', logic: 'and' }],
        filterCount: 'hasFilters',
      };
      const result = filterBuilderReducer(s, { type: 'TOGGLE_LOGIC', id: 'f1' });
      expect(result.filters[0].logic).toBe('or');
      const result2 = filterBuilderReducer(result, { type: 'TOGGLE_LOGIC', id: 'f1' });
      expect(result2.filters[0].logic).toBe('and');
    });

    it('TOGGLE_ROOT_LOGIC toggles the root logic', () => {
      expect(filterBuilderReducer(initial, { type: 'TOGGLE_ROOT_LOGIC' }).logic).toBe('or');
      const s = { ...initial, logic: 'or' as const };
      expect(filterBuilderReducer(s, { type: 'TOGGLE_ROOT_LOGIC' }).logic).toBe('and');
    });

    it('FOCUS_ROW sets editingRowId', () => {
      expect(filterBuilderReducer(initial, { type: 'FOCUS_ROW', id: 'f1' }).editingRowId).toBe('f1');
    });

    it('BLUR_ROW clears editingRowId', () => {
      const s = { ...initial, editingRowId: 'f1' };
      expect(filterBuilderReducer(s, { type: 'BLUR_ROW' }).editingRowId).toBeNull();
    });
  });
});

/* ===========================================================================
 * MasterDetail
 * ========================================================================= */

describe('MasterDetail', () => {
  describe('masterDetailReducer', () => {
    const initial: MasterDetailState = {
      selection: 'noSelection',
      layout: 'split',
      stackedView: 'showingList',
      loading: 'idle',
      selectedId: null,
      searchQuery: '',
    };

    it('returns initial state for unknown events', () => {
      expect(masterDetailReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('SELECT sets selection to hasSelection and updates selectedId', () => {
      const result = masterDetailReducer(initial, { type: 'SELECT', id: 'item-1' });
      expect(result.selection).toBe('hasSelection');
      expect(result.selectedId).toBe('item-1');
    });

    it('SELECT in stacked layout navigates to showingDetail', () => {
      const s = { ...initial, layout: 'stacked' as const };
      const result = masterDetailReducer(s, { type: 'SELECT', id: 'item-1' });
      expect(result.stackedView).toBe('showingDetail');
    });

    it('SELECT in split layout does not change stackedView', () => {
      const result = masterDetailReducer(initial, { type: 'SELECT', id: 'item-1' });
      expect(result.stackedView).toBe('showingList');
    });

    it('DESELECT clears selection and returns to showingList', () => {
      const s: MasterDetailState = {
        ...initial,
        selection: 'hasSelection',
        selectedId: 'item-1',
        stackedView: 'showingDetail',
      };
      const result = masterDetailReducer(s, { type: 'DESELECT' });
      expect(result.selection).toBe('noSelection');
      expect(result.selectedId).toBeNull();
      expect(result.stackedView).toBe('showingList');
    });

    it('BACK returns to showingList', () => {
      const s = { ...initial, stackedView: 'showingDetail' as const };
      expect(masterDetailReducer(s, { type: 'BACK' }).stackedView).toBe('showingList');
    });

    it('COLLAPSE sets layout to stacked', () => {
      expect(masterDetailReducer(initial, { type: 'COLLAPSE' }).layout).toBe('stacked');
    });

    it('EXPAND sets layout to split', () => {
      const s = { ...initial, layout: 'stacked' as const };
      expect(masterDetailReducer(s, { type: 'EXPAND' }).layout).toBe('split');
    });

    it('SET_SEARCH updates searchQuery', () => {
      expect(masterDetailReducer(initial, { type: 'SET_SEARCH', value: 'test' }).searchQuery).toBe('test');
    });
  });
});

/* ===========================================================================
 * NotificationCenter
 * ========================================================================= */

describe('NotificationCenter', () => {
  describe('notificationCenterReducer', () => {
    const initial: NotificationCenterState = {
      panel: 'closed',
      loading: 'idle',
      unread: 'none',
      activeTab: 'all',
    };

    it('returns initial state for unknown events', () => {
      expect(notificationCenterReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('TOGGLE toggles panel state', () => {
      expect(notificationCenterReducer(initial, { type: 'TOGGLE' }).panel).toBe('open');
      const open = { ...initial, panel: 'open' as const };
      expect(notificationCenterReducer(open, { type: 'TOGGLE' }).panel).toBe('closed');
    });

    it('OPEN sets panel to open', () => {
      expect(notificationCenterReducer(initial, { type: 'OPEN' }).panel).toBe('open');
    });

    it('CLOSE sets panel to closed', () => {
      const open = { ...initial, panel: 'open' as const };
      expect(notificationCenterReducer(open, { type: 'CLOSE' }).panel).toBe('closed');
    });

    it('LOAD sets loading to loading', () => {
      expect(notificationCenterReducer(initial, { type: 'LOAD' }).loading).toBe('loading');
    });

    it('LOAD_COMPLETE sets loading to idle', () => {
      const s = { ...initial, loading: 'loading' as const };
      expect(notificationCenterReducer(s, { type: 'LOAD_COMPLETE' }).loading).toBe('idle');
    });

    it('LOAD_ERROR sets loading to error', () => {
      const s = { ...initial, loading: 'loading' as const };
      expect(notificationCenterReducer(s, { type: 'LOAD_ERROR' }).loading).toBe('error');
    });

    it('MARK_ALL_READ sets unread to none', () => {
      const s = { ...initial, unread: 'hasUnread' as const };
      expect(notificationCenterReducer(s, { type: 'MARK_ALL_READ' }).unread).toBe('none');
    });

    it('CHANGE_TAB updates activeTab', () => {
      expect(notificationCenterReducer(initial, { type: 'CHANGE_TAB', tab: 'unread' }).activeTab).toBe('unread');
    });
  });
});

/* ===========================================================================
 * PermissionMatrix
 * ========================================================================= */

describe('PermissionMatrix', () => {
  describe('permissionMatrixReducer', () => {
    const initial: PermissionMatrixState = {
      collapsedGroups: new Set(),
      saving: 'idle',
      focusRow: 0,
      focusCol: 0,
    };

    it('returns initial state for unknown events', () => {
      expect(permissionMatrixReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('COLLAPSE adds resource to collapsedGroups', () => {
      const result = permissionMatrixReducer(initial, { type: 'COLLAPSE', resource: 'posts' });
      expect(result.collapsedGroups.has('posts')).toBe(true);
    });

    it('EXPAND removes resource from collapsedGroups', () => {
      const s = { ...initial, collapsedGroups: new Set(['posts']) };
      const result = permissionMatrixReducer(s, { type: 'EXPAND', resource: 'posts' });
      expect(result.collapsedGroups.has('posts')).toBe(false);
    });

    it('CHANGE sets saving to pending', () => {
      expect(permissionMatrixReducer(initial, { type: 'CHANGE' }).saving).toBe('pending');
    });

    it('SAVE sets saving to saving', () => {
      const s = { ...initial, saving: 'pending' as const };
      expect(permissionMatrixReducer(s, { type: 'SAVE' }).saving).toBe('saving');
    });

    it('SAVE_COMPLETE sets saving to idle', () => {
      const s = { ...initial, saving: 'saving' as const };
      expect(permissionMatrixReducer(s, { type: 'SAVE_COMPLETE' }).saving).toBe('idle');
    });

    it('DISCARD sets saving to idle', () => {
      const s = { ...initial, saving: 'pending' as const };
      expect(permissionMatrixReducer(s, { type: 'DISCARD' }).saving).toBe('idle');
    });

    it('NAVIGATE updates focusRow and focusCol', () => {
      const result = permissionMatrixReducer(initial, { type: 'NAVIGATE', row: 3, col: 2 });
      expect(result.focusRow).toBe(3);
      expect(result.focusCol).toBe(2);
    });
  });

  describe('permission helpers', () => {
    const permissions = {
      posts: { read: ['admin', 'editor'], write: ['admin'] },
      comments: { read: ['admin', 'editor', 'viewer'], write: ['admin', 'editor'] },
    };

    const postsResource = { key: 'posts', name: 'Posts', actions: [{ key: 'read', name: 'Read' }, { key: 'write', name: 'Write' }] };
    const commentsResource = { key: 'comments', name: 'Comments', actions: [{ key: 'read', name: 'Read' }, { key: 'write', name: 'Write' }] };

    it('isGranted returns true for granted permissions', () => {
      expect(isGranted(permissions, 'posts', 'read', 'admin')).toBe(true);
    });

    it('isGranted returns false for non-granted permissions', () => {
      expect(isGranted(permissions, 'posts', 'write', 'editor')).toBe(false);
    });

    it('isGranted returns false for nonexistent resource', () => {
      expect(isGranted(permissions, 'users', 'read', 'admin')).toBe(false);
    });

    it('allActionsGranted returns true when all actions are granted', () => {
      expect(allActionsGranted(permissions, postsResource, 'admin')).toBe(true);
    });

    it('allActionsGranted returns false when not all actions are granted', () => {
      expect(allActionsGranted(permissions, postsResource, 'editor')).toBe(false);
    });

    it('someActionsGranted returns true when some actions are granted', () => {
      expect(someActionsGranted(permissions, postsResource, 'editor')).toBe(true);
    });

    it('someActionsGranted returns false when no actions are granted', () => {
      expect(someActionsGranted(permissions, postsResource, 'viewer')).toBe(false);
    });

    it('allGranted returns true when all resources have all actions granted', () => {
      expect(allGranted(permissions, [postsResource, commentsResource], 'admin')).toBe(true);
    });

    it('allGranted returns false when not all resources are fully granted', () => {
      expect(allGranted(permissions, [postsResource, commentsResource], 'editor')).toBe(false);
    });

    it('someGranted returns true when at least one resource has some actions granted', () => {
      expect(someGranted(permissions, [postsResource, commentsResource], 'editor')).toBe(true);
    });

    it('someGranted returns false when no resources have any actions granted', () => {
      expect(someGranted(permissions, [postsResource], 'viewer')).toBe(false);
    });
  });
});

/* ===========================================================================
 * PluginCard
 * ========================================================================= */

describe('PluginCard', () => {
  describe('pluginCardReducer', () => {
    const initial: PluginCardState = {
      lifecycle: 'available',
      hover: 'idle',
      focus: 'unfocused',
    };

    it('returns initial state for unknown events', () => {
      expect(pluginCardReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('INSTALL sets lifecycle to installing', () => {
      expect(pluginCardReducer(initial, { type: 'INSTALL' }).lifecycle).toBe('installing');
    });

    it('INSTALL_COMPLETE sets lifecycle to installed', () => {
      const s = { ...initial, lifecycle: 'installing' as const };
      expect(pluginCardReducer(s, { type: 'INSTALL_COMPLETE' }).lifecycle).toBe('installed');
    });

    it('INSTALL_ERROR sets lifecycle back to available', () => {
      const s = { ...initial, lifecycle: 'installing' as const };
      expect(pluginCardReducer(s, { type: 'INSTALL_ERROR' }).lifecycle).toBe('available');
    });

    it('ENABLE sets lifecycle to enabled', () => {
      const s = { ...initial, lifecycle: 'installed' as const };
      expect(pluginCardReducer(s, { type: 'ENABLE' }).lifecycle).toBe('enabled');
    });

    it('DISABLE sets lifecycle to installed', () => {
      const s = { ...initial, lifecycle: 'enabled' as const };
      expect(pluginCardReducer(s, { type: 'DISABLE' }).lifecycle).toBe('installed');
    });

    it('UNINSTALL sets lifecycle to uninstalling', () => {
      const s = { ...initial, lifecycle: 'installed' as const };
      expect(pluginCardReducer(s, { type: 'UNINSTALL' }).lifecycle).toBe('uninstalling');
    });

    it('UNINSTALL_COMPLETE sets lifecycle to available', () => {
      const s = { ...initial, lifecycle: 'uninstalling' as const };
      expect(pluginCardReducer(s, { type: 'UNINSTALL_COMPLETE' }).lifecycle).toBe('available');
    });

    it('UNINSTALL_ERROR sets lifecycle to installed', () => {
      const s = { ...initial, lifecycle: 'uninstalling' as const };
      expect(pluginCardReducer(s, { type: 'UNINSTALL_ERROR' }).lifecycle).toBe('installed');
    });

    it('POINTER_ENTER sets hover to hovered', () => {
      expect(pluginCardReducer(initial, { type: 'POINTER_ENTER' }).hover).toBe('hovered');
    });

    it('POINTER_LEAVE sets hover to idle', () => {
      const s = { ...initial, hover: 'hovered' as const };
      expect(pluginCardReducer(s, { type: 'POINTER_LEAVE' }).hover).toBe('idle');
    });

    it('FOCUS sets focus to focused', () => {
      expect(pluginCardReducer(initial, { type: 'FOCUS' }).focus).toBe('focused');
    });

    it('BLUR sets focus to unfocused', () => {
      const s = { ...initial, focus: 'focused' as const };
      expect(pluginCardReducer(s, { type: 'BLUR' }).focus).toBe('unfocused');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers below 1000 as-is', () => {
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
      expect(formatNumber(1000)).toBe('1.0K');
      expect(formatNumber(5500)).toBe('5.5K');
    });

    it('formats millions with M suffix', () => {
      expect(formatNumber(1000000)).toBe('1.0M');
      expect(formatNumber(2500000)).toBe('2.5M');
    });
  });

  describe('buttonLabel', () => {
    it('returns correct labels for each lifecycle state', () => {
      expect(buttonLabel('available')).toBe('Install');
      expect(buttonLabel('installing')).toBe('Installing...');
      expect(buttonLabel('installed')).toBe('Enable');
      expect(buttonLabel('enabled')).toBe('Disable');
      expect(buttonLabel('uninstalling')).toBe('Uninstalling...');
    });
  });
});

/* ===========================================================================
 * PreferenceMatrix
 * ========================================================================= */

describe('PreferenceMatrix', () => {
  describe('preferenceMatrixReducer', () => {
    const initial: PreferenceMatrixState = {
      loading: 'idle',
      saving: 'idle',
      focusRow: 0,
      focusCol: 0,
    };

    it('returns initial state for unknown events', () => {
      expect(preferenceMatrixReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('LOAD sets loading to loading', () => {
      expect(preferenceMatrixReducer(initial, { type: 'LOAD' }).loading).toBe('loading');
    });

    it('LOAD_COMPLETE sets loading to idle', () => {
      const s = { ...initial, loading: 'loading' as const };
      expect(preferenceMatrixReducer(s, { type: 'LOAD_COMPLETE' }).loading).toBe('idle');
    });

    it('NAVIGATE updates focusRow and focusCol', () => {
      const result = preferenceMatrixReducer(initial, { type: 'NAVIGATE', row: 2, col: 1 });
      expect(result.focusRow).toBe(2);
      expect(result.focusCol).toBe(1);
    });

    it('LOAD does not affect saving state', () => {
      expect(preferenceMatrixReducer(initial, { type: 'LOAD' }).saving).toBe('idle');
    });

    it('NAVIGATE does not affect loading state', () => {
      expect(preferenceMatrixReducer(initial, { type: 'NAVIGATE', row: 1, col: 1 }).loading).toBe('idle');
    });
  });
});

/* ===========================================================================
 * PropertyPanel
 * ========================================================================= */

describe('PropertyPanel', () => {
  describe('propertyPanelReducer', () => {
    const initial: PropertyPanelState = {
      panel: 'expanded',
      editingKey: null,
      editValue: null,
      draggingKey: null,
    };

    it('returns initial state for unknown events', () => {
      expect(propertyPanelReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('EXPAND sets panel to expanded', () => {
      const s = { ...initial, panel: 'collapsed' as const };
      expect(propertyPanelReducer(s, { type: 'EXPAND' }).panel).toBe('expanded');
    });

    it('COLLAPSE sets panel to collapsed', () => {
      expect(propertyPanelReducer(initial, { type: 'COLLAPSE' }).panel).toBe('collapsed');
    });

    it('CLICK_VALUE sets editingKey and editValue', () => {
      const result = propertyPanelReducer(initial, { type: 'CLICK_VALUE', key: 'status', value: 'active' });
      expect(result.editingKey).toBe('status');
      expect(result.editValue).toBe('active');
    });

    it('COMMIT clears editing state', () => {
      const s: PropertyPanelState = { ...initial, editingKey: 'status', editValue: 'active' };
      const result = propertyPanelReducer(s, { type: 'COMMIT', value: 'done' });
      expect(result.editingKey).toBeNull();
      expect(result.editValue).toBeNull();
    });

    it('CANCEL clears editing state', () => {
      const s: PropertyPanelState = { ...initial, editingKey: 'status', editValue: 'active' };
      const result = propertyPanelReducer(s, { type: 'CANCEL' });
      expect(result.editingKey).toBeNull();
      expect(result.editValue).toBeNull();
    });

    it('BLUR clears editing state', () => {
      const s: PropertyPanelState = { ...initial, editingKey: 'status', editValue: 'active' };
      const result = propertyPanelReducer(s, { type: 'BLUR' });
      expect(result.editingKey).toBeNull();
      expect(result.editValue).toBeNull();
    });

    it('EDIT_VALUE updates editValue', () => {
      const s: PropertyPanelState = { ...initial, editingKey: 'status', editValue: 'old' };
      expect(propertyPanelReducer(s, { type: 'EDIT_VALUE', value: 'new' }).editValue).toBe('new');
    });

    it('DRAG_START sets draggingKey', () => {
      expect(propertyPanelReducer(initial, { type: 'DRAG_START', key: 'prop1' }).draggingKey).toBe('prop1');
    });

    it('DROP clears draggingKey', () => {
      const s = { ...initial, draggingKey: 'prop1' };
      expect(propertyPanelReducer(s, { type: 'DROP' }).draggingKey).toBeNull();
    });
  });
});

/* ===========================================================================
 * QueueDashboard
 * ========================================================================= */

describe('QueueDashboard', () => {
  describe('queueDashboardReducer', () => {
    const initial: QueueDashboardState = {
      loading: 'idle',
      detail: 'closed',
      autoRefresh: 'disabled',
      tab: 'all',
      selectedJobId: null,
      chartTimeRange: '1h',
    };

    it('returns initial state for unknown events', () => {
      expect(queueDashboardReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('LOAD sets loading to loading', () => {
      expect(queueDashboardReducer(initial, { type: 'LOAD' }).loading).toBe('loading');
    });

    it('LOAD_COMPLETE sets loading to idle', () => {
      const s = { ...initial, loading: 'loading' as const };
      expect(queueDashboardReducer(s, { type: 'LOAD_COMPLETE' }).loading).toBe('idle');
    });

    it('LOAD_ERROR sets loading to error', () => {
      const s = { ...initial, loading: 'loading' as const };
      expect(queueDashboardReducer(s, { type: 'LOAD_ERROR' }).loading).toBe('error');
    });

    it('SELECT_JOB opens detail and selects the job', () => {
      const result = queueDashboardReducer(initial, { type: 'SELECT_JOB', jobId: 'j1' });
      expect(result.detail).toBe('open');
      expect(result.selectedJobId).toBe('j1');
    });

    it('CLOSE_DETAIL closes detail and clears selected job', () => {
      const s = { ...initial, detail: 'open' as const, selectedJobId: 'j1' };
      const result = queueDashboardReducer(s, { type: 'CLOSE_DETAIL' });
      expect(result.detail).toBe('closed');
      expect(result.selectedJobId).toBeNull();
    });

    it('DESELECT closes detail and clears selected job', () => {
      const s = { ...initial, detail: 'open' as const, selectedJobId: 'j1' };
      const result = queueDashboardReducer(s, { type: 'DESELECT' });
      expect(result.detail).toBe('closed');
      expect(result.selectedJobId).toBeNull();
    });

    it('ENABLE_REFRESH enables auto-refresh', () => {
      expect(queueDashboardReducer(initial, { type: 'ENABLE_REFRESH' }).autoRefresh).toBe('enabled');
    });

    it('DISABLE_REFRESH disables auto-refresh', () => {
      const s = { ...initial, autoRefresh: 'enabled' as const };
      expect(queueDashboardReducer(s, { type: 'DISABLE_REFRESH' }).autoRefresh).toBe('disabled');
    });

    it('CHANGE_TAB updates tab', () => {
      expect(queueDashboardReducer(initial, { type: 'CHANGE_TAB', tab: 'failed' }).tab).toBe('failed');
    });

    it('SET_TIME_RANGE updates chartTimeRange', () => {
      expect(queueDashboardReducer(initial, { type: 'SET_TIME_RANGE', value: '7d' }).chartTimeRange).toBe('7d');
    });
  });
});

/* ===========================================================================
 * SchemaEditor
 * ========================================================================= */

describe('SchemaEditor', () => {
  describe('schemaEditorReducer', () => {
    beforeEach(() => {
      resetFieldCounter();
    });

    const initial: SchemaEditorState = {
      fieldCount: 'empty',
      expandedFieldId: null,
      draggingFieldId: null,
      fields: [],
    };

    it('returns initial state for unknown events', () => {
      expect(schemaEditorReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('ADD_FIELD adds a field with default values and expands it', () => {
      const result = schemaEditorReducer(initial, { type: 'ADD_FIELD' });
      expect(result.fieldCount).toBe('hasFields');
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0].name).toBe('');
      expect(result.fields[0].type).toBe('text');
      expect(result.fields[0].required).toBe(false);
      expect(result.expandedFieldId).toBe(result.fields[0].id);
    });

    it('REMOVE_FIELD removes the targeted field', () => {
      const s: SchemaEditorState = {
        ...initial,
        fieldCount: 'hasFields',
        fields: [{ id: 'f1', name: 'Title', type: 'text', required: false }],
      };
      const result = schemaEditorReducer(s, { type: 'REMOVE_FIELD', id: 'f1' });
      expect(result.fields).toHaveLength(0);
      expect(result.fieldCount).toBe('empty');
    });

    it('REMOVE_FIELD clears expandedFieldId if it matches the removed field', () => {
      const s: SchemaEditorState = {
        ...initial,
        fieldCount: 'hasFields',
        expandedFieldId: 'f1',
        fields: [{ id: 'f1', name: 'Title', type: 'text', required: false }],
      };
      const result = schemaEditorReducer(s, { type: 'REMOVE_FIELD', id: 'f1' });
      expect(result.expandedFieldId).toBeNull();
    });

    it('REMOVE_FIELD preserves expandedFieldId if it does not match', () => {
      const s: SchemaEditorState = {
        ...initial,
        fieldCount: 'hasFields',
        expandedFieldId: 'f2',
        fields: [
          { id: 'f1', name: 'Title', type: 'text', required: false },
          { id: 'f2', name: 'Author', type: 'text', required: false },
        ],
      };
      const result = schemaEditorReducer(s, { type: 'REMOVE_FIELD', id: 'f1' });
      expect(result.expandedFieldId).toBe('f2');
    });

    it('CLEAR_ALL removes all fields', () => {
      const s: SchemaEditorState = {
        ...initial,
        fieldCount: 'hasFields',
        expandedFieldId: 'f1',
        draggingFieldId: 'f1',
        fields: [{ id: 'f1', name: 'Title', type: 'text', required: false }],
      };
      const result = schemaEditorReducer(s, { type: 'CLEAR_ALL' });
      expect(result.fields).toHaveLength(0);
      expect(result.fieldCount).toBe('empty');
      expect(result.expandedFieldId).toBeNull();
      expect(result.draggingFieldId).toBeNull();
    });

    it('NAME_CHANGE updates the field name', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [{ id: 'f1', name: '', type: 'text', required: false }],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'NAME_CHANGE', id: 'f1', name: 'Title' });
      expect(result.fields[0].name).toBe('Title');
    });

    it('TYPE_CHANGE updates the field type and clears config/options', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [{ id: 'f1', name: 'X', type: 'text', required: false, config: { a: 1 }, options: ['a'] }],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'TYPE_CHANGE', id: 'f1', fieldType: 'number' });
      expect(result.fields[0].type).toBe('number');
      expect(result.fields[0].config).toEqual({});
      expect(result.fields[0].options).toBeUndefined();
      expect(result.expandedFieldId).toBe('f1');
    });

    it('TOGGLE_REQUIRED toggles the required flag', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [{ id: 'f1', name: 'X', type: 'text', required: false }],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'TOGGLE_REQUIRED', id: 'f1' });
      expect(result.fields[0].required).toBe(true);
      const result2 = schemaEditorReducer(result, { type: 'TOGGLE_REQUIRED', id: 'f1' });
      expect(result2.fields[0].required).toBe(false);
    });

    it('EXPAND_CONFIG sets expandedFieldId', () => {
      expect(schemaEditorReducer(initial, { type: 'EXPAND_CONFIG', id: 'f1' }).expandedFieldId).toBe('f1');
    });

    it('COLLAPSE_CONFIG clears expandedFieldId', () => {
      const s = { ...initial, expandedFieldId: 'f1' };
      expect(schemaEditorReducer(s, { type: 'COLLAPSE_CONFIG' }).expandedFieldId).toBeNull();
    });

    it('MOVE_UP swaps the field with the one above', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [
          { id: 'f1', name: 'A', type: 'text', required: false },
          { id: 'f2', name: 'B', type: 'text', required: false },
        ],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'MOVE_UP', id: 'f2' });
      expect(result.fields[0].id).toBe('f2');
      expect(result.fields[1].id).toBe('f1');
    });

    it('MOVE_UP is a no-op for the first field', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [
          { id: 'f1', name: 'A', type: 'text', required: false },
          { id: 'f2', name: 'B', type: 'text', required: false },
        ],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'MOVE_UP', id: 'f1' });
      expect(result.fields[0].id).toBe('f1');
    });

    it('MOVE_DOWN swaps the field with the one below', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [
          { id: 'f1', name: 'A', type: 'text', required: false },
          { id: 'f2', name: 'B', type: 'text', required: false },
        ],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'MOVE_DOWN', id: 'f1' });
      expect(result.fields[0].id).toBe('f2');
      expect(result.fields[1].id).toBe('f1');
    });

    it('MOVE_DOWN is a no-op for the last field', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [
          { id: 'f1', name: 'A', type: 'text', required: false },
          { id: 'f2', name: 'B', type: 'text', required: false },
        ],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'MOVE_DOWN', id: 'f2' });
      expect(result.fields[1].id).toBe('f2');
    });

    it('DRAG_START sets draggingFieldId', () => {
      expect(schemaEditorReducer(initial, { type: 'DRAG_START', id: 'f1' }).draggingFieldId).toBe('f1');
    });

    it('DRAG_END clears draggingFieldId', () => {
      const s = { ...initial, draggingFieldId: 'f1' };
      expect(schemaEditorReducer(s, { type: 'DRAG_END' }).draggingFieldId).toBeNull();
    });

    it('UPDATE_CONFIG updates the config of a field', () => {
      const s: SchemaEditorState = {
        ...initial,
        fields: [{ id: 'f1', name: 'X', type: 'text', required: false, config: {} }],
        fieldCount: 'hasFields',
      };
      const result = schemaEditorReducer(s, { type: 'UPDATE_CONFIG', id: 'f1', config: { maxLength: 100 } });
      expect(result.fields[0].config).toEqual({ maxLength: 100 });
    });
  });
});

/* ===========================================================================
 * SortBuilder
 * ========================================================================= */

describe('SortBuilder', () => {
  describe('sortBuilderReducer', () => {
    beforeEach(() => {
      resetSortCounter();
    });

    const initial: SortBuilderState = {
      sortCount: 'empty',
      draggingId: null,
      sorts: [],
    };

    it('returns initial state for unknown events', () => {
      expect(sortBuilderReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('ADD_SORT adds a sort criterion', () => {
      const result = sortBuilderReducer(initial, { type: 'ADD_SORT' });
      expect(result.sortCount).toBe('hasSorts');
      expect(result.sorts).toHaveLength(1);
      expect(result.sorts[0].field).toBe('');
      expect(result.sorts[0].direction).toBe('ascending');
    });

    it('REMOVE_SORT removes the targeted sort', () => {
      const s: SortBuilderState = {
        ...initial,
        sortCount: 'hasSorts',
        sorts: [{ id: 's1', field: 'name', direction: 'ascending' }],
      };
      const result = sortBuilderReducer(s, { type: 'REMOVE_SORT', id: 's1' });
      expect(result.sorts).toHaveLength(0);
      expect(result.sortCount).toBe('empty');
    });

    it('REMOVE_SORT keeps hasSorts when other sorts remain', () => {
      const s: SortBuilderState = {
        ...initial,
        sortCount: 'hasSorts',
        sorts: [
          { id: 's1', field: 'name', direction: 'ascending' },
          { id: 's2', field: 'date', direction: 'descending' },
        ],
      };
      const result = sortBuilderReducer(s, { type: 'REMOVE_SORT', id: 's1' });
      expect(result.sorts).toHaveLength(1);
      expect(result.sortCount).toBe('hasSorts');
    });

    it('CLEAR_ALL removes all sorts', () => {
      const s: SortBuilderState = {
        ...initial,
        sortCount: 'hasSorts',
        draggingId: 's1',
        sorts: [{ id: 's1', field: 'name', direction: 'ascending' }],
      };
      const result = sortBuilderReducer(s, { type: 'CLEAR_ALL' });
      expect(result.sorts).toHaveLength(0);
      expect(result.sortCount).toBe('empty');
      expect(result.draggingId).toBeNull();
    });

    it('FIELD_CHANGE updates the field', () => {
      const s: SortBuilderState = {
        ...initial,
        sorts: [{ id: 's1', field: '', direction: 'ascending' }],
        sortCount: 'hasSorts',
      };
      const result = sortBuilderReducer(s, { type: 'FIELD_CHANGE', id: 's1', field: 'name' });
      expect(result.sorts[0].field).toBe('name');
    });

    it('TOGGLE_DIRECTION toggles between ascending and descending', () => {
      const s: SortBuilderState = {
        ...initial,
        sorts: [{ id: 's1', field: 'name', direction: 'ascending' }],
        sortCount: 'hasSorts',
      };
      const result = sortBuilderReducer(s, { type: 'TOGGLE_DIRECTION', id: 's1' });
      expect(result.sorts[0].direction).toBe('descending');
      const result2 = sortBuilderReducer(result, { type: 'TOGGLE_DIRECTION', id: 's1' });
      expect(result2.sorts[0].direction).toBe('ascending');
    });

    it('MOVE_UP swaps the sort with the one above', () => {
      const s: SortBuilderState = {
        ...initial,
        sorts: [
          { id: 's1', field: 'name', direction: 'ascending' },
          { id: 's2', field: 'date', direction: 'descending' },
        ],
        sortCount: 'hasSorts',
      };
      const result = sortBuilderReducer(s, { type: 'MOVE_UP', id: 's2' });
      expect(result.sorts[0].id).toBe('s2');
      expect(result.sorts[1].id).toBe('s1');
    });

    it('MOVE_UP is a no-op for the first sort', () => {
      const s: SortBuilderState = {
        ...initial,
        sorts: [{ id: 's1', field: 'name', direction: 'ascending' }],
        sortCount: 'hasSorts',
      };
      const result = sortBuilderReducer(s, { type: 'MOVE_UP', id: 's1' });
      expect(result).toEqual(s);
    });

    it('MOVE_DOWN swaps the sort with the one below', () => {
      const s: SortBuilderState = {
        ...initial,
        sorts: [
          { id: 's1', field: 'name', direction: 'ascending' },
          { id: 's2', field: 'date', direction: 'descending' },
        ],
        sortCount: 'hasSorts',
      };
      const result = sortBuilderReducer(s, { type: 'MOVE_DOWN', id: 's1' });
      expect(result.sorts[0].id).toBe('s2');
      expect(result.sorts[1].id).toBe('s1');
    });

    it('MOVE_DOWN is a no-op for the last sort', () => {
      const s: SortBuilderState = {
        ...initial,
        sorts: [{ id: 's1', field: 'name', direction: 'ascending' }],
        sortCount: 'hasSorts',
      };
      const result = sortBuilderReducer(s, { type: 'MOVE_DOWN', id: 's1' });
      expect(result).toEqual(s);
    });

    it('DRAG_START sets draggingId', () => {
      expect(sortBuilderReducer(initial, { type: 'DRAG_START', id: 's1' }).draggingId).toBe('s1');
    });

    it('DRAG_END clears draggingId', () => {
      const s = { ...initial, draggingId: 's1' };
      expect(sortBuilderReducer(s, { type: 'DRAG_END' }).draggingId).toBeNull();
    });
  });

  describe('ordinalSuffix', () => {
    it('returns st for 1', () => {
      expect(ordinalSuffix(1)).toBe('st');
    });

    it('returns nd for 2', () => {
      expect(ordinalSuffix(2)).toBe('nd');
    });

    it('returns rd for 3', () => {
      expect(ordinalSuffix(3)).toBe('rd');
    });

    it('returns th for 4-20', () => {
      expect(ordinalSuffix(4)).toBe('th');
      expect(ordinalSuffix(11)).toBe('th');
      expect(ordinalSuffix(12)).toBe('th');
      expect(ordinalSuffix(13)).toBe('th');
    });

    it('returns st for 21', () => {
      expect(ordinalSuffix(21)).toBe('st');
    });

    it('returns nd for 22', () => {
      expect(ordinalSuffix(22)).toBe('nd');
    });
  });
});

/* ===========================================================================
 * ViewSwitcher
 * ========================================================================= */

describe('ViewSwitcher', () => {
  describe('viewSwitcherReducer', () => {
    const initial: ViewSwitcherState = {
      menuOpen: false,
      configExpanded: false,
      renamingViewId: null,
      renameValue: '',
    };

    it('returns initial state for unknown events', () => {
      expect(viewSwitcherReducer(initial, { type: 'UNKNOWN' } as never)).toEqual(initial);
    });

    it('OPEN_MENU sets menuOpen to true', () => {
      expect(viewSwitcherReducer(initial, { type: 'OPEN_MENU' }).menuOpen).toBe(true);
    });

    it('CLOSE_MENU sets menuOpen to false', () => {
      const s = { ...initial, menuOpen: true };
      expect(viewSwitcherReducer(s, { type: 'CLOSE_MENU' }).menuOpen).toBe(false);
    });

    it('TOGGLE_CONFIG toggles configExpanded', () => {
      expect(viewSwitcherReducer(initial, { type: 'TOGGLE_CONFIG' }).configExpanded).toBe(true);
      const expanded = { ...initial, configExpanded: true };
      expect(viewSwitcherReducer(expanded, { type: 'TOGGLE_CONFIG' }).configExpanded).toBe(false);
    });

    it('START_RENAME sets renamingViewId and renameValue', () => {
      const result = viewSwitcherReducer(initial, { type: 'START_RENAME', viewId: 'v1', name: 'Table' });
      expect(result.renamingViewId).toBe('v1');
      expect(result.renameValue).toBe('Table');
    });

    it('COMMIT_RENAME clears rename state', () => {
      const s: ViewSwitcherState = { ...initial, renamingViewId: 'v1', renameValue: 'Board' };
      const result = viewSwitcherReducer(s, { type: 'COMMIT_RENAME' });
      expect(result.renamingViewId).toBeNull();
      expect(result.renameValue).toBe('');
    });

    it('CANCEL_RENAME clears rename state', () => {
      const s: ViewSwitcherState = { ...initial, renamingViewId: 'v1', renameValue: 'Board' };
      const result = viewSwitcherReducer(s, { type: 'CANCEL_RENAME' });
      expect(result.renamingViewId).toBeNull();
      expect(result.renameValue).toBe('');
    });

    it('UPDATE_RENAME_VALUE updates renameValue', () => {
      const s: ViewSwitcherState = { ...initial, renamingViewId: 'v1', renameValue: 'T' };
      expect(viewSwitcherReducer(s, { type: 'UPDATE_RENAME_VALUE', value: 'Tab' }).renameValue).toBe('Tab');
    });

    it('SWITCH_VIEW collapses config', () => {
      const s = { ...initial, configExpanded: true };
      expect(viewSwitcherReducer(s, { type: 'SWITCH_VIEW' }).configExpanded).toBe(false);
    });

    it('SWITCH_VIEW does not affect menu or rename state', () => {
      const s: ViewSwitcherState = { menuOpen: true, configExpanded: true, renamingViewId: 'v1', renameValue: 'Test' };
      const result = viewSwitcherReducer(s, { type: 'SWITCH_VIEW' });
      expect(result.menuOpen).toBe(true);
      expect(result.renamingViewId).toBe('v1');
      expect(result.renameValue).toBe('Test');
    });
  });
});
