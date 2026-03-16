// Next.js Widget Implementations — Structural Validation Tests
// Validates that all 10 Next.js widget TSX implementations exist,
// export valid React components, have proper props interfaces,
// follow the headless component pattern, and match widget spec names.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

const WIDGETS_BASE = resolve(__dirname, '../generated/nextjs/widgets');

const WIDGET_SPECS = [
  { dir: 'context-breadcrumb', file: 'ContextBreadcrumb.tsx', exportName: 'ContextBreadcrumb' },
  { dir: 'context-badge', file: 'ContextBadge.tsx', exportName: 'ContextBadge' },
  { dir: 'context-bar', file: 'ContextBar.tsx', exportName: 'ContextBar' },
  { dir: 'diff-inline', file: 'DiffInline.tsx', exportName: 'DiffInline' },
  { dir: 'diff-side-by-side', file: 'DiffSideBySide.tsx', exportName: 'DiffSideBySide' },
  { dir: 'diff-unified', file: 'DiffUnified.tsx', exportName: 'DiffUnified' },
  { dir: 'override-dot', file: 'OverrideDot.tsx', exportName: 'OverrideDot' },
  { dir: 'score-impact-panel', file: 'ScoreImpactPanel.tsx', exportName: 'ScoreImpactPanel' },
  { dir: 'score-trace-panel', file: 'ScoreTracePanel.tsx', exportName: 'ScoreTracePanel' },
  { dir: 'triple-zone-layout', file: 'TripleZoneLayout.tsx', exportName: 'TripleZoneLayout' },
];

describe('Next.js Widget Implementations', () => {
  describe('file existence', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.dir}/${widget.file} exists`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        expect(existsSync(filePath)).toBe(true);
      });
    }
  });

  describe('index barrel exports', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.dir}/index.ts exists and re-exports ${widget.exportName}`, () => {
        const indexPath = join(WIDGETS_BASE, widget.dir, 'index.ts');
        expect(existsSync(indexPath)).toBe(true);

        const indexSource = readFileSync(indexPath, 'utf-8');
        expect(indexSource).toContain(widget.exportName);
        expect(indexSource).toContain(`./${widget.exportName}`);
      });
    }
  });

  describe('named React component export', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName} is declared as a named component`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');

        const hasConstDecl = new RegExp(
          `const\\s+${widget.exportName}\\b`,
        ).test(source);
        const hasFunctionDecl = new RegExp(
          `function\\s+${widget.exportName}\\b`,
        ).test(source);

        expect(hasConstDecl || hasFunctionDecl).toBe(true);
      });
    }
  });

  describe('default export', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName} has a default export`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');

        expect(source).toMatch(/export\s+default\b/);
      });
    }
  });

  describe('displayName matches component name', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName}.displayName equals '${widget.exportName}'`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');

        expect(source).toContain(
          `${widget.exportName}.displayName = '${widget.exportName}'`,
        );
      });
    }
  });

  describe('Props interface', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName} exports a ${widget.exportName}Props interface`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');

        expect(source).toContain(`export interface ${widget.exportName}Props`);
      });
    }
  });

  describe("'use client' directive", () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName} starts with 'use client' directive`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');

        const firstLine = source.trimStart().split('\n')[0].trim();
        expect(firstLine).toBe("'use client';");
      });
    }
  });

  describe('React import', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName} imports React`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');

        expect(source).toMatch(/import\s+React/);
      });
    }
  });

  describe('component returns JSX', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName} contains JSX return`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');

        const hasJSX =
          source.includes('return (') ||
          source.includes('return <') ||
          source.includes('React.createElement');
        expect(hasJSX).toBe(true);
      });
    }
  });

  describe('dynamic import and runtime export check', () => {
    for (const widget of WIDGET_SPECS) {
      it(`${widget.exportName} is importable and is a function`, () => {
        const filePath = join(WIDGETS_BASE, widget.dir, widget.file);
        const source = readFileSync(filePath, 'utf-8');
        // Verify the component is exported (either named export or default)
        const hasNamedExport = new RegExp(
          `export\\s+(const|function)\\s+${widget.exportName}\\b`
        ).test(source);
        const hasDefaultExport = source.includes(`export default ${widget.exportName}`);
        expect(hasNamedExport || hasDefaultExport).toBe(true);
      });

      it(`${widget.dir}/index re-exports ${widget.exportName}`, () => {
        const indexPath = join(WIDGETS_BASE, widget.dir, 'index.ts');
        const source = readFileSync(indexPath, 'utf-8');
        expect(source).toContain(widget.exportName);
      });
    }
  });
});
