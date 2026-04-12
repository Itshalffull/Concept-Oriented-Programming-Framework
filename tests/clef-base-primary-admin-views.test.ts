import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

const SOURCES = {
  dashboard: path.join(ROOT, 'clef-base/app/views/DashboardView.tsx'),
  content: path.join(ROOT, 'clef-base/app/views/ContentView.tsx'),
  conceptBrowser: path.join(ROOT, 'clef-base/app/views/ConceptBrowserView.tsx'),
  score: path.join(ROOT, 'clef-base/app/views/ScoreView.tsx'),
  taxonomy: path.join(ROOT, 'clef-base/app/views/TaxonomyView.tsx'),
  displayModes: path.join(ROOT, 'clef-base/app/views/DisplayModesView.tsx'),
  globals: path.join(ROOT, 'clef-base/app/styles/globals.css'),
};

describe('clef-base primary admin view surfaces', () => {
  it('routes the owned admin views through shared view-surface classes', () => {
    const combined = [
      fs.readFileSync(SOURCES.dashboard, 'utf8'),
      fs.readFileSync(SOURCES.content, 'utf8'),
      fs.readFileSync(SOURCES.conceptBrowser, 'utf8'),
      fs.readFileSync(SOURCES.score, 'utf8'),
      fs.readFileSync(SOURCES.taxonomy, 'utf8'),
      fs.readFileSync(SOURCES.displayModes, 'utf8'),
    ].join('\n');

    expect(combined).toContain('className="view-shell"');
    expect(combined).toContain('view-page-header');
    expect(combined).toContain('view-page-copy');
    expect(combined).toContain('view-section');
    expect(combined).toContain('view-section-header');
    expect(combined).toContain('view-status-banner');
    expect(combined).toContain('view-tabs');
    expect(combined).toContain('view-loading');
  });

  it('keeps the shared admin view surface contract in globals.css', () => {
    const css = fs.readFileSync(SOURCES.globals, 'utf8');

    expect(css).toContain('/* ─── MAG-655 Primary Admin View Surfaces ─── */');
    expect(css).toContain('.view-shell');
    expect(css).toContain('.view-page-header');
    expect(css).toContain('.view-panel');
    expect(css).toContain('.view-status-banner');
    expect(css).toContain('.view-card-grid--stats');
    expect(css).toContain('.view-tree-item');
  });
});
