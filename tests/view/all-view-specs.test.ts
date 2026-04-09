/**
 * Structural validation of all .view files.
 * Parses every .view file and validates: name, shell, features, purpose, invariants.
 * Does NOT run ViewAnalysis (requires seeded ViewShell data).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseViewFile, VALID_VIEW_FEATURES } from '../../handlers/ts/framework/view-spec-parser.js';

const VIEWS_DIR = path.resolve(__dirname, '../../specs/view/views');
const viewFiles = fs.readdirSync(VIEWS_DIR)
  .filter(f => f.endsWith('.view'))
  .sort();

describe('All .view files parse successfully', () => {
  it(`discovers ${viewFiles.length} .view files`, () => {
    expect(viewFiles.length).toBeGreaterThanOrEqual(66);
  });

  for (const file of viewFiles) {
    const viewName = file.replace('.view', '');

    describe(`${viewName}`, () => {
      const content = fs.readFileSync(path.join(VIEWS_DIR, file), 'utf-8');
      let spec: ReturnType<typeof parseViewFile>;

      it('parses without error', () => {
        spec = parseViewFile(content);
        expect(spec).toBeDefined();
        expect(spec.name).toBe(viewName);
      });

      it('has a shell reference', () => {
        spec = spec ?? parseViewFile(content);
        expect(spec.shell).toBeTruthy();
        expect(typeof spec.shell).toBe('string');
      });

      it('has a purpose block', () => {
        spec = spec ?? parseViewFile(content);
        expect(spec.purpose).toBeTruthy();
        expect(spec.purpose!.length).toBeGreaterThan(10);
      });

      it('has at least one invariant', () => {
        spec = spec ?? parseViewFile(content);
        expect(spec.invariants.length).toBeGreaterThan(0);
      });

      it('features are valid (if declared)', () => {
        spec = spec ?? parseViewFile(content);
        if (spec.features) {
          for (const f of spec.features) {
            expect(VALID_VIEW_FEATURES.has(f)).toBe(true);
          }
        }
      });
    });
  }
});
