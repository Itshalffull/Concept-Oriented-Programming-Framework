'use client';

/**
 * MappingsView — Component mapping detail/edit view.
 * When given a mappingId, shows the SlotSourceEditor for that mapping.
 * The list view is handled by ViewRenderer with the mappings-list View seed.
 */

import React, { useState } from 'react';
import { useNavigator, useKernelInvoke } from '../../lib/clef-provider';
import { SlotSourceEditor } from '../components/widgets/SlotSourceEditor';

interface MappingsViewProps {
  mappingId: string;
}

export const MappingsView: React.FC<MappingsViewProps> = ({ mappingId }) => {
  const { navigateToHref } = useNavigator();
  const invoke = useKernelInvoke();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--spacing-md)',
        fontSize: '12px', color: 'var(--palette-on-surface-variant)',
      }}>
        <span
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigateToHref('/view-builder')}
        >
          Views
        </span>
        <span>&rarr;</span>
        <span
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigateToHref('/display-modes')}
        >
          Display Modes
        </span>
        <span>&rarr;</span>
        <span
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigateToHref('/mappings')}
        >
          Mappings
        </span>
        <span>&rarr;</span>
        <strong>{mappingId}</strong>
      </div>

      <SlotSourceEditor
        mappingId={mappingId}
        onClose={() => navigateToHref('/mappings')}
        onSaved={() => {/* stay on page */}}
      />

      {deleteError && (
        <div style={{
          marginTop: 'var(--spacing-sm)',
          padding: '6px 12px',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>{deleteError}</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1 }} onClick={() => setDeleteError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
        <button
          data-part="button"
          data-variant="ghost"
          style={{ color: 'var(--palette-error)' }}
          disabled={deleting}
          onClick={async () => {
            setDeleteError(null);
            setDeleting(true);
            try {
              const result = await invoke('ComponentMapping', 'delete', { mapping: mappingId });
              if (result.variant === 'ok') {
                navigateToHref('/mappings');
              } else {
                setDeleteError((result.message as string | undefined) ?? 'Failed to delete mapping.');
              }
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : 'Failed to delete mapping.');
            } finally {
              setDeleting(false);
            }
          }}
        >
          {deleting ? 'Deleting...' : 'Delete Mapping'}
        </button>
      </div>
    </div>
  );
};

export default MappingsView;
