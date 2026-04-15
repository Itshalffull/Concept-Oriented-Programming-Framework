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

import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DailyNoteSidebar } from './widgets/DailyNoteSidebar';
import { DailyNoteEditor } from './widgets/DailyNoteEditor';
import { ReferencedOnThisDay } from './widgets/ReferencedOnThisDay';

export interface DailyNotePageProps {
  /** ISO date string YYYY-MM-DD from the URL segment. */
  date: string;
}

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  height: 'calc(100vh - 56px)', // subtract top nav height
  overflow: 'hidden',
};

export const DailyNotePage: React.FC<DailyNotePageProps> = ({ date }) => {
  const router = useRouter();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleNavigate = useCallback(
    (targetDate: string) => {
      router.push(`/admin/daily/${targetDate}`);
    },
    [router],
  );

  return (
    <div data-part="daily-note-page" style={rootStyle}>
      {/* Left rail */}
      <DailyNoteSidebar activeDate={date} onNavigate={handleNavigate} />

      {/* Center editor — flex-grow to fill remaining width */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <DailyNoteEditor date={date} today={today} onNavigate={handleNavigate} />
      </div>

      {/* Right rail */}
      <div
        style={{
          width: 280,
          minWidth: 0,
          borderLeft: '1px solid var(--palette-outline)',
          overflowY: 'auto',
          background: 'var(--palette-surface-container)',
        }}
      >
        <ReferencedOnThisDay date={date} />
      </div>
    </div>
  );
};

export default DailyNotePage;
