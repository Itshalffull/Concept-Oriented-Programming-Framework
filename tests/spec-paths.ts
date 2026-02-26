// ============================================================
// Shared Spec Path Resolution
//
// Maps concept names to their spec file locations. Tag and
// Comment were superseded by richer kit versions; Migration
// and Telemetry by deploy kit versions. This helper ensures
// all tests reference the correct files.
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const SPECS_DIR = resolve(ROOT, 'specs');
const REPERTOIRE_DIR = resolve(ROOT, 'repertoire');

/** Concepts whose specs moved from specs/ to repertoire/ */
const RELOCATED_SPECS: Record<string, { dir: string; file: string }> = {
  // specs/app → kits
  tag:       { dir: resolve(REPERTOIRE_DIR, 'classification'), file: 'tag.concept' },
  comment:   { dir: resolve(REPERTOIRE_DIR, 'content'), file: 'comment.concept' },
  // specs/framework → kits
  migration: { dir: resolve(REPERTOIRE_DIR, 'deploy', 'concepts'), file: 'migration.concept' },
  telemetry: { dir: resolve(REPERTOIRE_DIR, 'deploy', 'concepts'), file: 'telemetry.concept' },
};

/**
 * Resolve a concept spec path. If the concept was relocated to a repertoire,
 * returns the kit path; otherwise returns the original specs/ path.
 */
export function resolveSpecPath(category: string, name: string): string {
  const relocated = RELOCATED_SPECS[name];
  if (relocated) {
    return resolve(relocated.dir, relocated.file);
  }
  return resolve(SPECS_DIR, category, `${name}.concept`);
}

/**
 * Read a concept spec file. Handles relocated specs transparently.
 */
export function readSpec(category: string, name: string): string {
  return readFileSync(resolveSpecPath(category, name), 'utf-8');
}
