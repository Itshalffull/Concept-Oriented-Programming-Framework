import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve('.');
const SOURCES = {
  dataTable: path.join(ROOT, 'clef-base/app/components/widgets/DataTable.tsx'),
  tableDisplay: path.join(ROOT, 'clef-base/app/components/widgets/TableDisplay.tsx'),
  cardGridDisplay: path.join(ROOT, 'clef-base/app/components/widgets/CardGridDisplay.tsx'),
  detailDisplay: path.join(ROOT, 'clef-base/app/components/widgets/DetailDisplay.tsx'),
  globals: path.join(ROOT, 'clef-base/app/styles/globals.css'),
};

describe('clef-base data display surfaces', () => {
  it('exposes a shared theme surface contract for the primary data display widgets', () => {
    expect(fs.readFileSync(SOURCES.dataTable, 'utf8')).toContain('data-surface="display-table"');
    expect(fs.readFileSync(SOURCES.tableDisplay, 'utf8')).toContain('data-surface="display-toolbar"');
    expect(fs.readFileSync(SOURCES.tableDisplay, 'utf8')).toContain('data-surface="display-row-actions"');
    expect(fs.readFileSync(SOURCES.cardGridDisplay, 'utf8')).toContain('data-surface="display-card-grid"');
    expect(fs.readFileSync(SOURCES.cardGridDisplay, 'utf8')).toContain('data-surface="display-row-actions"');
    expect(fs.readFileSync(SOURCES.detailDisplay, 'utf8')).toContain('data-surface="display-detail"');
  });

  it('centralizes display chrome in globals.css under a MAG-652 section', () => {
    const globals = fs.readFileSync(SOURCES.globals, 'utf8');
    expect(globals).toContain('MAG-652 Data Display Surfaces');
    expect(globals).toContain('[data-surface="display-toolbar"]');
    expect(globals).toContain('[data-surface="display-table"]');
    expect(globals).toContain('[data-surface="display-row-actions"]');
    expect(globals).toContain('[data-surface="display-card-grid"]');
    expect(globals).toContain('[data-surface="display-detail"]');
  });

  it('removes the most obvious one-off inline layout fragments from these widgets', () => {
    const combined = [
      fs.readFileSync(SOURCES.dataTable, 'utf8'),
      fs.readFileSync(SOURCES.tableDisplay, 'utf8'),
      fs.readFileSync(SOURCES.cardGridDisplay, 'utf8'),
      fs.readFileSync(SOURCES.detailDisplay, 'utf8'),
    ].join('\n');

    expect(combined).not.toContain("style={{ width: 28 }}");
    expect(combined).not.toContain("style={{ padding: '0 0 0 24px', background: 'var(--palette-surface-variant)' }}");
    expect(combined).not.toContain("style={{ marginTop: 'var(--spacing-sm)' }}");
    expect(combined).not.toContain("style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}");
    expect(combined).not.toContain("style={{ display: 'grid', gridTemplateColumns: '160px 1fr'");
  });
});
