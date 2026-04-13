'use client';

/**
 * MediaLibraryView — thin wrapper that mounts the media-library-view ViewShell.
 *
 * Resolves the ViewShell config via ViewShell/resolveHydrated and delegates all
 * rendering to ViewRenderer. The active shell ID can be swapped at runtime by
 * the view-editor toolbar to one of the named presentation variants:
 *   media-library-view        — blocks (default)
 *   media-library-card-grid   — gallery (card-grid)
 *   media-library-table       — structured table
 *   media-library-timeline    — chronological timeline
 *
 * Seeds: clef-base/seeds/ViewShell.media-library.seeds.yaml (MAG-754)
 * Presentation specs: clef-base/seeds/PresentationSpec.multimedia.seeds.yaml
 * Route: /media → /admin/media (via DestinationCatalog destination "media")
 *
 * Card: MAG-754
 */

import React, { useState } from 'react';
import { ViewRenderer } from '../components/ViewRenderer';

const PRESENTATION_VARIANTS = [
  { id: 'media-library-view',       label: 'Blocks',   icon: '▤' },
  { id: 'media-library-card-grid',  label: 'Gallery',  icon: '▦' },
  { id: 'media-library-table',      label: 'Table',    icon: '≡'  },
  { id: 'media-library-timeline',   label: 'Timeline', icon: '▷' },
] as const;

type ShellId = typeof PRESENTATION_VARIANTS[number]['id'];

export const MediaLibraryView: React.FC = () => {
  const [activeShell, setActiveShell] = useState<ShellId>('media-library-view');

  return (
    <div className="view-shell" data-view="media-library">
      {/* Presentation-mode switcher */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '12px',
          padding: '4px',
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-md)',
          width: 'fit-content',
        }}
      >
        {PRESENTATION_VARIANTS.map((v) => (
          <button
            key={v.id}
            data-part="presentation-mode-button"
            data-active={activeShell === v.id ? 'true' : 'false'}
            onClick={() => setActiveShell(v.id)}
            title={v.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              fontSize: '13px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeShell === v.id
                ? 'var(--palette-surface)'
                : 'transparent',
              color: activeShell === v.id
                ? 'var(--palette-on-surface)'
                : 'var(--palette-on-surface-variant)',
              fontWeight: activeShell === v.id ? 600 : 400,
              boxShadow: activeShell === v.id
                ? 'var(--elevation-1)'
                : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span aria-hidden="true">{v.icon}</span>
            {v.label}
          </button>
        ))}
      </div>

      {/* ViewShell-backed renderer — swaps shell ID on presentation change */}
      <ViewRenderer viewId={activeShell} />
    </div>
  );
};

export default MediaLibraryView;
