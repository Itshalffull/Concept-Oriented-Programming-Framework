// ManifestReader adapter: Clef-native YAML provider manifest.
//
// Parses .clef/providers.yaml / .clef/providers.yml files following the
// schema documented in docs/plans/virtual-provider-registry-prd.md §2:
//
//   parse:              [ { slot, provider, options?, extensions? } ... ]
//   highlight:          [ ... ]
//   format:             [ ... ]
//   content-serializer: [ ... ]
//
// Each section also supports slot-group + languages fan-out:
//   - slot-group: <name>
//     provider: <name>
//     languages: [ts, js, rust, ...]
// which expands into one normalized entry per language (slot = language).
//
// Self-registers with ManifestReader on import so KernelBoot syncs need only
// dispatch ManifestReader/register. The reader is also placed into the
// ProviderManifest dispatch table so ProviderManifest/load can use it.
//
// See docs/plans/virtual-provider-registry-prd.md §2 and VPR-04.

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

import { registerReader as registerManifestReaderFn } from '../app/manifest-reader.handler.ts';
import {
  registerManifestReader as registerProviderManifestReader,
} from '../app/provider-manifest.handler.ts';

/** Normalized provider entry shape — mirrors provider-manifest.handler.ts. */
export interface NormalizedEntry {
  kind: 'parse' | 'format' | 'highlight' | 'content-serializer';
  slot: string;
  provider: string;
  options: string;
  extensions: string[];
  priority: number;
  sourcePath: string;
}

export const CLEF_YAML_READER_ID = 'clef-yaml';
export const CLEF_YAML_FORMATS = ['.clef/providers.yaml', '.clef/providers.yml'];
export const CLEF_YAML_PRIORITY = 100;

const KINDS: NormalizedEntry['kind'][] = [
  'parse',
  'highlight',
  'format',
  'content-serializer',
];

type RawEntry = {
  slot?: unknown;
  'slot-group'?: unknown;
  provider?: unknown;
  options?: unknown;
  extensions?: unknown;
  languages?: unknown;
};

function encodeOptions(options: unknown): string {
  if (options == null) return '';
  try {
    return Buffer.from(JSON.stringify(options)).toString('base64');
  } catch {
    return '';
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

/**
 * Transform the parsed YAML/JSON document root into a flat list of
 * normalized entries. Pure: no I/O.
 */
export function normalizeClefDocument(
  doc: unknown,
  sourcePath: string,
  priority: number,
): NormalizedEntry[] {
  if (doc == null || typeof doc !== 'object') return [];
  const root = doc as Record<string, unknown>;
  const out: NormalizedEntry[] = [];

  for (const kind of KINDS) {
    const section = root[kind];
    if (!Array.isArray(section)) continue;

    for (const rawUnknown of section) {
      if (rawUnknown == null || typeof rawUnknown !== 'object') continue;
      const raw = rawUnknown as RawEntry;

      const provider = raw.provider != null ? String(raw.provider) : '';
      if (!provider) continue;

      const options = encodeOptions(raw.options);
      const extensions = toStringList(raw.extensions);

      const slotGroup = raw['slot-group'];
      if (slotGroup != null) {
        const languages = toStringList(raw.languages);
        for (const language of languages) {
          if (!language) continue;
          out.push({
            kind,
            slot: language,
            provider,
            options,
            extensions,
            priority,
            sourcePath,
          });
        }
        continue;
      }

      const slot = raw.slot != null ? String(raw.slot) : '';
      if (!slot) continue;

      out.push({
        kind,
        slot,
        provider,
        options,
        extensions,
        priority,
        sourcePath,
      });
    }
  }

  return out;
}

/**
 * Read and parse a .clef/providers.yaml file, returning the entries as
 * JSON-encoded bytes (base64-wrapped UTF-8 JSON) suitable for the
 * ManifestReader/read ok(entries: Bytes) variant.
 */
export function readClefYaml(path: string): string {
  if (!path) {
    throw new Error('path is required');
  }
  const text = readFileSync(path, 'utf8');
  const doc = parseYaml(text);
  const entries = normalizeClefDocument(doc, path, CLEF_YAML_PRIORITY);
  return Buffer.from(JSON.stringify({ entries })).toString('base64');
}

/** Reader function variant used by ProviderManifest/load dispatch. */
export function readClefYamlEntries(path: string): NormalizedEntry[] {
  const text = readFileSync(path, 'utf8');
  const doc = parseYaml(text);
  return normalizeClefDocument(doc, path, CLEF_YAML_PRIORITY);
}

// ---------------------------------------------------------------------------
// Self-registration on import
// ---------------------------------------------------------------------------

registerManifestReaderFn(CLEF_YAML_READER_ID, readClefYaml);
registerProviderManifestReader(
  CLEF_YAML_READER_ID,
  CLEF_YAML_FORMATS,
  CLEF_YAML_PRIORITY,
  readClefYamlEntries,
);
