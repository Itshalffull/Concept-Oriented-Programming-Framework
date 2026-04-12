import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const SOURCES = {
  fields: path.join(ROOT, 'clef-base/app/components/widgets/FieldsPopover.tsx'),
  group: path.join(ROOT, 'clef-base/app/components/widgets/GroupPopover.tsx'),
  fieldPicker: path.join(ROOT, 'clef-base/app/components/widgets/FieldPickerDropdown.tsx'),
  displayAs: path.join(ROOT, 'clef-base/app/components/widgets/DisplayAsPicker.tsx'),
  globals: path.join(ROOT, 'clef-base/app/styles/globals.css'),
};

describe('clef-base shared floating surfaces', () => {
  it('opt into a shared floating surface contract', () => {
    expect(fs.readFileSync(SOURCES.fields, 'utf8')).toContain('data-surface="floating-panel"');
    expect(fs.readFileSync(SOURCES.group, 'utf8')).toContain('data-surface="floating-panel"');
    expect(fs.readFileSync(SOURCES.fieldPicker, 'utf8')).toContain('data-surface="floating-menu"');
    expect(fs.readFileSync(SOURCES.fieldPicker, 'utf8')).toContain('data-surface="floating-trigger"');
    expect(fs.readFileSync(SOURCES.displayAs, 'utf8')).toContain('data-surface="floating-menu"');
    expect(fs.readFileSync(SOURCES.displayAs, 'utf8')).toContain('data-surface="floating-trigger"');
  });

  it('centralizes the shared panel and menu chrome in globals.css', () => {
    const globals = fs.readFileSync(SOURCES.globals, 'utf8');
    expect(globals).toContain('[data-surface="floating-panel"]');
    expect(globals).toContain('[data-surface="floating-menu"]');
    expect(globals).toContain('[data-surface="floating-trigger"]');
    expect(globals).toContain('[data-surface="floating-action-button"]');
    expect(globals).toContain('[data-surface="floating-icon-button"]');
  });

  it('does not keep raw shadow literals in the shared floating surfaces', () => {
    const combined = [
      fs.readFileSync(SOURCES.fields, 'utf8'),
      fs.readFileSync(SOURCES.group, 'utf8'),
      fs.readFileSync(SOURCES.fieldPicker, 'utf8'),
      fs.readFileSync(SOURCES.displayAs, 'utf8'),
    ].join('\n');

    expect(combined).not.toContain('boxShadow: \'0 8px 24px rgba(0,0,0,0.18)\'');
    expect(combined).not.toContain('boxShadow: \'0 4px 12px rgba(0,0,0,0.15)\'');
    expect(combined).not.toContain('var(--elevation-2, 0 2px 8px rgba(0,0,0,0.15))');
  });
});
