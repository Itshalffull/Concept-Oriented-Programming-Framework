'use client';

/**
 * TimelineDisplay — Vertical chronological timeline display type for ViewRenderer.
 *
 * Renders data rows as timeline events sorted by a date field. Expects a date
 * field (formatter "date" or key containing date/time/at/on). A secondary
 * label field provides the event title. Clicking an event triggers onRowClick.
 */

import React, { useMemo } from 'react';
import type { FieldConfig } from './TableDisplay';

interface TimelineDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatTime(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// A pastel palette for event dots — rotated by index
const EVENT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
];

export const TimelineDisplay: React.FC<TimelineDisplayProps> = ({ data, fields, onRowClick }) => {
  // Pick date field
  const dateField = useMemo(() => {
    const f = fields.find(f => f.formatter === 'date');
    if (f) return f.key;
    const guessed = fields.find(f =>
      /date|at|on|time|created|updated|due|start|end/i.test(f.key),
    );
    return guessed?.key ?? fields[0]?.key ?? 'date';
  }, [fields]);

  // Pick title field (first non-date field)
  const titleField = useMemo(() => {
    const f = fields.find(f => f.key !== dateField);
    return f?.key ?? fields[0]?.key ?? 'name';
  }, [fields, dateField]);

  // Other fields to show as metadata below the title
  const metaFields = useMemo(() =>
    fields.filter(f => f.key !== dateField && f.key !== titleField).slice(0, 3),
  [fields, dateField, titleField]);

  // Sort by date ascending
  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const da = new Date((a[dateField] as string) ?? '').getTime();
      const db = new Date((b[dateField] as string) ?? '').getTime();
      return da - db;
    });
  }, [data, dateField]);

  if (sorted.length === 0) {
    return (
      <div style={{
        padding: 'var(--spacing-lg)',
        textAlign: 'center',
        color: 'var(--palette-on-surface-variant)',
      }}>
        No events to display
      </div>
    );
  }

  // Group by date label for visual separation
  const groupedByDate: { dateLabel: string; items: { row: Record<string, unknown>; index: number }[] }[] = [];
  let lastLabel = '';
  sorted.forEach((row, index) => {
    const label = formatDate(row[dateField]) || 'Undated';
    if (label !== lastLabel) {
      groupedByDate.push({ dateLabel: label, items: [] });
      lastLabel = label;
    }
    groupedByDate[groupedByDate.length - 1].items.push({ row, index });
  });

  return (
    <div style={{ padding: 'var(--spacing-sm)' }}>
      {groupedByDate.map(({ dateLabel, items }) => (
        <div key={dateLabel} style={{ marginBottom: 'var(--spacing-md)' }}>
          {/* Date section header */}
          <div style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--palette-on-surface-variant)',
            marginBottom: 'var(--spacing-xs)',
            paddingBottom: 4,
            borderBottom: '1px solid var(--palette-outline-variant)',
          }}>
            {dateLabel}
          </div>

          {/* Events for this date */}
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute', left: 8, top: 0, bottom: 0,
              width: 2, background: 'var(--palette-outline-variant)',
              borderRadius: 1,
            }} />

            {items.map(({ row, index }) => {
              const color = EVENT_COLORS[index % EVENT_COLORS.length];
              const timeStr = formatTime(row[dateField]);
              return (
                <div
                  key={index}
                  style={{
                    position: 'relative',
                    marginBottom: 'var(--spacing-sm)',
                    paddingLeft: 'var(--spacing-sm)',
                    cursor: onRowClick ? 'pointer' : 'default',
                  }}
                  onClick={() => onRowClick?.(row)}
                >
                  {/* Dot on the timeline */}
                  <div style={{
                    position: 'absolute', left: -20, top: 4,
                    width: 10, height: 10, borderRadius: '50%',
                    background: color,
                    border: '2px solid var(--palette-surface)',
                    boxShadow: `0 0 0 2px ${color}40`,
                  }} />

                  {/* Event card */}
                  <div style={{
                    background: 'var(--palette-surface)',
                    border: `1px solid var(--palette-outline-variant)`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (onRowClick) {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        'var(--elevation-1, 0 1px 3px rgba(0,0,0,0.12))';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-xs)' }}>
                      <span style={{
                        fontWeight: 600,
                        fontSize: 'var(--typography-body-sm-size, 13px)',
                        color: 'var(--palette-on-surface)',
                        flex: 1,
                      }}>
                        {formatValue(row[titleField]) || '(untitled)'}
                      </span>
                      {timeStr && (
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--palette-on-surface-variant)',
                          fontFamily: 'var(--typography-font-family-mono)',
                          whiteSpace: 'nowrap',
                        }}>
                          {timeStr}
                        </span>
                      )}
                    </div>
                    {metaFields.length > 0 && (
                      <div style={{
                        marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '4px 8px',
                      }}>
                        {metaFields.map(f => {
                          const val = row[f.key];
                          if (val === null || val === undefined || val === '') return null;
                          return (
                            <span key={f.key} style={{
                              fontSize: '10px',
                              color: 'var(--palette-on-surface-variant)',
                            }}>
                              <span style={{ opacity: 0.6 }}>{f.label ?? f.key}:</span>{' '}
                              {formatValue(val)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimelineDisplay;
