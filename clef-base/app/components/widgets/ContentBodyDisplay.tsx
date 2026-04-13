'use client';

/**
 * ContentBodyDisplay — block editor display type for the unstructured zone.
 *
 * Mounts RecursiveBlockEditor for the entity identified by data[0].node.
 * Replaces the legacy BlockEditor wrapper that was removed when the
 * BlockEditor monolith was deleted (PP-delete-legacy).
 */

import React from 'react';
import type { FieldConfig } from './TableDisplay';
import { RecursiveBlockEditor } from './RecursiveBlockEditor';

interface ContentBodyDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  onFieldSave?: (field: string, value: unknown) => Promise<void>;
  /** Context for embedded views and entity references */
  context?: Record<string, string>;
}

export const ContentBodyDisplay: React.FC<ContentBodyDisplayProps> = ({ data, onFieldSave }) => {
  const entity = data[0];
  if (!entity) return null;

  const rootNodeId = entity.node as string | undefined;
  if (!rootNodeId) return null;

  return (
    <RecursiveBlockEditor
      rootNodeId={rootNodeId}
      editorFlavor="markdown"
      canEdit={!!onFieldSave}
    />
  );
};

export default ContentBodyDisplay;
