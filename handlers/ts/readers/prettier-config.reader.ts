// ManifestReader adapter: Prettier configuration.
//
// Reads Prettier configuration from any of its supported locations using
// Prettier's own resolution semantics (`prettier.resolveConfigFile` +
// `prettier.resolveConfig`), which transparently handles:
//   - .prettierrc / .prettierrc.json / .prettierrc.yaml / .prettierrc.yml
//   - .prettierrc.js / .prettierrc.cjs / .prettierrc.mjs / .prettierrc.toml
//   - prettier.config.{js,cjs,mjs}
//   - `prettier` field in package.json
//
// Each resolved Prettier configuration is translated into normalized Format
// entries:
//
//   - The base config becomes a wildcard Format entry:
//       { kind: 'format', slot: '*', provider: 'prettier', options: <config> }
//   - Each entry in `overrides[]` fans out into one Format entry per
//     language slot matched by the override's `files` glob, using Prettier's
//     parser-to-language table (via `prettier.getSupportInfo()`). The override
//     `options` (merged with any explicit `parser`) become the entry options.
//
// Self-registers with ManifestReader on import and installs itself into the
// ProviderManifest dispatch table so ProviderManifest/load can consume it.
//
// See docs/plans/virtual-provider-registry-prd.md §2 and VPR-05.

import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import prettier from 'prettier';

import { registerReader as registerManifestReaderFn } from '../app/manifest-reader.handler.ts';
import {
  registerManifestReader as registerProviderManifestReader,
} from '../app/provider-manifest.handler.ts';
import type { NormalizedEntry } from './clef-yaml.reader.ts';

export const PRETTIER_CONFIG_READER_ID = 'prettier-config';
export const PRETTIER_CONFIG_FORMATS = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.toml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'package.json',
];
export const PRETTIER_CONFIG_PRIORITY = 80;

const PROVIDER_ID = 'prettier';

interface PrettierOverride {
  files: string | string[];
  excludeFiles?: string | string[];
  options?: Record<string, unknown>;
}

interface PrettierConfig {
  overrides?: PrettierOverride[];
  [key: string]: unknown;
}

function encodeOptions(options: unknown): string {
  if (options == null) return '';
  try {
    return Buffer.from(JSON.stringify(options)).toString('base64');
  } catch {
    return '';
  }
}

function splitBaseAndOverrides(config: PrettierConfig): {
  base: Record<string, unknown>;
  overrides: PrettierOverride[];
} {
  const { overrides, ...base } = config;
  return {
    base,
    overrides: Array.isArray(overrides) ? overrides : [],
  };
}

/**
 * Build the parser-to-language-slot table from Prettier's support info.
 * A "slot" is a canonical language identifier — we prefer the first
 * `vscodeLanguageIds` entry, falling back to a lower-cased `name`.
 */
async function buildParserToSlots(): Promise<Map<string, string[]>> {
  const info = await prettier.getSupportInfo();
  const table = new Map<string, string[]>();
  for (const lang of info.languages ?? []) {
    const slot =
      (Array.isArray(lang.vscodeLanguageIds) && lang.vscodeLanguageIds[0]) ||
      (typeof lang.name === 'string' ? lang.name.toLowerCase() : '');
    if (!slot) continue;
    for (const parser of lang.parsers ?? []) {
      const list = table.get(parser) ?? [];
      if (!list.includes(slot)) list.push(slot);
      table.set(parser, list);
    }
  }
  return table;
}

/**
 * Derive language slot identifiers from an override's `files` glob plus
 * its explicit `parser` (if any). Falls back to matching file extensions
 * against Prettier's language extension table.
 */
function overrideSlots(
  override: PrettierOverride,
  parserToSlots: Map<string, string[]>,
  extensionToSlots: Map<string, string[]>,
): string[] {
  const out = new Set<string>();

  const parser = override.options?.parser;
  if (typeof parser === 'string') {
    for (const slot of parserToSlots.get(parser) ?? []) out.add(slot);
  }

  const files = Array.isArray(override.files)
    ? override.files
    : typeof override.files === 'string'
      ? [override.files]
      : [];
  for (const pattern of files) {
    // Best-effort extension extraction: "*.ts", "**/*.{ts,tsx}", "foo.md"
    const braceMatch = pattern.match(/\.\{([^}]+)\}/);
    if (braceMatch) {
      for (const ext of braceMatch[1].split(',')) {
        const key = `.${ext.trim().replace(/^\./, '')}`;
        for (const slot of extensionToSlots.get(key) ?? []) out.add(slot);
      }
      continue;
    }
    const dotIdx = pattern.lastIndexOf('.');
    if (dotIdx >= 0) {
      const ext = pattern.slice(dotIdx);
      for (const slot of extensionToSlots.get(ext) ?? []) out.add(slot);
    }
  }

  return [...out];
}

async function buildExtensionToSlots(): Promise<Map<string, string[]>> {
  const info = await prettier.getSupportInfo();
  const table = new Map<string, string[]>();
  for (const lang of info.languages ?? []) {
    const slot =
      (Array.isArray(lang.vscodeLanguageIds) && lang.vscodeLanguageIds[0]) ||
      (typeof lang.name === 'string' ? lang.name.toLowerCase() : '');
    if (!slot) continue;
    for (const ext of lang.extensions ?? []) {
      const list = table.get(ext) ?? [];
      if (!list.includes(slot)) list.push(slot);
      table.set(ext, list);
    }
  }
  return table;
}

/**
 * Translate a resolved Prettier configuration into Format entries.
 * Pure: takes a config + sourcePath and returns the normalized list.
 */
export async function normalizePrettierConfig(
  config: PrettierConfig | null,
  sourcePath: string,
  priority: number,
): Promise<NormalizedEntry[]> {
  if (!config || typeof config !== 'object') return [];

  const { base, overrides } = splitBaseAndOverrides(config);
  const parserToSlots = await buildParserToSlots();
  const extensionToSlots = await buildExtensionToSlots();

  const out: NormalizedEntry[] = [];

  // Base config → wildcard Format entry.
  if (Object.keys(base).length > 0 || overrides.length === 0) {
    out.push({
      kind: 'format',
      slot: '*',
      provider: PROVIDER_ID,
      options: encodeOptions(base),
      extensions: [],
      priority,
      sourcePath,
    });
  }

  // overrides[] → one Format entry per matched language slot.
  for (const override of overrides) {
    if (!override || typeof override !== 'object') continue;
    const slots = overrideSlots(override, parserToSlots, extensionToSlots);
    const optionsPayload = {
      ...base,
      ...(override.options ?? {}),
    };
    const encoded = encodeOptions(optionsPayload);
    for (const slot of slots) {
      out.push({
        kind: 'format',
        slot,
        provider: PROVIDER_ID,
        options: encoded,
        extensions: [],
        priority,
        sourcePath,
      });
    }
  }

  return out;
}

/**
 * Resolve a Prettier configuration from `path` (which may be the actual
 * config file, or `package.json`, or any file for which Prettier should
 * walk upward looking for config). Returns the loaded config object or
 * null if none is found.
 */
async function resolvePrettierConfigAt(
  path: string,
): Promise<PrettierConfig | null> {
  const absolute = resolve(path);
  const name = basename(absolute);

  // If caller passed package.json, only honour it when it has a `prettier`
  // field; otherwise Prettier will still walk upward, which we don't want.
  if (name === 'package.json') {
    try {
      const pkgText = readFileSync(absolute, 'utf8');
      const pkg = JSON.parse(pkgText);
      const embedded = pkg?.prettier;
      if (embedded == null) return null;
      if (typeof embedded === 'string') {
        // `prettier: "some-shared-config"` — delegate to resolveConfig so
        // Prettier handles the shared-config resolution.
        return (await prettier.resolveConfig(absolute, {
          useCache: false,
        })) as PrettierConfig | null;
      }
      if (typeof embedded === 'object') return embedded as PrettierConfig;
      return null;
    } catch {
      return null;
    }
  }

  // For explicit rc/config files, point resolveConfig at them so it honours
  // the file's format (json/yaml/js/cjs/mjs/toml) without us reimplementing it.
  return (await prettier.resolveConfig(absolute, {
    config: absolute,
    useCache: false,
  })) as PrettierConfig | null;
}

/**
 * Read and parse a Prettier config file, returning the entries as
 * JSON-encoded bytes (base64-wrapped UTF-8 JSON) suitable for the
 * ManifestReader/read ok(entries: Bytes) variant.
 */
export async function readPrettierConfig(path: string): Promise<string> {
  if (!path) throw new Error('path is required');
  const config = await resolvePrettierConfigAt(path);
  const entries = await normalizePrettierConfig(
    config,
    path,
    PRETTIER_CONFIG_PRIORITY,
  );
  return Buffer.from(JSON.stringify({ entries })).toString('base64');
}

/** Reader function variant used by ProviderManifest/load dispatch. */
export async function readPrettierConfigEntries(
  path: string,
): Promise<NormalizedEntry[]> {
  const config = await resolvePrettierConfigAt(path);
  return normalizePrettierConfig(config, path, PRETTIER_CONFIG_PRIORITY);
}

// Silence unused-import warning for `dirname` when tree-shaken; reserved for
// future sibling-file resolution logic.
void dirname;

// ---------------------------------------------------------------------------
// Self-registration on import
// ---------------------------------------------------------------------------

registerManifestReaderFn(
  PRETTIER_CONFIG_READER_ID,
  readPrettierConfig as unknown as (path: string) => string,
);
registerProviderManifestReader(
  PRETTIER_CONFIG_READER_ID,
  PRETTIER_CONFIG_FORMATS,
  PRETTIER_CONFIG_PRIORITY,
  readPrettierConfigEntries as unknown as (path: string) => NormalizedEntry[],
);
