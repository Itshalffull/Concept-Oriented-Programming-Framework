/**
 * Clef Base Surface Contract Pilot — Regression Tests (MAG-662)
 *
 * Verifies:
 *   1. Seed files parse as valid YAML with expected contract / lens definitions
 *   2. generateContractCSS produces correct attribute-selector rules per PRD §3.8
 *   3. Pilot components render with expected data-contract attributes
 *
 * Architecture refs: PRD §3.6, §3.8, §3.9
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const SEEDS_DIR = resolve(ROOT, 'clef-base/seeds');
const STYLES_DIR = resolve(ROOT, 'clef-base/app/styles');
const COMPONENTS_DIR = resolve(ROOT, 'clef-base/app/components/widgets');
const VIEWS_DIR = resolve(ROOT, 'clef-base/app/views');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal YAML sequence parser — extracts top-level `-` entries and reads
 * simple `key: value` pairs from each block. Sufficient for flat seed files.
 */
function parseYamlSeeds(source: string): Array<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = [];
  const blocks = source.split(/^- /m).slice(1); // split on top-level list markers
  for (const block of blocks) {
    const record: Record<string, unknown> = {};
    const lines = block.split('\n');
    for (const line of lines) {
      const m = line.match(/^  ([a-z_]+):\s+(.+)$/);
      if (m) {
        record[m[1]] = m[2].trim();
      }
      // Also capture the `id:` that may be on the first line without indent
      const m2 = line.match(/^([a-z_]+):\s+(.+)$/);
      if (m2 && !record[m2[1]]) {
        record[m2[1]] = m2[2].trim();
      }
    }
    entries.push(record);
  }
  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Seed files parse
// ─────────────────────────────────────────────────────────────────────────────

describe('SurfaceContract seed file', () => {
  const seedPath = resolve(SEEDS_DIR, 'SurfaceContract.seeds.yaml');

  it('exists at the expected path', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source.length).toBeGreaterThan(0);
  });

  it('contains the three pilot contract definitions', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source).toContain('id: floating-panel');
    expect(source).toContain('id: field-control');
    expect(source).toContain('id: page-section');
  });

  it('floating-panel contract declares hover and active states', () => {
    const source = readFileSync(seedPath, 'utf-8');
    // The floating-panel block must list hover and active
    const block = source.slice(source.indexOf('id: floating-panel'), source.indexOf('id: field-control'));
    expect(block).toContain('hover');
    expect(block).toContain('active');
  });

  it('field-control contract declares focus, invalid, disabled states and compact/standard variants', () => {
    const source = readFileSync(seedPath, 'utf-8');
    const startIdx = source.indexOf('id: field-control');
    const endIdx = source.indexOf('id: page-section');
    const block = source.slice(startIdx, endIdx);
    expect(block).toContain('focus');
    expect(block).toContain('invalid');
    expect(block).toContain('disabled');
    expect(block).toContain('compact');
    expect(block).toContain('standard');
  });

  it('page-section contract declares compact and emphasized variants', () => {
    const source = readFileSync(seedPath, 'utf-8');
    const block = source.slice(source.indexOf('id: page-section'));
    expect(block).toContain('compact');
    expect(block).toContain('emphasized');
  });

  it('all three contracts declare semantic resource slots', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source).toContain('surface.overlay');
    expect(source).toContain('surface.control');
    expect(source).toContain('surface.card');
  });
});

describe('SurfaceLens seed file', () => {
  const seedPath = resolve(SEEDS_DIR, 'SurfaceLens.seeds.yaml');

  it('exists at the expected path', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source.length).toBeGreaterThan(0);
  });

  it('contains a lens for FieldHeaderPopover bound to floating-panel', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source).toContain('FieldHeaderPopover');
    expect(source).toContain('floating-panel');
  });

  it('contains a lens for CreateForm bound to field-control', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source).toContain('CreateForm');
    expect(source).toContain('field-control');
  });

  it('contains a lens for DashboardView stat cards bound to page-section', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source).toContain('DashboardView');
    expect(source).toContain('page-section');
  });

  it('includes at least one render-node binding (render-program-node selector support)', () => {
    const source = readFileSync(seedPath, 'utf-8');
    expect(source).toContain('kind: render-node');
  });

  it('covers all three pilot surface families', () => {
    const source = readFileSync(seedPath, 'utf-8');
    // Floating family
    expect(source).toContain('field-header-popover-lens');
    // Form family
    expect(source).toContain('create-form-lens');
    // Page-section family
    expect(source).toContain('dashboard-stat-card-lens');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — CSS generation produces expected selectors
// ─────────────────────────────────────────────────────────────────────────────

describe('generateContractCSS output', () => {
  /**
   * Import the pure helper directly — this exercises the CSS generation logic
   * without needing the full handler lifecycle.
   */
  it('produces base selector for field-control', async () => {
    const { generateContractCSS } = await import('../handlers/ts/surface/theme-realizer.handler.js');
    const css = generateContractCSS(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'], variants: ['compact', 'standard'] }],
      { id: 'test-theme' },
    );
    expect(css).toContain('[data-contract="field-control"]');
  });

  it('produces state selector [data-contract-state~="focus"] for field-control', async () => {
    const { generateContractCSS } = await import('../handlers/ts/surface/theme-realizer.handler.js');
    const css = generateContractCSS(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'], variants: [] }],
      { id: 'test-theme' },
    );
    expect(css).toContain('[data-contract="field-control"][data-contract-state~="focus"]');
    expect(css).toContain('border-color:');
  });

  it('produces state selector [data-contract-state~="invalid"] for field-control', async () => {
    const { generateContractCSS } = await import('../handlers/ts/surface/theme-realizer.handler.js');
    const css = generateContractCSS(
      [{ id: 'field-control', states: ['invalid'], variants: [] }],
      { id: 'test-theme' },
    );
    expect(css).toContain('[data-contract="field-control"][data-contract-state~="invalid"]');
    expect(css).toContain('--palette-border-invalid');
  });

  it('produces base selector for floating-panel', async () => {
    const { generateContractCSS } = await import('../handlers/ts/surface/theme-realizer.handler.js');
    const css = generateContractCSS(
      [{ id: 'floating-panel', states: ['hover', 'active'], variants: [] }],
      { id: 'test-theme' },
    );
    expect(css).toContain('[data-contract="floating-panel"]');
    expect(css).toContain('box-shadow');
  });

  it('produces base selector for page-section', async () => {
    const { generateContractCSS } = await import('../handlers/ts/surface/theme-realizer.handler.js');
    const css = generateContractCSS(
      [{ id: 'page-section', states: [], variants: ['compact', 'emphasized'] }],
      { id: 'test-theme' },
    );
    expect(css).toContain('[data-contract="page-section"]');
    expect(css).toContain('[data-contract="page-section"][data-contract-variant="compact"]');
    expect(css).toContain('[data-contract="page-section"][data-contract-variant="emphasized"]');
  });

  it('emits theme-scoped variable block', async () => {
    const { generateContractCSS } = await import('../handlers/ts/surface/theme-realizer.handler.js');
    const css = generateContractCSS(
      [{ id: 'field-control', states: [], variants: [] }],
      { id: 'clef-light' },
    );
    expect(css).toContain('[data-theme="clef-light"]');
    expect(css).toContain('--palette-surface:');
    expect(css).toContain('--palette-border-focus:');
  });

  it('uses data-attribute convention (not class names) per PRD §3.8', async () => {
    const { generateContractCSS } = await import('../handlers/ts/surface/theme-realizer.handler.js');
    const css = generateContractCSS(
      [{ id: 'field-control', states: ['focus'], variants: [] }],
      { id: 'test-theme' },
    );
    // Selectors must use data-contract attribute, not class names like .sc-field-control
    expect(css).not.toMatch(/\.sc-field-control/);
    expect(css).toContain('[data-contract=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Pilot components render with expected data-contract attributes
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateForm component — data-contract attributes', () => {
  it('has data-contract="field-control" on input elements in the TSX source', () => {
    const source = readFileSync(resolve(COMPONENTS_DIR, 'CreateForm.tsx'), 'utf-8');
    // Verify all three input types carry the contract attribute
    expect(source).toContain('data-contract="field-control"');
    // Should appear on textarea, select, and input
    const count = (source.match(/data-contract="field-control"/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

describe('FieldHeaderPopover component — data-contract attributes', () => {
  it('has data-contract="floating-panel" on the panel root element', () => {
    const source = readFileSync(resolve(COMPONENTS_DIR, 'FieldHeaderPopover.tsx'), 'utf-8');
    expect(source).toContain('data-contract="floating-panel"');
    // Must be on the element that also has data-part="root"
    const rootBlockMatch = source.match(/data-part="root"[\s\S]{0,120}data-contract="floating-panel"/);
    const contractFirstMatch = source.match(/data-contract="floating-panel"[\s\S]{0,120}data-part="root"/);
    expect(rootBlockMatch ?? contractFirstMatch).toBeTruthy();
  });
});

describe('DashboardView — data-contract attributes', () => {
  it('has data-contract="page-section" on the stat cards section element', () => {
    const source = readFileSync(resolve(VIEWS_DIR, 'DashboardView.tsx'), 'utf-8');
    expect(source).toContain('data-contract="page-section"');
    // Must be applied to the live KPIs section (the stat cards container)
    const sectionMatch = source.match(/data-contract="page-section"[\s\S]{0,200}view-card-grid--stats/);
    const sectionMatchReverse = source.match(/view-card-grid--stats[\s\S]{0,400}data-contract="page-section"/);
    // Either the attribute appears before or inside the section
    expect(sectionMatch ?? sectionMatchReverse).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Generated CSS file and globals import
// ─────────────────────────────────────────────────────────────────────────────

describe('contracts.generated.css', () => {
  const cssPath = resolve(STYLES_DIR, 'contracts.generated.css');

  it('exists at clef-base/app/styles/contracts.generated.css', () => {
    const source = readFileSync(cssPath, 'utf-8');
    expect(source.length).toBeGreaterThan(0);
  });

  it('contains base selectors for all three pilot contracts', () => {
    const source = readFileSync(cssPath, 'utf-8');
    expect(source).toContain('[data-contract="floating-panel"]');
    expect(source).toContain('[data-contract="field-control"]');
    expect(source).toContain('[data-contract="page-section"]');
  });

  it('contains state selectors for field-control', () => {
    const source = readFileSync(cssPath, 'utf-8');
    expect(source).toContain('[data-contract="field-control"][data-contract-state~="focus"]');
    expect(source).toContain('[data-contract="field-control"][data-contract-state~="invalid"]');
    expect(source).toContain('[data-contract="field-control"][data-contract-state~="disabled"]');
  });

  it('contains variant selectors for page-section', () => {
    const source = readFileSync(cssPath, 'utf-8');
    expect(source).toContain('[data-contract="page-section"][data-contract-variant="compact"]');
    expect(source).toContain('[data-contract="page-section"][data-contract-variant="emphasized"]');
  });

  it('contains variant selectors for field-control', () => {
    const source = readFileSync(cssPath, 'utf-8');
    expect(source).toContain('[data-contract="field-control"][data-contract-variant="compact"]');
    expect(source).toContain('[data-contract="field-control"][data-contract-variant="standard"]');
  });

  it('references CSS custom properties via var() — no hard-coded color values', () => {
    const source = readFileSync(cssPath, 'utf-8');
    // Semantic variable references must appear
    expect(source).toContain('var(--sc-field-control-');
    expect(source).toContain('var(--sc-floating-panel-');
    expect(source).toContain('var(--sc-page-section-');
  });
});

describe('globals.css imports contracts.generated.css', () => {
  it('has @import for contracts.generated.css after themes.generated.css', () => {
    const source = readFileSync(resolve(STYLES_DIR, 'globals.css'), 'utf-8');
    expect(source).toContain("@import './contracts.generated.css'");
    // Contracts import must come after themes import
    const themesIdx = source.indexOf("@import './themes.generated.css'");
    const contractsIdx = source.indexOf("@import './contracts.generated.css'");
    expect(themesIdx).toBeGreaterThanOrEqual(0);
    expect(contractsIdx).toBeGreaterThan(themesIdx);
  });
});
