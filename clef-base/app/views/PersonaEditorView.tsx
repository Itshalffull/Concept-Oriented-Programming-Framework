'use client';

/**
 * PersonaEditorView — thin wrapper mounting RecursiveBlockEditor with
 * editorFlavor="persona" for ContentNodes carrying the "agent-persona" schema.
 *
 * Route: /editors/persona/:nodeId
 *
 * Responsibility boundary:
 *   - Reads Authorization/check to determine canEdit (defaults to true if absent)
 *   - Mounts RecursiveBlockEditor with flavor locked to "persona"
 *   - Does NOT perform schema resolution — flavor is fixed
 *
 * All mutations route through ActionBinding/invoke — no direct state mutations
 * beyond React-local FSM mirroring. Pattern mirrors ActionButton.tsx.
 *
 * Compile surface (agent-persona → ContentCompiler → PromptAssembly):
 *   The compile status badge, Recompile button, preview pane, and AgentSession
 *   consumers panel are all rendered inside RecursiveBlockEditor when the
 *   page-level EditSurface for "agent-persona" declares a compile_bundle_ref.
 *
 * PRD: docs/plans/block-editor-recursive-views-prd.md §5.7
 * Card: MAG-724
 */

import React, { useEffect, useState } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { RecursiveBlockEditor } from '../components/widgets/RecursiveBlockEditor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PersonaEditorViewProps {
  /** ContentNode ID for the agent-persona page */
  nodeId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PersonaEditorView: React.FC<PersonaEditorViewProps> = ({ nodeId }) => {
  const invoke = useKernelInvoke();

  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      setLoading(true);
      setErrorText(null);
      try {
        // Verify node exists
        const nodeResult = await invoke('ContentNode', 'get', { node: nodeId });
        if (cancelled) return;

        if (nodeResult.variant !== 'ok') {
          setErrorText(`Persona page "${nodeId}" not found.`);
          setLoading(false);
          return;
        }

        // Determine editability from Authorization concept (non-fatal if absent)
        try {
          const accessResult = await invoke('Authorization', 'check', {
            entity: nodeId,
            action: 'edit',
          });
          if (!cancelled) {
            setCanEdit(
              accessResult.variant === 'ok'
                ? accessResult.permitted === true
                : true, // default to editable if Authorization is not yet wired
            );
          }
        } catch {
          if (!cancelled) setCanEdit(true);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorText(err instanceof Error ? err.message : 'Failed to load persona page.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAccess();
    return () => { cancelled = true; };
  }, [nodeId, invoke]);

  if (loading) {
    return (
      <div
        data-part="root"
        data-state="loading"
        role="region"
        aria-label="Persona editor — loading"
        style={{ padding: 'var(--spacing-xl)', color: 'var(--palette-on-surface-variant)' }}
      >
        Loading persona editor...
      </div>
    );
  }

  if (errorText) {
    return (
      <div
        data-part="root"
        data-state="error"
        role="region"
        aria-label="Persona editor — error"
        style={{ padding: 'var(--spacing-xl)', color: 'var(--palette-error)' }}
      >
        <p data-part="error-message">{errorText}</p>
      </div>
    );
  }

  return (
    <div
      data-part="persona-editor-view"
      data-node-id={nodeId}
      data-flavor="persona"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <RecursiveBlockEditor
        rootNodeId={nodeId}
        editorFlavor="persona"
        canEdit={canEdit}
      />
    </div>
  );
};

export default PersonaEditorView;
