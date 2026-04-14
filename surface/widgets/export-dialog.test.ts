import { parseWidgetFile } from './../../handlers/ts/framework/widget-spec-parser';
import { readFileSync } from 'fs';
import { test, expect } from 'vitest';

test('export-dialog widget parses correctly', () => {
  const source = readFileSync('surface/widgets/export-dialog.widget', 'utf-8');
  const manifest = parseWidgetFile(source);
  const keys = Object.keys(manifest);
  console.log('All keys:', keys.join(', '));
  expect(manifest.name).toBe('export-dialog');
  expect(manifest.anatomy.length).toBeGreaterThan(10);
  expect(manifest.states.length).toBeGreaterThan(0);
  expect(manifest.props.length).toBeGreaterThan(0);
  expect(manifest.accessibility?.role).toBeTruthy();
});
