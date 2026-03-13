'use client';

/**
 * ContentBodyDisplay — block editor display type for the unstructured zone.
 *
 * Wraps the BlockEditor component, handling content parsing (legacy JSON/text
 * → blocks) and save-back (blocks → content string for ContentNode/update).
 */

import React, { useCallback, useMemo } from 'react';
import type { FieldConfig } from './TableDisplay';
import { BlockEditor, contentToBlocks, blocksToContent, type Block } from './BlockEditor';

interface ContentBodyDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  onFieldSave?: (field: string, value: unknown) => Promise<void>;
  /** Context for embedded views and entity references */
  context?: Record<string, string>;
}

export const ContentBodyDisplay: React.FC<ContentBodyDisplayProps> = ({ data, onFieldSave, context }) => {
  const entity = data[0];
  if (!entity) return null;

  const content = entity.content;

  const blocks = useMemo(() => contentToBlocks(content), [content]);

  const handleChange = useCallback((newBlocks: Block[]) => {
    if (!onFieldSave) return;
    onFieldSave('content', blocksToContent(newBlocks));
  }, [onFieldSave]);

  // Build context from entity data if not provided
  const editorContext = useMemo(() => {
    if (context) return context;
    const entityId = entity.node as string | undefined;
    if (entityId) return { entityId };
    return undefined;
  }, [context, entity.node]);

  return (
    <BlockEditor
      blocks={blocks}
      onChange={handleChange}
      readOnly={!onFieldSave}
      context={editorContext}
    />
  );
};

export default ContentBodyDisplay;
