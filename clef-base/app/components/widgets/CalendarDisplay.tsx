'use client';

/**
 * CalendarDisplay — Month/week/day calendar display type for ViewRenderer.
 *
 * Renders an arbitrary list of data records as calendar events placed on
 * their dates. The dateField prop controls which record key holds the date
 * string; labelField controls which key supplies the display label.
 *
 * Implements the calendar-display widget spec from:
 *   repertoire/widgets/data-display/calendar-display.widget
 *
 * Anatomy data-part attributes match the widget spec so automated
 * conformance tests can select parts by [data-part="<name>"].
 */

import React, { useMemo, useState, useCallback } from 'react';
import type { FieldConfig } from './TableDisplay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

type ViewMode = 'month' | 'week' | 'day';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_OF_WEEK_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(raw as string);
  return isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameWeek(a: Date, b: Date): boolean {
  const mondayA = startOfWeek(a);
  const mondayB = startOfWeek(b);
  return isSameDay(mondayA, mondayB);
}

/** Returns the Sunday of the week containing d. */
function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatPeriodLabel(view: ViewMode, anchor: Date): string {
  if (view === 'month') {
    return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }
  if (view === 'week') {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
  }
  // day
  return `${DAYS_OF_WEEK_LONG[anchor.getDay()]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

// ---------------------------------------------------------------------------
// Shared token shorthands
// ---------------------------------------------------------------------------

const token = {
  surface:       'var(--palette-surface)',
  surfaceVar:    'var(--palette-surface-variant)',
  onSurface:     'var(--palette-on-surface)',
  onSurfaceVar:  'var(--palette-on-surface-variant)',
  outline:       'var(--palette-outline-variant)',
  primary:       'var(--palette-primary)',
  onPrimary:     'var(--palette-on-primary)',
  primaryCont:   'var(--palette-primary-container, #e0e7ff)',
  onPrimaryCont: 'var(--palette-on-primary-container, #1e1b4b)',
  radiusSm:      'var(--radius-sm)',
  radiusMd:      'var(--radius-md)',
  spacingSm:     'var(--spacing-sm)',
  fontFamily:    'var(--typography-font-family)',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EventChipProps {
  label: string;
  onClick?: () => void;
}

function EventChip({ label, onClick }: EventChipProps) {
  return (
    <div
      data-part="event-item"
      role="button"
      aria-label={label}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      style={{
        fontSize: '10px',
        padding: '1px 5px',
        borderRadius: token.radiusSm,
        background: token.primaryCont,
        color: token.onPrimaryCont,
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
      }}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

interface MonthViewProps {
  viewYear: number;
  viewMonth: number;
  today: Date;
  itemsByDay: Map<number, Record<string, unknown>[]>;
  labelField: string;
  maxPerCell: number;
  onRowClick?: (row: Record<string, unknown>) => void;
}

function MonthView({ viewYear, viewMonth, today, itemsByDay, labelField, maxPerCell, onRowClick }: MonthViewProps) {
  const { cells, startOffset } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const offset = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const totalCells = Math.ceil((offset + totalDays) / 7) * 7;
    const allCells: (number | null)[] = [
      ...Array<null>(offset).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => i + 1),
      ...Array<null>(totalCells - offset - totalDays).fill(null),
    ];
    return { cells: allCells, startOffset: offset };
  }, [viewYear, viewMonth]);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div
      data-part="grid"
      role="grid"
      aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
      style={{
        border: `1px solid ${token.outline}`,
        borderRadius: token.radiusMd,
        overflow: 'hidden',
      }}
    >
      {/* Day-of-week column headers */}
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: `1px solid ${token.outline}`,
        }}
      >
        {DAYS_OF_WEEK_SHORT.map(d => (
          <div
            key={d}
            role="columnheader"
            aria-label={DAYS_OF_WEEK_LONG[DAYS_OF_WEEK_SHORT.indexOf(d)]}
            style={{
              padding: '6px 0',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: 600,
              color: token.onSurfaceVar,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: token.surfaceVar,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div
          key={wi}
          data-part="week-row"
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: wi < weeks.length - 1 ? `1px solid ${token.outline}` : undefined,
          }}
        >
          {week.map((day, di) => {
            if (day === null) {
              return (
                <div
                  key={di}
                  data-part="empty-cell"
                  role="gridcell"
                  aria-hidden="true"
                  style={{
                    background: token.surfaceVar,
                    minHeight: 80,
                    borderRight: di < 6 ? `1px solid ${token.outline}` : undefined,
                    opacity: 0.5,
                  }}
                />
              );
            }

            const cellDate = new Date(viewYear, viewMonth, day);
            const isToday = isSameDay(cellDate, today);
            const items = itemsByDay.get(day) ?? [];
            const visible = items.slice(0, maxPerCell);
            const hidden = items.length - visible.length;

            return (
              <div
                key={di}
                data-part="day-cell"
                role="gridcell"
                aria-label={`${MONTH_NAMES[viewMonth]} ${day}, ${viewYear}${items.length > 0 ? `, ${items.length} event${items.length > 1 ? 's' : ''}` : ''}`}
                data-today={isToday ? 'true' : 'false'}
                data-has-events={items.length > 0 ? 'true' : 'false'}
                tabIndex={isToday ? 0 : -1}
                style={{
                  background: token.surface,
                  minHeight: 80,
                  padding: 4,
                  borderRight: di < 6 ? `1px solid ${token.outline}` : undefined,
                  outline: 'none',
                  cursor: 'default',
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && items.length === 1) {
                    onRowClick?.(items[0]);
                  }
                }}
              >
                {/* Day number */}
                <div
                  data-part="day-number"
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isToday ? token.primary : 'transparent',
                    color: isToday ? token.onPrimary : token.onSurface,
                    fontSize: '12px',
                    fontWeight: isToday ? 700 : 400,
                    marginBottom: 2,
                  }}
                >
                  {day}
                </div>

                {/* Events */}
                {visible.length > 0 && (
                  <div data-part="event-list" role="list" aria-label={`Events on ${MONTH_NAMES[viewMonth]} ${day}`}>
                    {visible.map((row, i) => (
                      <EventChip
                        key={i}
                        label={String(row[labelField] ?? '(no title)')}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      />
                    ))}
                  </div>
                )}

                {hidden > 0 && (
                  <div
                    data-part="overflow-badge"
                    aria-label={`${hidden} more events`}
                    style={{ fontSize: '9px', color: token.onSurfaceVar }}
                  >
                    +{hidden} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

interface WeekViewProps {
  anchor: Date;
  today: Date;
  allItems: { row: Record<string, unknown>; date: Date }[];
  labelField: string;
  onRowClick?: (row: Record<string, unknown>) => void;
}

function WeekView({ anchor, today, allItems, labelField, onRowClick }: WeekViewProps) {
  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group items by day-of-week index (0-6)
  const itemsByDow = useMemo(() => {
    const map = new Map<number, { row: Record<string, unknown>; date: Date }[]>();
    for (const item of allItems) {
      if (!isSameWeek(item.date, anchor)) continue;
      const dow = item.date.getDay();
      const list = map.get(dow) ?? [];
      list.push(item);
      map.set(dow, list);
    }
    return map;
  }, [allItems, anchor]);

  return (
    <div
      data-part="grid"
      role="grid"
      aria-label={formatPeriodLabel('week', anchor)}
      style={{
        border: `1px solid ${token.outline}`,
        borderRadius: token.radiusMd,
        overflow: 'hidden',
      }}
    >
      {/* Column headers */}
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '50px repeat(7, 1fr)',
          borderBottom: `1px solid ${token.outline}`,
          background: token.surfaceVar,
        }}
      >
        <div style={{ borderRight: `1px solid ${token.outline}` }} />
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              role="columnheader"
              aria-label={DAYS_OF_WEEK_LONG[d.getDay()]}
              style={{
                padding: '6px 4px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: isToday ? 700 : 600,
                color: isToday ? token.primary : token.onSurfaceVar,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderRight: i < 6 ? `1px solid ${token.outline}` : undefined,
              }}
            >
              {DAYS_OF_WEEK_SHORT[d.getDay()]}
              <div style={{
                fontSize: '14px',
                fontWeight: isToday ? 700 : 400,
                marginTop: 2,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: isToday ? token.primary : 'transparent',
                color: isToday ? token.onPrimary : token.onSurface,
                marginLeft: 4,
              }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div
        data-part="week-row"
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '50px repeat(7, 1fr)',
          borderBottom: `1px solid ${token.outline}`,
          minHeight: 40,
        }}
      >
        <div style={{
          fontSize: '9px',
          color: token.onSurfaceVar,
          padding: '4px 2px',
          textAlign: 'right',
          borderRight: `1px solid ${token.outline}`,
        }}>
          All day
        </div>
        {weekDays.map((d, i) => {
          const dow = d.getDay();
          const dayItems = itemsByDow.get(dow) ?? [];
          return (
            <div
              key={i}
              data-part="day-cell"
              role="gridcell"
              aria-label={`${DAYS_OF_WEEK_LONG[d.getDay()]} ${d.getDate()}`}
              data-today={isSameDay(d, today) ? 'true' : 'false'}
              data-has-events={dayItems.length > 0 ? 'true' : 'false'}
              tabIndex={isSameDay(d, today) ? 0 : -1}
              style={{
                padding: '2px 4px',
                borderRight: i < 6 ? `1px solid ${token.outline}` : undefined,
                background: token.surface,
                minHeight: 36,
              }}
            >
              <div data-part="event-list" role="list">
                {dayItems.map((item, j) => (
                  <EventChip
                    key={j}
                    label={String(item.row[labelField] ?? '(no title)')}
                    onClick={onRowClick ? () => onRowClick(item.row) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable hour rows — show 8 AM–6 PM visible, rest scrollable */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {HOURS.map(h => (
          <div
            key={h}
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: '50px repeat(7, 1fr)',
              borderBottom: `1px solid ${token.outline}`,
              minHeight: 44,
            }}
          >
            <div style={{
              fontSize: '9px',
              color: token.onSurfaceVar,
              padding: '4px 2px',
              textAlign: 'right',
              borderRight: `1px solid ${token.outline}`,
              alignSelf: 'flex-start',
              paddingTop: 2,
            }}>
              {formatHour(h)}
            </div>
            {weekDays.map((_, i) => (
              <div
                key={i}
                role="gridcell"
                style={{
                  borderRight: i < 6 ? `1px solid ${token.outline}` : undefined,
                  background: token.surface,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

interface DayViewProps {
  anchor: Date;
  today: Date;
  allItems: { row: Record<string, unknown>; date: Date }[];
  labelField: string;
  onRowClick?: (row: Record<string, unknown>) => void;
}

function DayView({ anchor, today, allItems, labelField, onRowClick }: DayViewProps) {
  const isToday = isSameDay(anchor, today);

  const dayItems = useMemo(() =>
    allItems.filter(item => isSameDay(item.date, anchor)),
  [allItems, anchor]);

  const itemsByHour = useMemo(() => {
    const map = new Map<number, { row: Record<string, unknown>; date: Date }[]>();
    for (const item of dayItems) {
      const h = item.date.getHours();
      const list = map.get(h) ?? [];
      list.push(item);
      map.set(h, list);
    }
    return map;
  }, [dayItems]);

  return (
    <div
      data-part="grid"
      role="grid"
      aria-label={formatPeriodLabel('day', anchor)}
      style={{
        border: `1px solid ${token.outline}`,
        borderRadius: token.radiusMd,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr',
          borderBottom: `1px solid ${token.outline}`,
          background: token.surfaceVar,
        }}
      >
        <div style={{ borderRight: `1px solid ${token.outline}` }} />
        <div
          role="columnheader"
          style={{
            padding: '8px 12px',
            fontWeight: 600,
            fontSize: '13px',
            color: isToday ? token.primary : token.onSurface,
          }}
        >
          {DAYS_OF_WEEK_LONG[anchor.getDay()]}, {MONTH_NAMES[anchor.getMonth()]} {anchor.getDate()}
          {isToday && <span style={{ fontSize: '11px', marginLeft: 6, opacity: 0.7 }}>(Today)</span>}
        </div>
      </div>

      {/* All-day section */}
      {dayItems.length > 0 && (
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr',
            borderBottom: `1px solid ${token.outline}`,
            background: token.surface,
          }}
        >
          <div style={{
            fontSize: '9px', color: token.onSurfaceVar, padding: '4px 4px',
            textAlign: 'right', borderRight: `1px solid ${token.outline}`,
          }}>
            All day
          </div>
          <div
            data-part="day-cell"
            role="gridcell"
            aria-label={`${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()} all-day events`}
            data-today={isToday ? 'true' : 'false'}
            data-has-events="true"
            style={{ padding: '4px 8px' }}
          >
            <div data-part="event-list" role="list">
              {dayItems.map((item, i) => (
                <EventChip
                  key={i}
                  label={String(item.row[labelField] ?? '(no title)')}
                  onClick={onRowClick ? () => onRowClick(item.row) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hour rows */}
      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        {HOURS.map(h => {
          const hourItems = itemsByHour.get(h) ?? [];
          return (
            <div
              key={h}
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr',
                borderBottom: `1px solid ${token.outline}`,
                minHeight: 44,
              }}
            >
              <div style={{
                fontSize: '10px', color: token.onSurfaceVar,
                padding: '4px', textAlign: 'right',
                borderRight: `1px solid ${token.outline}`,
                alignSelf: 'flex-start',
                paddingTop: 4,
              }}>
                {formatHour(h)}
              </div>
              <div
                role="gridcell"
                style={{ padding: '2px 8px', background: token.surface }}
              >
                {hourItems.map((item, i) => (
                  <EventChip
                    key={i}
                    label={String(item.row[labelField] ?? '(no title)')}
                    onClick={onRowClick ? () => onRowClick(item.row) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export const CalendarDisplay: React.FC<CalendarDisplayProps> = ({ data, fields, onRowClick }) => {
  const today = new Date();
  const [view, setView] = useState<ViewMode>('month');

  // Anchor date drives navigation in all views
  const [anchor, setAnchor] = useState(() => {
    const d = new Date(today);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Determine which field holds the date value
  const dateField = useMemo(() => {
    const dateFormatted = fields.find(f => f.formatter === 'date');
    if (dateFormatted) return dateFormatted.key;
    const guessed = fields.find(f =>
      /date|at|on|time|created|updated|due|start|end/i.test(f.key),
    );
    return guessed?.key ?? fields[0]?.key ?? 'date';
  }, [fields]);

  // Determine which field holds the display label
  const labelField = useMemo(() => {
    const f = fields.find(f => f.key !== dateField);
    return f?.key ?? fields[0]?.key ?? 'name';
  }, [fields, dateField]);

  // Pre-parse all item dates once
  const parsedItems = useMemo(() =>
    data.flatMap(row => {
      const d = parseDate(row[dateField]);
      return d ? [{ row, date: d }] : [];
    }),
  [data, dateField]);

  // Month-view fast lookup: day-of-month -> rows
  const itemsByDay = useMemo(() => {
    const map = new Map<number, Record<string, unknown>[]>();
    if (view !== 'month') return map;
    for (const { row, date } of parsedItems) {
      if (date.getFullYear() !== anchor.getFullYear() || date.getMonth() !== anchor.getMonth()) continue;
      const day = date.getDate();
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [parsedItems, anchor, view]);

  // Navigation handlers
  const navigate = useCallback((direction: -1 | 1) => {
    setAnchor(prev => {
      const d = new Date(prev);
      if (view === 'month') {
        d.setMonth(d.getMonth() + direction);
        d.setDate(1);
      } else if (view === 'week') {
        d.setDate(d.getDate() + direction * 7);
      } else {
        d.setDate(d.getDate() + direction);
      }
      return d;
    });
  }, [view]);

  const goToday = useCallback(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    if (view === 'month') d.setDate(1);
    setAnchor(d);
  }, [view, today]);

  const periodLabel = formatPeriodLabel(view, anchor);

  // Tab button style helper
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px',
    borderRadius: token.radiusSm,
    border: `1px solid ${active ? token.primary : token.outline}`,
    background: active ? token.primary : token.surface,
    color: active ? token.onPrimary : token.onSurface,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
  });

  const navBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: token.radiusSm,
    border: `1px solid ${token.outline}`,
    background: token.surface,
    cursor: 'pointer',
    color: token.onSurface,
  };

  return (
    <div
      data-part="root"
      data-state={view}
      data-view={view}
      role="application"
      aria-roledescription="calendar display"
      aria-label="Calendar display"
      style={{ fontFamily: token.fontFamily, userSelect: 'none' }}
    >
      {/* Header */}
      <div
        data-part="header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.spacingSm,
          marginBottom: token.spacingSm,
          flexWrap: 'wrap',
        }}
      >
        {/* Navigation */}
        <div
          data-part="navigation"
          role="group"
          aria-label="Calendar navigation"
          style={{ display: 'flex', gap: 4 }}
        >
          <button
            data-part="prev-button"
            aria-label={view === 'month' ? 'Previous month' : view === 'week' ? 'Previous week' : 'Previous day'}
            onClick={() => navigate(-1)}
            style={navBtnStyle}
          >
            ‹
          </button>
          <button
            data-part="today-button"
            aria-label="Go to today"
            onClick={goToday}
            style={{ ...navBtnStyle, fontSize: '12px' }}
          >
            Today
          </button>
          <button
            data-part="next-button"
            aria-label={view === 'month' ? 'Next month' : view === 'week' ? 'Next week' : 'Next day'}
            onClick={() => navigate(1)}
            style={navBtnStyle}
          >
            ›
          </button>
        </div>

        {/* Period title */}
        <span
          data-part="title"
          role="heading"
          aria-live="polite"
          aria-atomic="true"
          style={{
            fontWeight: 600,
            fontSize: 'var(--typography-label-lg-size, 15px)',
            flex: 1,
            textAlign: 'center',
            color: token.onSurface,
          }}
        >
          {periodLabel}
        </span>

        {/* View switcher */}
        <div
          data-part="view-switcher"
          role="tablist"
          aria-label="Calendar view options"
          style={{ display: 'flex', gap: 4 }}
        >
          <button
            data-part="month-tab"
            role="tab"
            aria-selected={view === 'month' ? 'true' : 'false'}
            aria-label="Month view"
            tabIndex={view === 'month' ? 0 : -1}
            onClick={() => setView('month')}
            style={tabStyle(view === 'month')}
          >
            Month
          </button>
          <button
            data-part="week-tab"
            role="tab"
            aria-selected={view === 'week' ? 'true' : 'false'}
            aria-label="Week view"
            tabIndex={view === 'week' ? 0 : -1}
            onClick={() => setView('week')}
            style={tabStyle(view === 'week')}
          >
            Week
          </button>
          <button
            data-part="day-tab"
            role="tab"
            aria-selected={view === 'day' ? 'true' : 'false'}
            aria-label="Day view"
            tabIndex={view === 'day' ? 0 : -1}
            onClick={() => setView('day')}
            style={tabStyle(view === 'day')}
          >
            Day
          </button>
        </div>
      </div>

      {/* View body */}
      {view === 'month' && (
        <MonthView
          viewYear={anchor.getFullYear()}
          viewMonth={anchor.getMonth()}
          today={today}
          itemsByDay={itemsByDay}
          labelField={labelField}
          maxPerCell={3}
          onRowClick={onRowClick}
        />
      )}
      {view === 'week' && (
        <WeekView
          anchor={anchor}
          today={today}
          allItems={parsedItems}
          labelField={labelField}
          onRowClick={onRowClick}
        />
      )}
      {view === 'day' && (
        <DayView
          anchor={anchor}
          today={today}
          allItems={parsedItems}
          labelField={labelField}
          onRowClick={onRowClick}
        />
      )}

      {/* Footer legend */}
      <div style={{
        marginTop: token.spacingSm,
        fontSize: '11px',
        color: token.onSurfaceVar,
        textAlign: 'right',
      }}>
        {data.length} item{data.length !== 1 ? 's' : ''} total · {dateField}
      </div>
    </div>
  );
};

export default CalendarDisplay;
