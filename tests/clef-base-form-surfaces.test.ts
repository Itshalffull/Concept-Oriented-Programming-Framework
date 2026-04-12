import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const SOURCES = {
  fieldWidget: path.join(ROOT, 'clef-base/app/components/widgets/FieldWidget.tsx'),
  createForm: path.join(ROOT, 'clef-base/app/components/widgets/CreateForm.tsx'),
  formMode: path.join(ROOT, 'clef-base/app/components/widgets/FormMode.tsx'),
  fieldPlacementPanel: path.join(ROOT, 'clef-base/app/components/widgets/FieldPlacementPanel.tsx'),
  globals: path.join(ROOT, 'clef-base/app/styles/globals.css'),
};

describe('clef-base MAG-651 form and field surfaces', () => {
  it('opt into the MAG-651 shared form surface namespace', () => {
    expect(fs.readFileSync(SOURCES.fieldWidget, 'utf8')).toContain('data-surface="mag651-field-control"');
    expect(fs.readFileSync(SOURCES.createForm, 'utf8')).toContain('data-surface="mag651-form-overlay"');
    expect(fs.readFileSync(SOURCES.createForm, 'utf8')).toContain('data-surface="mag651-field-panel"');
    expect(fs.readFileSync(SOURCES.formMode, 'utf8')).toContain('data-part="field-panel-section"');
    expect(fs.readFileSync(SOURCES.fieldPlacementPanel, 'utf8')).toContain('data-surface="mag651-field-panel"');
  });

  it('centralizes the panel, control, helper, chip, and toggle chrome in globals.css', () => {
    const globals = fs.readFileSync(SOURCES.globals, 'utf8');
    expect(globals).toContain('MAG-651 Form and Field Surfaces');
    expect(globals).toContain('[data-surface="mag651-field-control"]');
    expect(globals).toContain('[data-surface="mag651-field-panel"]');
    expect(globals).toContain('[data-part="field-chip"]');
    expect(globals).toContain('[data-surface="mag651-toggle-track"]');
  });

  it('removes the old shared input helper constants from FieldWidget', () => {
    const fieldWidget = fs.readFileSync(SOURCES.fieldWidget, 'utf8');
    expect(fieldWidget).not.toContain('baseInputStyle');
    expect(fieldWidget).not.toContain('errorBorderStyle');
  });
});
