'use client';

/**
 * DetailDisplay — property-grid display type for single entities.
 *
 * Renders a single record's fields as a vertical key-value grid.
 * Used in entity detail pages (structured zone) where one entity's
 * schema fields are shown as labeled properties.
 *
 * Supports InlineEdit on editable fields when onFieldSave is provided.
 */

import React from 'react';
import type { FieldConfig } from './TableDisplay';
import { InlineEdit } from './InlineEdit';
import { Badge } from './Badge';

interface DetailDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  onFieldSave?: (field: string, value: unknown) => Promise<void>;
}

function formatValue(value: unknown, formatter?: string): React.ReactNode {
  if (value === null || value === undefined) return <span style={{ color: 'var(--palette-on-surface-variant)', opacity: 0.5 }}>—</span>;

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  switch (formatter) {
    case 'badge':
      return <Badge variant="secondary">{str}</Badge>;
    case 'boolean-badge':
      return <Badge variant={str === 'true' ? 'success' : 'secondary'}>{str === 'true' ? 'Yes' : 'No'}</Badge>;
    case 'json-count': {
      try {
        const parsed = JSON.parse(str);
        const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        return <Badge variant="info">{count}</Badge>;
      } catch {
        return str;
      }
    }
    case 'code':
      return <code style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: 'var(--typography-code-sm-size)' }}>{str}</code>;
    case 'json':
      try {
        return (
          <pre style={{
            fontFamily: 'var(--typography-font-family-mono)',
            fontSize: 'var(--typography-code-sm-size)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            maxHeight: 200,
            overflow: 'auto',
          }}>
            {JSON.stringify(JSON.parse(str), null, 2)}
          </pre>
        );
      } catch {
        return str;
      }
    default:
      // Truncate long values
      if (str.length > 200) return str.slice(0, 200) + '…';
      return str;
  }
}

export const DetailDisplay: React.FC<DetailDisplayProps> = ({ data, fields, onFieldSave }) => {
  const entity = data[0];
  if (!entity) return null;

  // If no fields configured, derive from entity keys
  const displayFields = fields.length > 0
    ? fields
    : Object.keys(entity).map((key) => ({ key, label: key }));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: '1px 0',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      border: '1px solid var(--palette-outline-variant)',
    }}>
      {displayFields.map((field) => {
        const value = entity[field.key];
        const isSystem = field.formatter === 'system';
        const isEditable = !isSystem && onFieldSave && field.key !== 'node';

        return (
          <React.Fragment key={field.key}>
            {/* Label cell */}
            <div style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--palette-surface-variant)',
              fontWeight: 'var(--typography-label-md-weight)',
              fontSize: 'var(--typography-label-sm-size)',
              color: 'var(--palette-on-surface-variant)',
              borderBottom: '1px solid var(--palette-outline-variant)',
              display: 'flex',
              alignItems: 'center',
            }}>
              {field.label ?? field.key}
            </div>
            {/* Value cell */}
            <div style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--palette-surface)',
              borderBottom: '1px solid var(--palette-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              minHeight: 36,
            }}>
              {isEditable ? (
                <InlineEdit
                  value={value}
                  onSave={(v) => onFieldSave(field.key, v)}
                />
              ) : (
                formatValue(value, field.formatter)
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default DetailDisplay;
