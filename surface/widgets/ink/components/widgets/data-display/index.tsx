// ============================================================
// Clef Surface Ink Widgets — Data Display (barrel export)
//
// Re-exports all data-display widget components and their
// associated Props interfaces for convenient single-path imports.
// See widget specs: repertoire/widgets/data-display/*.widget
// ============================================================

export { CalendarView } from './CalendarView';
export type { CalendarViewProps, CalendarEvent } from './CalendarView';

export { Card } from './Card';
export type { CardProps } from './Card';

export { CardGrid } from './CardGrid';
export type { CardGridProps } from './CardGrid';

export { Chart } from './Chart';
export type { ChartProps, ChartDataPoint } from './Chart';

export { DataList } from './DataList';
export type { DataListProps, DataListItem } from './DataList';

export { DataTable } from './DataTable';
export type { DataTableProps, DataTableColumn } from './DataTable';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateAction } from './EmptyState';

export { Gauge } from './Gauge';
export type { GaugeProps } from './Gauge';

export { KanbanBoard } from './KanbanBoard';
export type { KanbanBoardProps, KanbanColumn, KanbanItem } from './KanbanBoard';

export { List } from './List';
export type { ListProps, ListItem } from './List';

export { NotificationItem } from './NotificationItem';
export type { NotificationItemProps } from './NotificationItem';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';

export { Timeline } from './Timeline';
export type { TimelineProps, TimelineItem } from './Timeline';

export { ViewToggle } from './ViewToggle';
export type { ViewToggleProps, ViewOption } from './ViewToggle';
