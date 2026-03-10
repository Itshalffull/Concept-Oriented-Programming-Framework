'use client';

/**
 * MultiverseView — Version space management
 * VersionSpace handler not yet available; placeholder with styled layout
 */

import React, { useState } from 'react';
import { Card } from '../components/widgets/Card';
import { EmptyState } from '../components/widgets/EmptyState';
import { Badge } from '../components/widgets/Badge';

export const MultiverseView: React.FC = () => {
  const [infoVisible, setInfoVisible] = useState(false);

  return (
    <div>
      <div className="page-header">
        <h1>Version Spaces</h1>
        <button
          data-part="button"
          data-variant="filled"
          onClick={() => setInfoVisible(true)}
        >
          Create Space
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Version spaces are named content variations — like git branches for content.
        Each space can override any ContentNode with a modified version. Spaces support
        merge, rebase, promote, and archive operations.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
        <Badge variant="info">Widgets available</Badge>
        <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>
          context-badge, context-bar, context-breadcrumb, diff-inline, diff-side-by-side, diff-unified, override-dot
        </code>
      </div>

      {infoVisible && (
        <Card variant="filled" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ color: 'var(--palette-on-surface)', fontSize: 'var(--typography-body-sm-size)', margin: 0 }}>
              VersionSpace handler is not yet registered. Version space creation will be available
              once the handler is implemented and registered with the kernel.
            </p>
            <button
              data-part="button"
              data-variant="outlined"
              onClick={() => setInfoVisible(false)}
              style={{ marginLeft: 'var(--spacing-md)', flexShrink: 0 }}
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      <Card variant="outlined">
        <EmptyState
          title="No version spaces"
          description="Create a version space to work on content changes in isolation. Changes can be reviewed, compared, and merged back to the base layer."
          action={
            <button
              data-part="button"
              data-variant="filled"
              onClick={() => setInfoVisible(true)}
            >
              Create Version Space
            </button>
          }
        />
      </Card>
    </div>
  );
};

export default MultiverseView;
