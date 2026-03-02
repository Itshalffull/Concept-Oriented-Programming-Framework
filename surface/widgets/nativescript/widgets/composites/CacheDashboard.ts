// ============================================================
// Clef Surface NativeScript Widget — CacheDashboard
//
// Displays cache statistics (hits, misses, size, evictions)
// and provides controls to flush or inspect individual cache
// entries. Uses a stats summary row and scrollable entry list.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Button, ScrollView, LayoutBase } from '@nativescript/core';

// --------------- Types ---------------

export interface CacheEntry {
  key: string;
  size: number;
  hits: number;
  ttl?: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
}

// --------------- Props ---------------

export interface CacheDashboardProps {
  /** Aggregate cache statistics. */
  stats?: CacheStats;
  /** Individual cache entries. */
  entries?: CacheEntry[];
  /** Called when flush-all is tapped. */
  onFlush?: () => void;
  /** Called when a single entry is evicted. */
  onEvict?: (key: string) => void;
}

// --------------- Component ---------------

export function createCacheDashboard(props: CacheDashboardProps = {}): StackLayout {
  const {
    stats = { totalEntries: 0, totalSize: 0, hitRate: 0, missRate: 0, evictions: 0 },
    entries = [],
    onFlush,
    onEvict,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-cache-dashboard';
  container.padding = 12;

  // Title
  const titleLabel = new Label();
  titleLabel.text = 'Cache Dashboard';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  titleLabel.marginBottom = 12;
  container.addChild(titleLabel);

  // Stats grid (2x2)
  const statsGrid = new GridLayout();
  statsGrid.columns = '*, *';
  statsGrid.rows = 'auto, auto';
  statsGrid.marginBottom = 12;

  const statItems: Array<{ label: string; value: string; row: number; col: number }> = [
    { label: 'Hit Rate', value: `${(stats.hitRate * 100).toFixed(1)}%`, row: 0, col: 0 },
    { label: 'Miss Rate', value: `${(stats.missRate * 100).toFixed(1)}%`, row: 0, col: 1 },
    { label: 'Entries', value: `${stats.totalEntries}`, row: 1, col: 0 },
    { label: 'Size', value: formatBytes(stats.totalSize), row: 1, col: 1 },
  ];

  statItems.forEach(({ label, value, row, col }) => {
    const cell = new StackLayout();
    cell.horizontalAlignment = 'center';
    cell.padding = 8;

    const valLabel = new Label();
    valLabel.text = value;
    valLabel.fontWeight = 'bold';
    valLabel.fontSize = 18;
    valLabel.horizontalAlignment = 'center';
    cell.addChild(valLabel);

    const descLabel = new Label();
    descLabel.text = label;
    descLabel.opacity = 0.6;
    descLabel.fontSize = 11;
    descLabel.horizontalAlignment = 'center';
    cell.addChild(descLabel);

    GridLayout.setRow(cell as any, row);
    GridLayout.setColumn(cell as any, col);
    statsGrid.addChild(cell);
  });

  container.addChild(statsGrid);

  // Flush button
  const flushBtn = new Button();
  flushBtn.text = 'Flush All';
  flushBtn.className = 'clef-cache-flush-btn';
  flushBtn.marginBottom = 12;
  if (onFlush) {
    flushBtn.on('tap', () => onFlush());
  }
  container.addChild(flushBtn);

  // Evictions summary
  const evictionLabel = new Label();
  evictionLabel.text = `Evictions: ${stats.evictions}`;
  evictionLabel.opacity = 0.6;
  evictionLabel.fontSize = 12;
  evictionLabel.marginBottom = 8;
  container.addChild(evictionLabel);

  // Entry list
  if (entries.length > 0) {
    const listTitle = new Label();
    listTitle.text = 'Entries';
    listTitle.fontWeight = 'bold';
    listTitle.fontSize = 14;
    listTitle.marginBottom = 4;
    container.addChild(listTitle);

    const scrollView = new ScrollView();
    const list = new StackLayout();

    entries.forEach((entry) => {
      const row = new GridLayout();
      row.columns = '*, auto, auto';
      row.padding = 6;
      row.marginBottom = 2;
      row.backgroundColor = '#F5F5F5' as any;
      row.borderRadius = 4;

      const keyLabel = new Label();
      keyLabel.text = entry.key;
      keyLabel.fontSize = 12;
      keyLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(keyLabel, 0);
      row.addChild(keyLabel);

      const hitsLabel = new Label();
      hitsLabel.text = `${entry.hits} hits`;
      hitsLabel.opacity = 0.5;
      hitsLabel.fontSize = 11;
      hitsLabel.verticalAlignment = 'middle';
      hitsLabel.marginRight = 8;
      GridLayout.setColumn(hitsLabel, 1);
      row.addChild(hitsLabel);

      if (onEvict) {
        const evictBtn = new Button();
        evictBtn.text = 'Evict';
        evictBtn.fontSize = 10;
        evictBtn.padding = 2;
        GridLayout.setColumn(evictBtn, 2);
        evictBtn.on('tap', () => onEvict(entry.key));
        row.addChild(evictBtn);
      }

      list.addChild(row);
    });

    scrollView.content = list;
    container.addChild(scrollView);
  }

  return container;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

createCacheDashboard.displayName = 'CacheDashboard';
export default createCacheDashboard;
