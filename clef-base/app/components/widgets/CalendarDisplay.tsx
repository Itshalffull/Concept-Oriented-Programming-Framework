'use client';

/**
 * CalendarDisplay — Monthly calendar display type for ViewRenderer.
 *
 * Renders data rows as calendar events. Expects a date field (configurable
 * via the first field with formatter "date", or the first field) to place
 * items on the calendar grid. Clicking a day or event triggers onRowClick.
 */

import React, { useMemo, useState } from 'react';
import type { FieldConfig } from './TableDisplay';

interface CalendarDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDateFromRow(row: Record<string, unknown>, dateField: string): Date | null {
  const raw = row[dateField];
  if (!raw) return null;
  const d = new Date(raw as string);
  if (isNaN(d.getTime())) return null;
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export const CalendarDisplay: React.FC<CalendarDisplayProps> = ({ data, fields, onRowClick }) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Determine which field to use as the date field
  const dateField = useMemo(() => {
    const dateFormatted = fields.find(f => f.formatter === 'date');
    if (dateFormatted) return dateFormatted.key;
    // Look for field with "date", "at", "on", "time" in the key
    const guessed = fields.find(f =>
      /date|at|on|time|created|updated|due|start|end/i.test(f.key),
    );
    return guessed?.key ?? fields[0]?.key ?? 'date';
  }, [fields]);

  // Title field — first non-date field
  const titleField = useMemo(() => {
    const f = fields.find(f => f.key !== dateField);
    return f?.key ?? fields[0]?.key ?? 'name';
  }, [fields, dateField]);

  // Build calendar grid
  const { calendarDays, startOffset } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const offset = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();
    return {
      calendarDays: Array.from({ length: totalDays }, (_, i) => i + 1),
      startOffset: offset,
    };
  }, [viewYear, viewMonth]);

  // Map items to their day numbers for fast lookup
  const itemsByDay = useMemo(() => {
    const map = new Map<number, Record<string, unknown>[]>();
    for (const row of data) {
      const d = getDateFromRow(row, dateField);
      if (!d) continue;
      if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [data, dateField, viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  // Total cells needed (offset + days, rounded to full weeks)
  const totalCells = Math.ceil((startOffset + calendarDays.length) / 7) * 7;
  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...calendarDays,
    ...Array<null>(totalCells - startOffset - calendarDays.length).fill(null),
  ];

  return (
    <div style={{ fontFamily: 'var(--typography-font-family)', userSelect: 'none' }}>
      {/* Navigation header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-sm)',
      }}>
        <button
          onClick={prevMonth}
          style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface)', cursor: 'pointer',
            color: 'var(--palette-on-surface)',
          }}
        >‹</button>
        <span style={{
          fontWeight: 600, fontSize: 'var(--typography-label-lg-size, 15px)',
          flex: 1, textAlign: 'center', color: 'var(--palette-on-surface)',
        }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={goToday}
          style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface)', cursor: 'pointer',
            color: 'var(--palette-on-surface)', fontSize: '12px',
          }}
        >Today</button>
        <button
          onClick={nextMonth}
          style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface)', cursor: 'pointer',
            color: 'var(--palette-on-surface)',
          }}
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1, marginBottom: 1,
      }}>
        {DAYS_OF_WEEK.map(d => (
          <div key={d} style={{
            padding: '4px 0', textAlign: 'center',
            fontSize: '11px', fontWeight: 600,
            color: 'var(--palette-on-surface-variant)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1,
        background: 'var(--palette-outline-variant)',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        {cells.map((day, idx) => {
          const isToday = day !== null && isSameDay(
            new Date(viewYear, viewMonth, day),
            today,
          );
          const items = day !== null ? (itemsByDay.get(day) ?? []) : [];
          return (
            <div
              key={idx}
              style={{
                background: day === null
                  ? 'var(--palette-surface-variant)'
                  : 'var(--palette-surface)',
                minHeight: 80,
                padding: '4px',
                position: 'relative',
              }}
            >
              {day !== null && (
                <>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    background: isToday ? 'var(--palette-primary)' : 'transparent',
                    color: isToday ? 'var(--palette-on-primary)' : 'var(--palette-on-surface)',
                    fontSize: '12px', fontWeight: isToday ? 700 : 400,
                    marginBottom: 2,
                  }}>
                    {day}
                  </div>
                  {items.slice(0, 3).map((row, i) => (
                    <div
                      key={i}
                      onClick={() => onRowClick?.(row)}
                      style={{
                        fontSize: '10px',
                        padding: '1px 4px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--palette-primary-container, #e0e7ff)',
                        color: 'var(--palette-on-primary-container, #1e1b4b)',
                        cursor: onRowClick ? 'pointer' : 'default',
                        marginBottom: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {String(row[titleField] ?? '(no title)')}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div style={{
                      fontSize: '9px', color: 'var(--palette-on-surface-variant)',
                    }}>
                      +{items.length - 3} more
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend: total items */}
      <div style={{
        marginTop: 'var(--spacing-sm)', fontSize: '11px',
        color: 'var(--palette-on-surface-variant)', textAlign: 'right',
      }}>
        {data.length} item{data.length !== 1 ? 's' : ''} total · {dateField}
      </div>
    </div>
  );
};

export default CalendarDisplay;
