// ============================================================
// Clef Surface Ink Widgets — Composites Barrel Export
//
// Re-exports all composite Ink widget components and their
// Props interfaces from the composites directory.
// See Architecture doc Section 16.
// ============================================================

export { BacklinkPanel } from './BacklinkPanel';
export type { BacklinkPanelProps, Backlink } from './BacklinkPanel';

export { CacheDashboard } from './CacheDashboard';
export type { CacheDashboardProps, CacheEntry } from './CacheDashboard';

export { DiffViewer } from './DiffViewer';
export type { DiffViewerProps } from './DiffViewer';

export { FacetedSearch } from './FacetedSearch';
export type { FacetedSearchProps, Facet, FacetOption, SearchResult } from './FacetedSearch';

export { FileBrowser } from './FileBrowser';
export type { FileBrowserProps, FileEntry } from './FileBrowser';

export { FilterBuilder } from './FilterBuilder';
export type { FilterBuilderProps, FilterRow, FieldDef, OperatorDef } from './FilterBuilder';

export { MasterDetail } from './MasterDetail';
export type { MasterDetailProps, MasterItem } from './MasterDetail';

export { NotificationCenter } from './NotificationCenter';
export type { NotificationCenterProps, Notification } from './NotificationCenter';

export { PermissionMatrix } from './PermissionMatrix';
export type { PermissionMatrixProps } from './PermissionMatrix';

export { PluginCard } from './PluginCard';
export type { PluginCardProps } from './PluginCard';

export { PreferenceMatrix } from './PreferenceMatrix';
export type { PreferenceMatrixProps, PreferenceCategory, Preference } from './PreferenceMatrix';

export { PropertyPanel } from './PropertyPanel';
export type { PropertyPanelProps, Property } from './PropertyPanel';

export { QueueDashboard } from './QueueDashboard';
export type { QueueDashboardProps, Queue } from './QueueDashboard';

export { SchemaEditor } from './SchemaEditor';
export type { SchemaEditorProps, SchemaField } from './SchemaEditor';

export { SortBuilder } from './SortBuilder';
export type { SortBuilderProps, SortRule, SortFieldDef } from './SortBuilder';

export { ViewSwitcher } from './ViewSwitcher';
export type { ViewSwitcherProps, ViewDef } from './ViewSwitcher';
