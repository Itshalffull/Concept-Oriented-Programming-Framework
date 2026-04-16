'use client';

/**
 * DailyNotePage — three-column layout for /admin/daily/:date.
 *
 * Left rail:  DailyNoteSidebar   (14 recent notes + calendar picker)
 * Center:     DailyNoteEditor    (block editor bound to daily-note:{date})
 * Right rail: ReferencedOnThisDay (nodes with date fields matching :date)
 *
 * Navigation between dates is handled entirely client-side via router.push
 * so the layout doesn't remount on date change.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DailyNoteSidebar } from './widgets/DailyNoteSidebar';
import { DailyNoteEditor } from './widgets/DailyNoteEditor';
import { ReferencedOnThisDay } from './widgets/ReferencedOnThisDay';

export interface DailyNotePageProps {
  /** ISO date string YYYY-MM-DD from the URL segment. */
  date: string;
}

type LayoutMode = 'wide' | 'medium' | 'narrow';

const NAV_HEIGHT = 56;
const NARROW_BREAKPOINT = 900;
const WIDE_BREAKPOINT = 1200;

function getLayoutMode(viewportWidth: number | null): LayoutMode {
  if (viewportWidth !== null && viewportWidth < NARROW_BREAKPOINT) return 'narrow';
  if (viewportWidth !== null && viewportWidth < WIDE_BREAKPOINT) return 'medium';
  return 'wide';
}

export const DailyNotePage: React.FC<DailyNotePageProps> = ({ date }) => {
  const router = useRouter();
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const layoutMode = useMemo(() => getLayoutMode(viewportWidth), [viewportWidth]);
  const isStackedLayout = layoutMode !== 'wide';

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  const handleNavigate = useCallback(
    (targetDate: string) => {
      router.push(`/admin/daily/${targetDate}`);
    },
    [router],
  );

  const rootStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: isStackedLayout ? 'column' : 'row',
      height: `calc(100vh - ${NAV_HEIGHT}px)`,
      minHeight: 0,
      overflow: 'hidden',
      padding: isStackedLayout ? 'var(--spacing-md)' : 0,
      gap: isStackedLayout ? 'var(--spacing-md)' : 0,
      background: 'var(--palette-surface)',
    }),
    [isStackedLayout],
  );

  const editorPaneStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      border: isStackedLayout ? '1px solid var(--palette-outline)' : undefined,
      borderRadius: isStackedLayout ? 'var(--radius-lg)' : undefined,
      background: 'var(--palette-surface)',
    }),
    [isStackedLayout],
  );

  const stackedPanelsStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: layoutMode === 'narrow' ? 'column' : 'row',
      gap: 'var(--spacing-md)',
      minHeight: 0,
      maxHeight: layoutMode === 'narrow' ? '42vh' : '36vh',
      overflow: 'hidden',
    }),
    [layoutMode],
  );

  const stackedSidebarPaneStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: layoutMode === 'medium' ? '0 0 320px' : '0 0 auto',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }),
    [layoutMode],
  );

  const stackedReferencePaneStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      border: '1px solid var(--palette-outline)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--palette-surface-container)',
      padding: 'var(--spacing-md)',
    }),
    [],
  );

  const wideReferencePaneStyle = useMemo<React.CSSProperties>(
    () => ({
      width: 280,
      minWidth: 0,
      borderLeft: '1px solid var(--palette-outline)',
      overflowY: 'auto',
      background: 'var(--palette-surface-container)',
    }),
    [],
  );

  return (
    <div data-part="daily-note-page" style={rootStyle}>
      {!isStackedLayout && (
        <DailyNoteSidebar activeDate={date} onNavigate={handleNavigate} />
      )}

      <div style={editorPaneStyle}>
        <DailyNoteEditor date={date} today={today} onNavigate={handleNavigate} />
      </div>

      {isStackedLayout ? (
        <div style={stackedPanelsStyle}>
          <div style={stackedSidebarPaneStyle}>
            <DailyNoteSidebar
              activeDate={date}
              onNavigate={handleNavigate}
              mode="section"
              title="Recent notes"
              recentLimit={10}
            />
          </div>

          <aside style={stackedReferencePaneStyle}>
            <ReferencedOnThisDay date={date} />
          </aside>
        </div>
      ) : (
        <aside style={wideReferencePaneStyle}>
          <ReferencedOnThisDay date={date} />
        </aside>
      )}
    </div>
  );
};

export default DailyNotePage;
