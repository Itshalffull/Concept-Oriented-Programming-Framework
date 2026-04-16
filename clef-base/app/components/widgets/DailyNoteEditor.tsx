'use client';

/**
 * DailyNoteEditor — center editing surface for /admin/daily/:date.
 * Per surface/widgets/daily-note-editor.widget.
 *
 * Displays the ISO date as a large heading, the human-readable day-of-week,
 * prev/next navigation arrows, a "Jump to today" button, and a block editor
 * body wired to the ContentNode keyed "daily-note:{date}".
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import RecursiveBlockEditor from './RecursiveBlockEditor';

export interface DailyNoteEditorProps {
  date: string;          // YYYY-MM-DD
  today: string;         // YYYY-MM-DD — used to hide the "today" button
  onNavigate: (date: string) => void;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  padding: 'var(--spacing-lg)',
  gap: 'var(--spacing-md)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  flexWrap: 'wrap',
};

const dateHeadingStyle: React.CSSProperties = {
  fontSize: 'var(--typography-display-sm-size, 2rem)',
  fontWeight: 'var(--typography-display-sm-weight, 700)' as React.CSSProperties['fontWeight'],
  color: 'var(--palette-on-surface)',
  margin: 0,
  lineHeight: 1.15,
};

const dayLabelStyle: React.CSSProperties = {
  fontSize: 'var(--typography-body-md-size)',
  color: 'var(--palette-on-surface-variant)',
  flex: 1,
};

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 10px',
  cursor: 'pointer',
  color: 'var(--palette-on-surface)',
  fontFamily: 'inherit',
  fontSize: 'var(--typography-body-sm-size)',
};

const todayBtnStyle: React.CSSProperties = {
  background: 'var(--palette-primary-container)',
  border: '1px solid var(--palette-primary)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 10px',
  cursor: 'pointer',
  color: 'var(--palette-on-primary-container)',
  fontFamily: 'inherit',
  fontSize: 'var(--typography-body-sm-size)',
};

const editorBodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
};

const loadingStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 'var(--typography-body-sm-size)',
};

export const DailyNoteEditor: React.FC<DailyNoteEditorProps> = ({
  date,
  today,
  onNavigate,
}) => {
  const invoke = useKernelInvoke();
  const nodeId = `daily-note:${date}`;
  const prevDate = useMemo(() => shiftDate(date, -1), [date]);
  const nextDate = useMemo(() => shiftDate(date, 1), [date]);
  const dayLabel = useMemo(() => formatDayLabel(date), [date]);
  const isToday = date === today;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensureCanonicalDailyNote(): Promise<void> {
      setIsReady(false);

      try {
        let didMutate = false;
        const nodeResult = await invoke('ContentNode', 'get', { node: nodeId });
        const nodeExists = nodeResult.variant === 'ok';
        const schemas = nodeExists && Array.isArray(nodeResult.schemas)
          ? nodeResult.schemas
          : [];
        const hasDailyNoteSchema = schemas.includes('DailyNote');

        if (!nodeExists) {
          const createResult = await invoke('ContentNode', 'createWithSchema', {
            node: nodeId,
            schema: 'DailyNote',
            title: date,
            body: '',
          });

          if (createResult.variant !== 'ok' && createResult.variant !== 'duplicate') {
            throw new Error(`ContentNode/createWithSchema returned ${String(createResult.variant)}`);
          }
          didMutate = true;
        } else if (!hasDailyNoteSchema) {
          const [recordResult, applyResult] = await Promise.all([
            invoke('ContentNode', 'recordSchema', { node: nodeId, schema: 'DailyNote' }),
            invoke('Schema', 'applyTo', { entity_id: nodeId, schema: 'DailyNote' }),
          ]);

          if (recordResult.variant !== 'ok') {
            throw new Error(`ContentNode/recordSchema returned ${String(recordResult.variant)}`);
          }
          if (applyResult.variant !== 'ok' && applyResult.variant !== 'notfound') {
            throw new Error(`Schema/applyTo returned ${String(applyResult.variant)}`);
          }
          didMutate = true;
        }

        if (!cancelled) {
          setIsReady(true);
          if (didMutate && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('daily-note-provisioned', {
              detail: { nodeId, date },
            }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[DailyNoteEditor] Failed to provision canonical daily note:', error);
          setIsReady(true);
        }
      }
    }

    void ensureCanonicalDailyNote();
    return () => { cancelled = true; };
  }, [date, invoke, nodeId]);

  return (
    <div
      data-part="root"
      data-state="idle"
      data-date={date}
      style={rootStyle}
      role="region"
      aria-label="Daily note editor"
    >
      <div data-part="header" style={headerStyle}>
        <button
          type="button"
          data-part="prev-button"
          style={navBtnStyle}
          aria-label="Previous day"
          onClick={() => onNavigate(prevDate)}
        >
          &#8592;
        </button>

        <h1 data-part="date-heading" style={dateHeadingStyle}>
          {date}
        </h1>

        <span data-part="day-label" style={dayLabelStyle}>
          {dayLabel}
        </span>

        <button
          type="button"
          data-part="next-button"
          style={navBtnStyle}
          aria-label="Next day"
          onClick={() => onNavigate(nextDate)}
        >
          &#8594;
        </button>

        {!isToday && (
          <button
            type="button"
            data-part="today-button"
            style={todayBtnStyle}
            aria-label="Jump to today"
            onClick={() => onNavigate(today)}
          >
            Today
          </button>
        )}
      </div>

      <div
        data-part="editor-body"
        data-node-id={nodeId}
        style={editorBodyStyle}
      >
        {isReady ? (
          <RecursiveBlockEditor
            rootNodeId={nodeId}
            editorFlavor="markdown"
            canEdit={true}
          />
        ) : (
          <div data-part="editor-loading" style={loadingStyle}>
            Provisioning daily note...
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyNoteEditor;
