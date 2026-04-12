'use client';

/**
 * RecursiveEditorView — route wrapper that reads a ContentNode's primary schema
 * and mounts <RecursiveBlockEditor> with the appropriate editorFlavor.
 *
 * Route param: rootNodeId (the ContentNode's ID)
 *
 * Schema → editorFlavor mapping:
 *   agent-persona  → "persona"
 *   workflow       → "workflow"
 *   notebook       → "notebook"
 *   wiki / Page    → "wiki"
 *   (default)      → "markdown"
 *
 * The view reads the node's primary schema via ContentNode/get + Schema/getSchemasFor,
 * then delegates entirely to RecursiveBlockEditor. All mutations route through
 * ActionBinding/invoke — no direct state mutations beyond React-local FSM mirroring.
 *
 * PRD: docs/plans/block-editor-recursive-views-prd.md §5.7
 * Card: MAG-724
 */

import React, { useEffect, useState } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { RecursiveBlockEditor, type EditorFlavor } from '../components/widgets/RecursiveBlockEditor';

// ---------------------------------------------------------------------------
// Schema → flavor lookup
// ---------------------------------------------------------------------------

const SCHEMA_TO_FLAVOR: Record<string, EditorFlavor> = {
  'agent-persona': 'persona',
  'workflow':      'workflow',
  'notebook':      'notebook',
  'wiki':          'wiki',
  'Page':          'wiki',
};

function pickFlavor(schemas: string[]): EditorFlavor {
  for (const s of schemas) {
    const f = SCHEMA_TO_FLAVOR[s];
    if (f) return f;
  }
  return 'markdown';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecursiveEditorViewProps {
  rootNodeId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RecursiveEditorView: React.FC<RecursiveEditorViewProps> = ({ rootNodeId }) => {
  const invoke = useKernelInvoke();

  const [flavor, setFlavor] = useState<EditorFlavor>('markdown');
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNode() {
      setLoading(true);
      setErrorText(null);
      try {
        // Read ContentNode to verify existence + obtain kind
        const nodeResult = await invoke('ContentNode', 'get', { node: rootNodeId });
        if (cancelled) return;

        if (nodeResult.variant !== 'ok') {
          setErrorText(`Content node "${rootNodeId}" not found.`);
          setLoading(false);
          return;
        }

        // Determine editability from kernel access (non-fatal if unavailable)
        try {
          const accessResult = await invoke('Authorization', 'check', {
            entity: rootNodeId,
            action: 'edit',
          });
          if (!cancelled && accessResult.variant === 'ok') {
            setCanEdit(accessResult.permitted === true);
          } else if (!cancelled) {
            // Default to editable if Authorization concept is not yet wired
            setCanEdit(true);
          }
        } catch {
          if (!cancelled) setCanEdit(true);
        }

        // Resolve primary schema to derive flavor
        try {
          const schemaResult = await invoke('Schema', 'getSchemasFor', { entity_id: rootNodeId });
          if (!cancelled && schemaResult.variant === 'ok') {
            const schemas: string[] = typeof schemaResult.schemas === 'string'
              ? JSON.parse(schemaResult.schemas as string)
              : (schemaResult.schemas as string[] ?? []);
            if (!cancelled) {
              setFlavor(pickFlavor(schemas));
            }
          }
        } catch {
          // Non-fatal: fall back to "markdown"
        }
      } catch (err) {
        if (!cancelled) {
          setErrorText(err instanceof Error ? err.message : 'Failed to load content node.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNode();
    return () => { cancelled = true; };
  }, [rootNodeId, invoke]);

  // Loading state
  if (loading) {
    return (
      <div
        data-part="root"
        data-state="loading"
        role="region"
        aria-label="Recursive editor — loading"
        style={{ padding: 'var(--spacing-xl)', color: 'var(--palette-on-surface-variant)' }}
      >
        Loading editor...
      </div>
    );
  }

  // Error state
  if (errorText) {
    return (
      <div
        data-part="root"
        data-state="error"
        role="region"
        aria-label="Recursive editor — error"
        style={{ padding: 'var(--spacing-xl)', color: 'var(--palette-error)' }}
      >
        <p data-part="error-message">{errorText}</p>
      </div>
    );
  }

  return (
    <div
      data-part="recursive-editor-view"
      data-node-id={rootNodeId}
      data-flavor={flavor}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <RecursiveBlockEditor
        rootNodeId={rootNodeId}
        editorFlavor={flavor}
        canEdit={canEdit}
      />
    </div>
  );
};

export default RecursiveEditorView;
