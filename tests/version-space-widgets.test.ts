import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseWidgetFile } from '../handlers/ts/framework/widget-spec-parser.js';

const WIDGET_DIR = 'clef-base/widgets';

const WIDGETS = [
  'context-breadcrumb',
  'context-badge',
  'context-bar',
  'diff-inline',
  'diff-side-by-side',
  'diff-unified',
  'override-dot',
];

describe('Version Space Widgets (Section 5.10)', () => {
  describe('widget file parsing', () => {
    for (const widgetName of WIDGETS) {
      it(`parses ${widgetName}.widget without errors`, () => {
        const source = readFileSync(`${WIDGET_DIR}/${widgetName}.widget`, 'utf-8');
        const manifest = parseWidgetFile(source);
        expect(manifest.name).toBe(widgetName);
        expect(manifest.purpose).toBeTruthy();
        expect(manifest.anatomy.length).toBeGreaterThan(0);
      });
    }
  });

  describe('context-stack interactor widgets', () => {
    it('context-breadcrumb serves context-stack on desktop/tablet', () => {
      const source = readFileSync(`${WIDGET_DIR}/context-breadcrumb.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      expect(manifest.name).toBe('context-breadcrumb');
      expect(manifest.affordance).toBeDefined();
      expect(manifest.affordance!.serves).toBe('context-stack');
    });

    it('context-badge serves context-stack on mobile/watch', () => {
      const source = readFileSync(`${WIDGET_DIR}/context-badge.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      expect(manifest.name).toBe('context-badge');
      expect(manifest.affordance).toBeDefined();
      expect(manifest.affordance!.serves).toBe('context-stack');
    });

    it('context-bar serves context-stack in shell-chrome with highest specificity', () => {
      const source = readFileSync(`${WIDGET_DIR}/context-bar.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      expect(manifest.name).toBe('context-bar');
      expect(manifest.affordance).toBeDefined();
      expect(manifest.affordance!.serves).toBe('context-stack');
      expect(manifest.affordance!.specificity).toBe(15);
    });
  });

  describe('diff-view interactor widgets', () => {
    it('diff-inline serves diff-view for compact/line granularity', () => {
      const source = readFileSync(`${WIDGET_DIR}/diff-inline.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      expect(manifest.name).toBe('diff-inline');
      expect(manifest.affordance).toBeDefined();
      expect(manifest.affordance!.serves).toBe('diff-view');
      expect(manifest.affordance!.specificity).toBe(8);
    });

    it('diff-side-by-side serves diff-view for wide/field granularity', () => {
      const source = readFileSync(`${WIDGET_DIR}/diff-side-by-side.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      expect(manifest.name).toBe('diff-side-by-side');
      expect(manifest.affordance).toBeDefined();
      expect(manifest.affordance!.serves).toBe('diff-view');
      expect(manifest.affordance!.specificity).toBe(12);
    });

    it('diff-unified serves diff-view for character granularity', () => {
      const source = readFileSync(`${WIDGET_DIR}/diff-unified.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      expect(manifest.name).toBe('diff-unified');
      expect(manifest.affordance).toBeDefined();
      expect(manifest.affordance!.serves).toBe('diff-view');
      expect(manifest.affordance!.specificity).toBe(10);
    });
  });

  describe('overlay-indicator interactor widgets', () => {
    it('override-dot serves overlay-indicator', () => {
      const source = readFileSync(`${WIDGET_DIR}/override-dot.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      expect(manifest.name).toBe('override-dot');
      expect(manifest.affordance).toBeDefined();
      expect(manifest.affordance!.serves).toBe('overlay-indicator');
    });
  });

  describe('widget anatomy completeness', () => {
    it('context-breadcrumb has bar, chip, chipLabel, chipDismiss, dropdownTrigger parts', () => {
      const source = readFileSync(`${WIDGET_DIR}/context-breadcrumb.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      const partNames = manifest.anatomy.map(p => p.name);
      expect(partNames).toContain('bar');
      expect(partNames).toContain('chip');
      expect(partNames).toContain('chipLabel');
      expect(partNames).toContain('chipDismiss');
      expect(partNames).toContain('dropdownTrigger');
    });

    it('diff-side-by-side has sourceColumn, targetColumn, ancestorColumn parts', () => {
      const source = readFileSync(`${WIDGET_DIR}/diff-side-by-side.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      const partNames = manifest.anatomy.map(p => p.name);
      expect(partNames).toContain('sourceColumn');
      expect(partNames).toContain('targetColumn');
      expect(partNames).toContain('ancestorColumn');
    });

    it('override-dot has dot, tooltip, decoratedContent parts', () => {
      const source = readFileSync(`${WIDGET_DIR}/override-dot.widget`, 'utf-8');
      const manifest = parseWidgetFile(source);
      const partNames = manifest.anatomy.map(p => p.name);
      expect(partNames).toContain('dot');
      expect(partNames).toContain('tooltip');
      expect(partNames).toContain('decoratedContent');
    });
  });

  describe('spec conformance: affordance specificity ordering (Section 5.10.3)', () => {
    it('context-stack widgets have correct specificity: bar(15) > breadcrumb(10) = badge(10)', () => {
      const bar = parseWidgetFile(readFileSync(`${WIDGET_DIR}/context-bar.widget`, 'utf-8'));
      const breadcrumb = parseWidgetFile(readFileSync(`${WIDGET_DIR}/context-breadcrumb.widget`, 'utf-8'));
      const badge = parseWidgetFile(readFileSync(`${WIDGET_DIR}/context-badge.widget`, 'utf-8'));

      expect(bar.affordance!.specificity).toBe(15);
      expect(breadcrumb.affordance!.specificity).toBe(10);
      expect(badge.affordance!.specificity).toBe(10);
    });

    it('diff-view widgets have correct specificity: side-by-side(12) > unified(10) > inline(8)', () => {
      const sideBySide = parseWidgetFile(readFileSync(`${WIDGET_DIR}/diff-side-by-side.widget`, 'utf-8'));
      const unified = parseWidgetFile(readFileSync(`${WIDGET_DIR}/diff-unified.widget`, 'utf-8'));
      const inline = parseWidgetFile(readFileSync(`${WIDGET_DIR}/diff-inline.widget`, 'utf-8'));

      expect(sideBySide.affordance!.specificity).toBe(12);
      expect(unified.affordance!.specificity).toBe(10);
      expect(inline.affordance!.specificity).toBe(8);
    });
  });
});
