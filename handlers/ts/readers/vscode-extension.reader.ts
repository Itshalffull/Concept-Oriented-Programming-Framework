// ManifestReader adapter: VSCode installed extensions.
//
// Scans `~/.vscode/extensions/` (user-global) and `<cwd>/.vscode/extensions/`
// (workspace-local) for installed VSCode extensions. For each extension's
// `package.json` with a `contributes` block, emits:
//
//   - `contributes.languages[]` → Parse + Highlight slot-registration hints.
//     Each language contributes its `id`, `aliases`, and `extensions` to a
//     slot-registration table that downstream Parse/Highlight concepts use
//     to resolve slot-by-extension lookups.
//
//   - `contributes.grammars[]` → Highlight entries with
//     `provider: "textmate"` and
//     `options: { grammarPath: <resolved path>, scopeName }`.
//
// The reader discovers extensions by directory scan; the `path` argument to
// the reader fn is used only as a provenance tag (typically the directory
// being scanned). Actual discovery walks both known extension roots.
//
// Priority: 50 — lower than both vscode-settings (60) and explicit Clef
// manifests, so users can override contributed grammars and language IDs.
//
// See docs/plans/virtual-provider-registry-prd.md §1, VPR-07.

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve as resolvePath, isAbsolute } from 'node:path';

import { registerReader as registerManifestReaderFn } from '../app/manifest-reader.handler.ts';
import {
  registerManifestReader as registerProviderManifestReader,
} from '../app/provider-manifest.handler.ts';
import type { NormalizedEntry } from './clef-yaml.reader.ts';

export const VSCODE_EXTENSION_READER_ID = 'vscode-extension';
export const VSCODE_EXTENSION_FORMATS = ['.vscode/extensions'];
export const VSCODE_EXTENSION_PRIORITY = 50;

interface VscodeLanguageContribution {
  id?: string;
  aliases?: string[];
  extensions?: string[];
}

interface VscodeGrammarContribution {
  language?: string;
  scopeName?: string;
  path?: string;
}

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
  return value.map((v) => String(v)).filter((v) => v.length > 0);
}

/**
 * Candidate roots where VSCode stores extensions. Workspace-local goes last
 * so its priority-equal entries appear later and win on slot collision.
 */
export function defaultExtensionRoots(cwd: string = process.cwd()): string[] {
  return [
    join(homedir(), '.vscode', 'extensions'),
    join(cwd, '.vscode', 'extensions'),
  ];
}

/**
 * Read an extension directory's `package.json`, returning null if missing
 * or unreadable. Kept separate from normalization for testability.
 */
export function readExtensionManifest(extDir: string): {
  doc: unknown;
  manifestPath: string;
} | null {
  const manifestPath = join(extDir, 'package.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const text = readFileSync(manifestPath, 'utf8');
    return { doc: JSON.parse(text), manifestPath };
  } catch {
    return null;
  }
}

/**
 * Transform one extension's parsed `package.json` into normalized entries.
 * Pure: no I/O beyond the `extDir` used to resolve grammar paths.
 */
export function normalizeExtensionManifest(
  doc: unknown,
  extDir: string,
  sourcePath: string,
  priority: number,
): NormalizedEntry[] {
  if (doc == null || typeof doc !== 'object') return [];
  const pkg = doc as Record<string, unknown>;
  const contributes = pkg.contributes;
  if (contributes == null || typeof contributes !== 'object') return [];
  const contrib = contributes as Record<string, unknown>;
  const out: NormalizedEntry[] = [];

  // contributes.languages → Parse + Highlight slot registrations.
  const langs = contrib.languages;
  if (Array.isArray(langs)) {
    for (const rawUnknown of langs) {
      if (rawUnknown == null || typeof rawUnknown !== 'object') continue;
      const raw = rawUnknown as VscodeLanguageContribution;
      const id = raw.id != null ? String(raw.id) : '';
      if (!id) continue;
      const aliases = toStringList(raw.aliases);
      const extensions = toStringList(raw.extensions);
      const opts = encodeOptions({
        languageId: id,
        aliases,
        extensions,
        hint: true,
      });
      out.push({
        kind: 'parse',
        slot: id,
        provider: '',
        options: opts,
        extensions,
        priority,
        sourcePath,
      });
      out.push({
        kind: 'highlight',
        slot: id,
        provider: '',
        options: opts,
        extensions,
        priority,
        sourcePath,
      });
    }
  }

  // contributes.grammars → Highlight textmate provider entries.
  const grammars = contrib.grammars;
  if (Array.isArray(grammars)) {
    for (const rawUnknown of grammars) {
      if (rawUnknown == null || typeof rawUnknown !== 'object') continue;
      const raw = rawUnknown as VscodeGrammarContribution;
      const slot = raw.language != null ? String(raw.language) : '';
      const scopeName = raw.scopeName != null ? String(raw.scopeName) : '';
      const grammarRel = raw.path != null ? String(raw.path) : '';
      if (!slot || !grammarRel) continue;
      const grammarPath = isAbsolute(grammarRel)
        ? grammarRel
        : resolvePath(extDir, grammarRel);
      out.push({
        kind: 'highlight',
        slot,
        provider: 'textmate',
        options: encodeOptions({ grammarPath, scopeName }),
        extensions: [],
        priority,
        sourcePath,
      });
    }
  }

  return out;
}

/**
 * Scan one extension root, returning flat entries across every extension
 * directory beneath it. Missing root is a no-op (not an error).
 */
export function scanExtensionRoot(
  root: string,
  priority: number,
): NormalizedEntry[] {
  if (!existsSync(root)) return [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  const out: NormalizedEntry[] = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const extDir = join(root, name);
    try {
      if (!statSync(extDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const manifest = readExtensionManifest(extDir);
    if (!manifest) continue;
    const normalized = normalizeExtensionManifest(
      manifest.doc,
      extDir,
      manifest.manifestPath,
      priority,
    );
    for (const entry of normalized) out.push(entry);
  }
  return out;
}

/**
 * Scan all default extension roots and return their combined entries.
 * `path` is accepted for ManifestReader/read signature compatibility but
 * treated as a provenance hint — actual discovery uses known roots.
 */
export function readVscodeExtensions(_path: string): string {
  const roots = defaultExtensionRoots();
  const entries: NormalizedEntry[] = [];
  for (const root of roots) {
    for (const entry of scanExtensionRoot(root, VSCODE_EXTENSION_PRIORITY)) {
      entries.push(entry);
    }
  }
  return Buffer.from(JSON.stringify({ entries })).toString('base64');
}

/** Reader function variant used by ProviderManifest/load dispatch. */
export function readVscodeExtensionEntries(_path: string): NormalizedEntry[] {
  const roots = defaultExtensionRoots();
  const entries: NormalizedEntry[] = [];
  for (const root of roots) {
    for (const entry of scanExtensionRoot(root, VSCODE_EXTENSION_PRIORITY)) {
      entries.push(entry);
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Self-registration on import
// ---------------------------------------------------------------------------

registerManifestReaderFn(VSCODE_EXTENSION_READER_ID, readVscodeExtensions);
registerProviderManifestReader(
  VSCODE_EXTENSION_READER_ID,
  VSCODE_EXTENSION_FORMATS,
  VSCODE_EXTENSION_PRIORITY,
  readVscodeExtensionEntries,
);
