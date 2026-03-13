/**
 * Shared types for the View rendering system.
 * Extracted to avoid circular imports between ViewRenderer and display components.
 */

// ─── Grouping ─────────────────────────────────────────────────────────────

export interface GroupFieldConfig {
  field: string;
  sort?: 'asc' | 'desc';
  hideEmpty?: boolean;
  defaultCollapsed?: boolean;
}

export interface GroupConfig {
  fields: GroupFieldConfig[];
  hideEmpty?: boolean;
}
