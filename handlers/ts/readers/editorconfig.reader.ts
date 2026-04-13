// ManifestReader adapter: .editorconfig.
//
// Reads a .editorconfig file and translates each section (e.g. `[*.ts]`,
// `[*.{js,jsx}]`) into Format provider option *overlays* — not full provider
// registrations. Editorconfig doesn't say which formatter to use; it only
// specifies formatting preferences (indent, line endings, charset, trailing
// whitespace, final newline). The ProviderManifest aggregator (VPR-01 / VPR-14)
// is expected to honor the `overlay: true` marker in options and merge these
// option deltas onto whatever Format provider is registered for the matching
// slot.
//
// Slot derivation: each section's glob pattern is mapped to a slot name by
// taking the first file-extension token from the glob (e.g. `*.ts` →
// "typescript", `*.{js,jsx}` → "javascript"). Sections that don't resolve to a
// known slot are emitted with the raw glob as the slot so downstream consumers
// can still match them.
//
// Self-registers with ManifestReader on import so KernelBoot syncs need only
// dispatch ManifestReader/register. The reader is also placed into the
// ProviderManifest dispatch table so ProviderManifest/load can use it.
//
// See docs/plans/virtual-provider-registry-prd.md §2 (editorconfig row) and
// VPR-06.

import { readFileSync } from 'node:fs';
// The editorconfig package ships an INI parser we can use directly on the
// file contents. `parseString` returns an array of [section, props] pairs.
import { parseString as parseEditorconfigString } from 'editorconfig';

import { registerReader as registerManifestReaderFn } from '../app/manifest-reader.handler.ts';
import {
  registerManifestReader as registerProviderManifestReader,
} from '../app/provider-manifest.handler.ts';

import type { NormalizedEntry } from './clef-yaml.reader.ts';

export const EDITORCONFIG_READER_ID = 'editorconfig';
export const EDITORCONFIG_FORMATS = ['.editorconfig'];
export const EDITORCONFIG_PRIORITY = 70;

// Mapping from common file-extension tokens to canonical slot names used
// elsewhere in the provider registry. Keep this table small and explicit —
// unrecognized extensions fall through as the raw extension string.
const EXT_TO_SLOT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  rs: 'rust',
  go: 'go',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  sol: 'solidity',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  sql: 'sql',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
};

type EditorconfigProps = Record<string, string | number | boolean | undefined>;

/** Expand an editorconfig glob into zero or more (extension, slot) pairs. */
function globToSlots(glob: string): string[] {
  if (!glob || glob === '*') return ['*'];
  // Expand `{a,b,c}` alternations into individual patterns first.
  const alternations: string[] = [];
  const braceMatch = glob.match(/^(.*)\{([^}]+)\}(.*)$/);
  if (braceMatch) {
    const [, prefix, inner, suffix] = braceMatch;
    for (const choice of inner.split(',')) {
      alternations.push(`${prefix}${choice.trim()}${suffix}`);
    }
  } else {
    alternations.push(glob);
  }

  const slots: string[] = [];
  for (const pattern of alternations) {
    // Take the trailing extension after the last '.'.
    const dot = pattern.lastIndexOf('.');
    if (dot < 0) {
      slots.push(pattern);
      continue;
    }
    const ext = pattern.slice(dot + 1).toLowerCase();
    slots.push(EXT_TO_SLOT[ext] ?? ext);
  }
  // Dedupe while preserving order.
  return Array.from(new Set(slots));
}

/** Translate a raw editorconfig section's properties into an overlay options object. */
export function propsToOverlay(
  props: EditorconfigProps,
): Record<string, unknown> {
  const overlay: Record<string, unknown> = { overlay: true };

  const indentStyle = props.indent_style;
  if (indentStyle === 'tab') {
    overlay.useTabs = true;
  } else if (indentStyle === 'space') {
    overlay.useTabs = false;
  }

  const indentSize = props.indent_size;
  if (indentSize != null && indentSize !== 'tab') {
    const n = Number(indentSize);
    if (Number.isFinite(n)) overlay.tabWidth = n;
  } else if (indentSize === 'tab' && props.tab_width != null) {
    const n = Number(props.tab_width);
    if (Number.isFinite(n)) overlay.tabWidth = n;
  }

  const endOfLine = props.end_of_line;
  if (typeof endOfLine === 'string') {
    // editorconfig uses "lf" | "crlf" | "cr"; pass through verbatim since
    // prettier and most formatters accept the same strings.
    overlay.endOfLine = endOfLine;
  }

  const charset = props.charset;
  if (typeof charset === 'string') {
    overlay.encoding = charset;
  }

  const trimTrailing = props.trim_trailing_whitespace;
  if (typeof trimTrailing === 'boolean') {
    overlay.trimTrailingWhitespace = trimTrailing;
  } else if (trimTrailing === 'true' || trimTrailing === 'false') {
    overlay.trimTrailingWhitespace = trimTrailing === 'true';
  }

  const insertFinalNewline = props.insert_final_newline;
  if (typeof insertFinalNewline === 'boolean') {
    overlay.insertFinalNewline = insertFinalNewline;
  } else if (insertFinalNewline === 'true' || insertFinalNewline === 'false') {
    overlay.insertFinalNewline = insertFinalNewline === 'true';
  }

  const maxLineLength = props.max_line_length;
  if (maxLineLength != null && maxLineLength !== 'off') {
    const n = Number(maxLineLength);
    if (Number.isFinite(n)) overlay.printWidth = n;
  }

  return overlay;
}

function encodeOptions(options: unknown): string {
  if (options == null) return '';
  try {
    return Buffer.from(JSON.stringify(options)).toString('base64');
  } catch {
    return '';
  }
}

/**
 * Transform a parsed editorconfig section list into a flat list of normalized
 * entries. Pure: no I/O.
 *
 * Each section emits one entry per expanded slot with `kind: "format"`,
 * `provider: "editorconfig"` (acts as an overlay marker), and an options
 * object carrying the overlay data with `overlay: true`.
 */
export function normalizeEditorconfigSections(
  sections: Array<[string, EditorconfigProps]>,
  sourcePath: string,
  priority: number,
): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  // Start with root (unnamed) section which carries defaults. Many
  // editorconfig files put `root = true` and global defaults before any
  // `[glob]` section; we fold those defaults into every glob section.
  let defaults: EditorconfigProps = {};
  for (const [section, props] of sections) {
    if (!section) {
      defaults = { ...defaults, ...props };
      continue;
    }

    const merged: EditorconfigProps = { ...defaults, ...props };
    const overlay = propsToOverlay(merged);
    // Skip sections that contribute nothing beyond the `overlay: true` marker.
    if (Object.keys(overlay).length <= 1) continue;

    const options = encodeOptions(overlay);
    for (const slot of globToSlots(section)) {
      out.push({
        kind: 'format',
        slot,
        provider: 'editorconfig',
        options,
        extensions: [],
        priority,
        sourcePath,
      });
    }
  }
  return out;
}

/** Parse raw .editorconfig file contents into [section, props] pairs. */
function parseSections(text: string): Array<[string, EditorconfigProps]> {
  const parsed = parseEditorconfigString(text) as Array<
    [string, EditorconfigProps]
  >;
  return parsed;
}

/**
 * Read and parse a .editorconfig file, returning the entries as JSON-encoded
 * bytes (base64-wrapped UTF-8 JSON) suitable for the ManifestReader/read
 * ok(entries: Bytes) variant.
 */
export function readEditorconfig(path: string): string {
  if (!path) {
    throw new Error('path is required');
  }
  const text = readFileSync(path, 'utf8');
  const sections = parseSections(text);
  const entries = normalizeEditorconfigSections(
    sections,
    path,
    EDITORCONFIG_PRIORITY,
  );
  return Buffer.from(JSON.stringify({ entries })).toString('base64');
}

/** Reader function variant used by ProviderManifest/load dispatch. */
export function readEditorconfigEntries(path: string): NormalizedEntry[] {
  const text = readFileSync(path, 'utf8');
  const sections = parseSections(text);
  return normalizeEditorconfigSections(
    sections,
    path,
    EDITORCONFIG_PRIORITY,
  );
}

// ---------------------------------------------------------------------------
// Self-registration on import
// ---------------------------------------------------------------------------

registerManifestReaderFn(EDITORCONFIG_READER_ID, readEditorconfig);
registerProviderManifestReader(
  EDITORCONFIG_READER_ID,
  EDITORCONFIG_FORMATS,
  EDITORCONFIG_PRIORITY,
  readEditorconfigEntries,
);
