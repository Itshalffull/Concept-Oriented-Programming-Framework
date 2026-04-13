// ManifestReader adapter: Clef-native JSON provider manifest.
//
// Parses .clef/providers.json files using the same schema as the YAML variant
// (see clef-yaml.reader.ts and docs/plans/virtual-provider-registry-prd.md §2).
//
// Self-registers with ManifestReader and the ProviderManifest dispatch table
// on import. See VPR-04.

import { readFileSync } from 'node:fs';

import { registerReader as registerManifestReaderFn } from '../app/manifest-reader.handler.ts';
import {
  registerManifestReader as registerProviderManifestReader,
} from '../app/provider-manifest.handler.ts';
import {
  normalizeClefDocument,
  type NormalizedEntry,
} from './clef-yaml.reader.ts';

export const CLEF_JSON_READER_ID = 'clef-json';
export const CLEF_JSON_FORMATS = ['.clef/providers.json'];
export const CLEF_JSON_PRIORITY = 100;

/**
 * Read and parse a .clef/providers.json file, returning the entries as
 * JSON-encoded bytes (base64-wrapped UTF-8 JSON) suitable for the
 * ManifestReader/read ok(entries: Bytes) variant.
 */
export function readClefJson(path: string): string {
  if (!path) {
    throw new Error('path is required');
  }
  const text = readFileSync(path, 'utf8');
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid JSON in ${path}: ${message}`);
  }
  const entries = normalizeClefDocument(doc, path, CLEF_JSON_PRIORITY);
  return Buffer.from(JSON.stringify({ entries })).toString('base64');
}

/** Reader function variant used by ProviderManifest/load dispatch. */
export function readClefJsonEntries(path: string): NormalizedEntry[] {
  const text = readFileSync(path, 'utf8');
  const doc = JSON.parse(text);
  return normalizeClefDocument(doc, path, CLEF_JSON_PRIORITY);
}

// ---------------------------------------------------------------------------
// Self-registration on import
// ---------------------------------------------------------------------------

registerManifestReaderFn(CLEF_JSON_READER_ID, readClefJson);
registerProviderManifestReader(
  CLEF_JSON_READER_ID,
  CLEF_JSON_FORMATS,
  CLEF_JSON_PRIORITY,
  readClefJsonEntries,
);
