'use client';

/**
 * create-surfaces — widget-id to React component map for Tier 1a create routing.
 *
 * PRD:  docs/plans/creation-ux-prd.md §2.1 (Tier 1a)
 * Card: CUX-03
 *
 * ## Usage
 *
 * Import CREATE_SURFACES in the CreateForm dispatcher to resolve a
 * `create_surface` widget id (from InteractionSpec.create_surface) to the
 * corresponding React component.
 *
 * ```tsx
 * import { CREATE_SURFACES } from '../../../lib/create-surfaces';
 *
 * const SurfaceComp = CREATE_SURFACES[create_surface];
 * if (SurfaceComp) {
 *   return <SurfaceComp mode="create" context={null} />;
 * }
 * ```
 *
 * ## Known widget ids (from CUX-06 InteractionSpec seeds)
 *
 * | widget id         | component           | destination           |
 * |-------------------|---------------------|-----------------------|
 * | view-editor       | ViewEditor          | views-list            |
 * | schema-editor     | SchemaFieldsEditor  | schemas-list          |
 * | flow-builder      | FlowBuilder         | workflows-list        |
 * | user-sync-editor  | UserSyncEditor      | automations-rules-list|
 * | form-builder      | FormBuilder         | forms-list            |
 *
 * ## Adding new entries
 *
 * 1. Export the component from its module.
 * 2. Add an import here.
 * 3. Add the widget-id → component entry below.
 * 4. Add a corresponding InteractionSpec seed with create_surface set to the
 *    same widget id.
 */

import React from 'react';

// Lazy imports via dynamic require-style re-exports to avoid SSR issues.
// Components are loaded at module evaluation time (all are 'use client').
// We type the map as Record<string, React.ComponentType<any>> to allow each
// component to carry its own full prop interface internally.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreateSurfaceComponent = React.ComponentType<any>;

/**
 * Map from InteractionSpec.create_surface widget id to the React component
 * that implements that surface.
 *
 * Each component in this map MUST accept at minimum:
 *   mode?: 'create' | 'edit'   (default 'edit' for back-compat)
 *   context?: <entity> | null   (null when creating new)
 *
 * These are the props that CreateForm passes when mounting Tier 1a surfaces.
 */
export const CREATE_SURFACES: Record<string, CreateSurfaceComponent> = {};

/**
 * Register a create surface component for a widget id.
 *
 * Called by each component module to avoid a circular import between
 * create-surfaces.ts and the component files (which live in app/).
 * CreateForm calls registerCreateSurface from a useEffect on first mount,
 * or alternatively the app bootstrap registers all surfaces once.
 *
 * For the CUX-03 implementation we use static imports declared in
 * CreateForm.tsx itself, which calls this function after importing.
 * This keeps create-surfaces.ts free of direct app-layer imports so it
 * can be imported by both app components and test files without pulling
 * in the full React component trees.
 */
export function registerCreateSurface(
  widgetId: string,
  component: CreateSurfaceComponent,
): void {
  CREATE_SURFACES[widgetId] = component;
}

/**
 * Resolve a widget id to its create surface component, if registered.
 * Returns undefined when the id is not in the registry.
 */
export function resolveCreateSurface(
  widgetId: string,
): CreateSurfaceComponent | undefined {
  return CREATE_SURFACES[widgetId];
}
