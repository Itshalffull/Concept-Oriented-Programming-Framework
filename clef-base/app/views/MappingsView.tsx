'use client';

/**
 * MappingsView — Component mapping detail/edit view.
 * When given a mappingId, shows the SlotSourceEditor for that mapping.
 * The list view is handled by ViewRenderer with the mappings-list View seed.
 */

import React from 'react';
import { useNavigator, useKernelInvoke } from '../../lib/clef-provider';
import { SlotSourceEditor } from '../components/widgets/SlotSourceEditor';

interface MappingsViewProps {
  mappingId: string;
}

export const MappingsView: React.FC<MappingsViewProps> = ({ mappingId }) => {
  const { navigateToHref } = useNavigator();
  const invoke = useKernelInvoke();

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

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
        <button
          data-part="button"
          data-variant="ghost"
          style={{ color: 'var(--palette-error)' }}
          onClick={async () => {
            await invoke('ComponentMapping', 'delete', { mapping: mappingId });
            navigateToHref('/mappings');
          }}
        >
          Delete Mapping
        </button>
      </div>
    </div>
  );
};

export default MappingsView;
