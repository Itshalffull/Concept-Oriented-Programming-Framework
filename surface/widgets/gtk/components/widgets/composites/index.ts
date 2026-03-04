// ============================================================
// Clef Surface GTK Widgets — Composites Barrel Export
//
// Re-exports all 16 composite GTK4 widget factory functions
// and their prop/data types from the composites module.
// ============================================================

export { createBacklinkPanel, type BacklinkPanelProps, type Backlink } from './BacklinkPanel';
export { createCacheDashboard, type CacheDashboardProps, type CacheEntry } from './CacheDashboard';
export { createDiffViewer, type DiffViewerProps, type DiffMode } from './DiffViewer';
export { createFacetedSearch, type FacetedSearchProps, type Facet, type FacetOption, type SearchResult } from './FacetedSearch';
export { createFileBrowser, type FileBrowserProps, type FileEntry, type FileEntryType } from './FileBrowser';
export { createFilterBuilder, type FilterBuilderProps, type FilterRow, type FieldDef, type OperatorDef } from './FilterBuilder';
export { createMasterDetail, type MasterDetailProps, type MasterItem } from './MasterDetail';
export { createNotificationCenter, type NotificationCenterProps, type Notification, type NotificationType } from './NotificationCenter';
export { createPermissionMatrix, type PermissionMatrixProps } from './PermissionMatrix';
export { createPluginCard, type PluginCardProps } from './PluginCard';
export { createPreferenceMatrix, type PreferenceMatrixProps, type Preference, type PreferenceType, type PreferenceCategory } from './PreferenceMatrix';
export { createPropertyPanel, type PropertyPanelProps, type Property, type PropertyType } from './PropertyPanel';
export { createQueueDashboard, type QueueDashboardProps, type Queue } from './QueueDashboard';
export { createSchemaEditor, type SchemaEditorProps, type SchemaField } from './SchemaEditor';
export { createSortBuilder, type SortBuilderProps, type SortRule, type SortDirection, type SortFieldDef } from './SortBuilder';
export { createViewSwitcher, type ViewSwitcherProps, type ViewDef } from './ViewSwitcher';
