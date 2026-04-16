'use client';

/**
 * DailyNoteSidebar — left-rail navigation panel for /admin/daily/:date.
 * Per surface/widgets/daily-note-sidebar.widget.
 *
 * Shows the 14 most recent daily notes in descending order plus a calendar
 * date picker for jumping to any arbitrary date. Each row shows the ISO date,
 * human-readable day-of-week, and a 1-line content preview when available.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

export interface DailyNoteSidebarProps {
  activeDate: string;    // YYYY-MM-DD — currently displayed date
  onNavigate: (date: string) => void;
}

interface NoteEntry {
  id: string;         // e.g. "daily-note:2026-04-15"
  date: string;       // "2026-04-15"
  dayLabel: string;   // "Wednesday, April 15"
  preview: string;    // first line of content, may be empty
}

function parseDailyNoteId(id: string): string | null {
  const match = id.match(/^daily-note:(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function extractPreview(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content.slice(0, 80);
  if (typeof content === 'object' && content !== null) {
    const c = content as Record<string, unknown>;
    if (typeof c['text'] === 'string') return c['text'].slice(0, 80);
    if (typeof c['content'] === 'string') return c['content'].slice(0, 80);
  }
  return '';
}

function coerceRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const sidebarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 240,
  minHeight: 0,
  borderRight: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-container)',
  overflowY: 'auto',
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
};

const itemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  padding: '8px var(--spacing-md)',
  cursor: 'pointer',
  background: active ? 'var(--palette-secondary-container)' : 'transparent',
  borderLeft: active ? '3px solid var(--palette-primary)' : '3px solid transparent',
  gap: 2,
});

const dateLabelStyle: React.CSSProperties = {
  fontSize: 'var(--typography-label-sm-size)',
  fontWeight: 'var(--typography-label-sm-weight)' as React.CSSProperties['fontWeight'],
  color: 'var(--palette-on-surface)',
  fontFamily: 'var(--typography-mono-family, monospace)',
};

const dayLabelStyle: React.CSSProperties = {
  fontSize: 'var(--typography-body-xs-size, 11px)',
  color: 'var(--palette-on-surface-variant)',
};

const previewStyle: React.CSSProperties = {
  fontSize: 'var(--typography-body-xs-size, 11px)',
  color: 'var(--palette-on-surface-variant)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  opacity: 0.75,
};

const calendarSectionStyle: React.CSSProperties = {
  borderTop: '1px solid var(--palette-outline)',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const calendarLabelStyle: React.CSSProperties = {
  fontSize: 'var(--typography-label-sm-size)',
  color: 'var(--palette-on-surface-variant)',
};

const calendarInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontFamily: 'inherit',
  fontSize: 'var(--typography-body-sm-size)',
  cursor: 'pointer',
};

const loadingStyle: React.CSSProperties = {
  padding: 'var(--spacing-md)',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 'var(--typography-body-sm-size)',
};

export const DailyNoteSidebar: React.FC<DailyNoteSidebarProps> = ({
  activeDate,
  onNavigate,
}) => {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const invoke = useKernelInvoke();

  useEffect(() => {
    let cancelled = false;
    async function loadNotes(): Promise<void> {
      setLoading(true);
      try {
        const result = await invoke('ContentNode', 'listBySchema', {
          schema: 'DailyNote',
          limit: 14,
          sortDesc: true,
        });
        if (cancelled) return;
        const raw = result['nodes'] ?? result['items'] ?? result;
        const rows = coerceRows(raw);
        const entries: NoteEntry[] = rows
          .map((row: unknown) => {
            if (typeof row !== 'object' || row === null) return null;
            const r = row as Record<string, unknown>;
            const id = String(r['id'] ?? r['node'] ?? '');
            const date = parseDailyNoteId(id);
            if (!date) return null;
            return {
              id,
              date,
              dayLabel: formatDayLabel(date),
              preview: extractPreview(r['content']),
            } as NoteEntry;
          })
          .filter((e): e is NoteEntry => e !== null);
        setNotes(entries);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const handleProvisioned = (_event: Event) => {
      void loadNotes();
    };

    void loadNotes();
    if (typeof window !== 'undefined') {
      window.addEventListener('daily-note-provisioned', handleProvisioned);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('daily-note-provisioned', handleProvisioned);
      }
    };
  }, [activeDate, invoke, recentLimit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, date: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigate(date);
    }
  }, [onNavigate]);

  const handleCalendarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      onNavigate(val);
    }
  }, [onNavigate]);

  return (
    <nav
      data-part="root"
      data-state={loading ? 'loading' : 'idle'}
      style={sidebarStyle}
      role="navigation"
      aria-label="Daily notes history"
      aria-busy={loading ? 'true' : 'false'}
    >
      {loading ? (
        <div style={loadingStyle}>Loading...</div>
      ) : (
        <ol
          data-part="note-list"
          style={listStyle}
          role="list"
          aria-label="Recent daily notes"
          aria-busy="false"
        >
          {notes.map((note) => (
            <li
              key={note.id}
              data-part="note-item"
              data-date={note.date}
              style={itemStyle(note.date === activeDate)}
              role="listitem"
              tabIndex={0}
              aria-current={note.date === activeDate ? 'page' : undefined}
              onClick={() => onNavigate(note.date)}
              onKeyDown={(e) => handleKeyDown(e, note.date)}
            >
              <span data-part="note-date" style={dateLabelStyle}>
                {note.date}
              </span>
              <span data-part="note-day-label" style={dayLabelStyle}>
                {note.dayLabel}
              </span>
              {note.preview && (
                <span data-part="note-preview" style={previewStyle} title={note.preview}>
                  {note.preview}
                </span>
              )}
            </li>
          ))}
          {notes.length === 0 && (
            <li style={{ ...loadingStyle, listStyle: 'none' }}>
              No daily notes yet.
            </li>
          )}
        </ol>
      )}

      <div style={calendarSectionStyle}>
        <label data-part="calendar-label" style={calendarLabelStyle} htmlFor="daily-note-jump">
          Jump to date
        </label>
        <input
          data-part="calendar-picker"
          id="daily-note-jump"
          type="date"
          style={calendarInputStyle}
          aria-label="Jump to date"
          onChange={handleCalendarChange}
        />
      </div>
    </nav>
  );
};

export default DailyNoteSidebar;
