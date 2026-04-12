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
  if (value === null || value === undefined) return <span data-part="detail-empty-value">—</span>;

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
    case 'schema-badges': {
      const schemas = Array.isArray(value) ? value : [];
      if (schemas.length === 0) return <Badge variant="secondary">none</Badge>;
      return (
        <span data-part="detail-schema-list">
          {schemas.map((s: unknown) => (
            <Badge key={String(s)} variant="info">{String(s)}</Badge>
          ))}
        </span>
      );
    }
    case 'code':
      return <code data-part="detail-code">{str}</code>;
    case 'json':
      try {
        return (
          <pre data-part="detail-json">
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
  const displayFields: FieldConfig[] = fields.length > 0
    ? fields
    : Object.keys(entity).map((key) => ({ key, label: key }));

  return (
    <div data-surface="display-detail">
      {displayFields.map((field) => {
        const value = entity[field.key];
        const isSystem = field.formatter === 'system';
        const isEditable = !isSystem && onFieldSave && field.key !== 'node';

        return (
          <React.Fragment key={field.key}>
            {/* Label cell */}
            <div data-part="detail-label">
              {field.label ?? field.key}
            </div>
            {/* Value cell */}
            <div data-part="detail-value">
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
