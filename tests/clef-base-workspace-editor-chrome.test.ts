import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const SOURCES = {
  workspaceSwitcher: path.join(ROOT, 'clef-base/app/components/widgets/WorkspaceSwitcher.tsx'),
  paneHeader: path.join(ROOT, 'clef-base/app/components/widgets/PaneHeader.tsx'),
  inlineEdit: path.join(ROOT, 'clef-base/app/components/widgets/InlineEdit.tsx'),
  inlineCellEditor: path.join(ROOT, 'clef-base/app/components/widgets/InlineCellEditor.tsx'),
  globals: path.join(ROOT, 'clef-base/app/styles/globals.css'),
};

describe('clef-base workspace and editor chrome', () => {
  it('routes shared workspace and pane chrome through MAG-654 data hooks', () => {
    const combined = [
      fs.readFileSync(SOURCES.workspaceSwitcher, 'utf8'),
      fs.readFileSync(SOURCES.paneHeader, 'utf8'),
    ].join('\n');

    expect(combined).toContain('data-part="workspace-switcher"');
    expect(combined).toContain('data-part="workspace-switcher-trigger"');
    expect(combined).toContain('data-part="workspace-switcher-action-button"');
    expect(combined).toContain('data-part="workspace-switcher-confirm-dialog"');
    expect(combined).toContain('data-part="pane-header"');
    expect(combined).toContain('data-part="pane-header-button"');
    expect(combined).toContain('data-variant="destructive"');
  });

  it('uses inline edit and cell editor surface contracts instead of ad hoc chrome', () => {
    const combined = [
      fs.readFileSync(SOURCES.inlineEdit, 'utf8'),
      fs.readFileSync(SOURCES.inlineCellEditor, 'utf8'),
    ].join('\n');

    expect(combined).toContain('data-part="inline-edit-input"');
    expect(combined).toContain('data-part="inline-edit-trigger"');
    expect(combined).toContain('data-part="inline-toggle-track"');
    expect(combined).toContain('data-part="inline-cell-editor"');
    expect(combined).toContain('data-part="cell-input"');
    expect(combined).toContain('data-part="cell-error-message"');
    expect(combined).toContain('data-part="inline-cell-toggle"');
  });

  it('keeps the MAG-654 chrome rules isolated in globals.css', () => {
    const css = fs.readFileSync(SOURCES.globals, 'utf8');

    expect(css).toContain('/* ─── MAG-654 Workspace & Editor Chrome ─── */');
    expect(css).toContain('[data-part="workspace-switcher"]');
    expect(css).toContain('[data-part="pane-header"]');
    expect(css).toContain('[data-part="inline-edit-input"]');
    expect(css).toContain('[data-part="inline-cell-editor"]');
    expect(css).toContain('[data-part="cell-saving-indicator"]');
  });
});
