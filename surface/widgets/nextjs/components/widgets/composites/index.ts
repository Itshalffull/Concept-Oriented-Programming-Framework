// Composite widget components barrel export

export { FilterBuilder, default as FilterBuilderDefault } from './FilterBuilder';
export type { FilterBuilderProps, FilterRow, FieldDef, OperatorDef, FilterGroup } from './FilterBuilder';

export { SortBuilder, default as SortBuilderDefault } from './SortBuilder';
export type { SortBuilderProps, SortCriterion, SortFieldDef } from './SortBuilder';

export { ViewSwitcher, default as ViewSwitcherDefault } from './ViewSwitcher';
export type { ViewSwitcherProps, ViewDef, ViewType } from './ViewSwitcher';

export { PropertyPanel, default as PropertyPanelDefault } from './PropertyPanel';
export type { PropertyPanelProps, PropertyDef, PropertyType } from './PropertyPanel';

export { NotificationCenter, default as NotificationCenterDefault } from './NotificationCenter';
export type { NotificationCenterProps, NotificationDef } from './NotificationCenter';

export { CacheDashboard, default as CacheDashboardDefault } from './CacheDashboard';
export type { CacheDashboardProps, CacheMetrics, CacheKey, DataPoint } from './CacheDashboard';

export { QueueDashboard, default as QueueDashboardDefault } from './QueueDashboard';
export type { QueueDashboardProps, QueueStats, JobDef, QueueDataPoint } from './QueueDashboard';

export { SchemaEditor, default as SchemaEditorDefault } from './SchemaEditor';
export type { SchemaEditorProps, FieldDefinition, FieldType, TypeDef } from './SchemaEditor';

export { DiffViewer, default as DiffViewerDefault } from './DiffViewer';
export type { DiffViewerProps, FileDiff, DiffHunk, DiffLine } from './DiffViewer';

export { FileBrowser, default as FileBrowserDefault } from './FileBrowser';
export type { FileBrowserProps, FileDef } from './FileBrowser';

export { PreferenceMatrix, default as PreferenceMatrixDefault } from './PreferenceMatrix';
export type { PreferenceMatrixProps, PreferenceDef, ChannelDef, PreferenceGroupDef } from './PreferenceMatrix';

export { PermissionMatrix, default as PermissionMatrixDefault } from './PermissionMatrix';
export type { PermissionMatrixProps, RoleDef, ResourceDef, ActionDef, PermissionMap } from './PermissionMatrix';

export { FacetedSearch, default as FacetedSearchDefault } from './FacetedSearch';
export type { FacetedSearchProps, FacetDef, FacetItemDef, ActiveFilter } from './FacetedSearch';

export { MasterDetail, default as MasterDetailDefault } from './MasterDetail';
export type { MasterDetailProps, MasterDetailItem } from './MasterDetail';

export { PluginCard, default as PluginCardDefault } from './PluginCard';
export type { PluginCardProps, PluginLifecycleState } from './PluginCard';

export { BacklinkPanel, default as BacklinkPanelDefault } from './BacklinkPanel';
export type { BacklinkPanelProps, LinkedRef, UnlinkedRef } from './BacklinkPanel';
