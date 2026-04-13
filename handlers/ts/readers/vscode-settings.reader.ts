// ManifestReader adapter: VSCode workspace settings.
//
// Parses `.vscode/settings.json` and extracts language-specific sections of
// the form `"[<lang>]": { ... }` — e.g. `"[typescript]"`, `"[rust]"`. Each
// language section becomes a Format option-overlay entry on the matching
// slot, following the same overlay shape as the editorconfig reader (VPR-06):
// a normalized entry whose `options` carries the raw VSCode settings object
// so downstream ProviderManifest dedup/overlay semantics apply (later-priority
// reader wins on slot collision).
//
// Because VSCode settings don't name a provider (they're editor overlays, not
// provider choices), entries emit `provider: ""` with `overlay: true` hint in
// the options payload. ProviderManifest merges these into existing Format
// entries rather than registering a standalone provider.
//
// Priority: 60 — lower than explicit .clef manifests (100) and prettier-config
// (~80) so users can override; higher than the extension scanner (50) so
// workspace settings beat contributed defaults.
//
// See docs/plans/virtual-provider-registry-prd.md §1, VPR-07.

import { readFileSync } from 'node:fs';

import { registerReader as registerManifestReaderFn } from '../app/manifest-reader.handler.ts';
import {
  registerManifestReader as registerProviderManifestReader,
} from '../app/provider-manifest.handler.ts';
import type { NormalizedEntry } from './clef-yaml.reader.ts';

export const VSCODE_SETTINGS_READER_ID = 'vscode-settings';
export const VSCODE_SETTINGS_FORMATS = ['.vscode/settings.json'];
export const VSCODE_SETTINGS_PRIORITY = 60;

const LANG_SECTION_RE = /^\[([^\]]+)\]$/;

function encodeOptions(options: unknown): string {
  if (options == null) return '';
  try {
    return Buffer.from(JSON.stringify(options)).toString('base64');
  } catch {
    return '';
  }
}

/**
 * Strip `//` and `/* */` comments from JSONC-style VSCode settings. VSCode
 * tolerates comments in settings.json; we do the same here.
 */
function stripJsonComments(text: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  let stringQuote = '';
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === stringQuote) {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Transform a parsed VSCode settings document into a flat list of Format
 * overlay entries — one per `[<lang>]` section. Pure: no I/O.
 */
export function normalizeVscodeSettings(
  doc: unknown,
  sourcePath: string,
  priority: number,
): NormalizedEntry[] {
  if (doc == null || typeof doc !== 'object') return [];
  const root = doc as Record<string, unknown>;
  const out: NormalizedEntry[] = [];

  for (const key of Object.keys(root)) {
    const m = LANG_SECTION_RE.exec(key);
    if (!m) continue;
    const slot = m[1];
    if (!slot) continue;
    const payload = root[key];
    if (payload == null || typeof payload !== 'object') continue;

    out.push({
      kind: 'format',
      slot,
      provider: '',
      options: encodeOptions({ overlay: true, settings: payload }),
      extensions: [],
      priority,
      sourcePath,
    });
  }

  return out;
}

/**
 * Read and parse a `.vscode/settings.json` file, returning entries as
 * JSON-encoded bytes suitable for ManifestReader/read ok(entries: Bytes).
 */
export function readVscodeSettings(path: string): string {
  if (!path) {
    throw new Error('path is required');
  }
  const text = readFileSync(path, 'utf8');
  let doc: unknown;
  try {
    doc = JSON.parse(stripJsonComments(text));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid JSON in ${path}: ${message}`);
  }
  const entries = normalizeVscodeSettings(doc, path, VSCODE_SETTINGS_PRIORITY);
  return Buffer.from(JSON.stringify({ entries })).toString('base64');
}

/** Reader function variant used by ProviderManifest/load dispatch. */
export function readVscodeSettingsEntries(path: string): NormalizedEntry[] {
  const text = readFileSync(path, 'utf8');
  const doc = JSON.parse(stripJsonComments(text));
  return normalizeVscodeSettings(doc, path, VSCODE_SETTINGS_PRIORITY);
}

// ---------------------------------------------------------------------------
// Self-registration on import
// ---------------------------------------------------------------------------

registerManifestReaderFn(VSCODE_SETTINGS_READER_ID, readVscodeSettings);
registerProviderManifestReader(
  VSCODE_SETTINGS_READER_ID,
  VSCODE_SETTINGS_FORMATS,
  VSCODE_SETTINGS_PRIORITY,
  readVscodeSettingsEntries,
);
