// ManifestReader adapter: tree-sitter grammar auto-discovery.
//
// Walks a node_modules/ directory for packages matching `tree-sitter-*`
// that declare a `tree-sitter` field in their package.json (the official
// convention for tree-sitter grammar packages — an array of entries, each
// describing a scope, path, file-types, etc.). For every discovered grammar
// this reader emits normalized ProviderManifest entries:
//
//   - A Parse entry with provider "tree-sitter" pointing at a resolved .wasm
//     grammar path, options carrying {grammar, packageName}. The slot is
//     derived from the grammar's scope field (e.g. "source.ts" -> "typescript")
//     with a fallback to the package-name suffix after "tree-sitter-".
//
//   - If the same package ships a TextMate grammar (a .tmLanguage.json in
//     common subpaths), a matching Highlight entry with provider "textmate"
//     that points at the TM grammar file via options.grammar.
//
// Priority is 40 — intentionally low so any user-authored manifest entry
// (priority 100) wins over auto-discovery.
//
// Self-registers with ManifestReader and the ProviderManifest dispatch table
// on import. Dispatched by the RegisterTreeSitterAutodiscoverReader sync.
//
// See docs/plans/virtual-provider-registry-prd.md §2 and VPR-08.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute, dirname } from 'node:path';

import { registerReader as registerManifestReaderFn } from '../app/manifest-reader.handler.ts';
import {
  registerManifestReader as registerProviderManifestReader,
} from '../app/provider-manifest.handler.ts';
import type { NormalizedEntry } from './clef-yaml.reader.ts';

export const TREE_SITTER_AUTODISCOVER_READER_ID = 'tree-sitter-autodiscover';
export const TREE_SITTER_AUTODISCOVER_FORMATS = [
  'node_modules/tree-sitter-*/package.json',
];
export const TREE_SITTER_AUTODISCOVER_PRIORITY = 40;

const PACKAGE_PREFIX = 'tree-sitter-';

/**
 * Derive a short slot name from a scope like "source.typescript" -> "typescript"
 * or "source.ts.tsx" -> "tsx". Falls back to the full scope if it has no dot.
 */
export function slotFromScope(scope: string): string {
  if (!scope) return '';
  const dotIdx = scope.lastIndexOf('.');
  if (dotIdx < 0) return scope;
  return scope.slice(dotIdx + 1);
}

/**
 * Derive a slot name from a package name such as "tree-sitter-typescript"
 * -> "typescript", or "@scope/tree-sitter-foo" -> "foo".
 */
export function slotFromPackageName(pkg: string): string {
  const base = pkg.startsWith('@') ? pkg.split('/').slice(-1)[0] : pkg;
  if (base.startsWith(PACKAGE_PREFIX)) {
    return base.slice(PACKAGE_PREFIX.length);
  }
  return base;
}

function encodeOptions(options: unknown): string {
  if (options == null) return '';
  try {
    return Buffer.from(JSON.stringify(options)).toString('base64');
  } catch {
    return '';
  }
}

function safeStat(path: string): ReturnType<typeof statSync> | undefined {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
}

function safeReaddir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Resolve a .wasm grammar artifact inside a grammar package directory.
 * Checks a handful of common conventions used by packages that publish
 * web-tree-sitter compatible builds. Returns an absolute path or undefined.
 */
export function findWasmGrammar(
  pkgDir: string,
  pkgBaseName: string,
  scopeSlot: string,
): string | undefined {
  const base = pkgBaseName.replace(/^@[^/]+\//, '');
  const candidates = [
    `${base}.wasm`,
    `tree-sitter-${scopeSlot}.wasm`,
    `${scopeSlot}.wasm`,
  ];
  const subdirs = ['', 'wasm', 'build', 'dist', 'grammars', 'grammar'];
  for (const sub of subdirs) {
    for (const name of candidates) {
      if (!name || name === '.wasm') continue;
      const p = sub ? join(pkgDir, sub, name) : join(pkgDir, name);
      const st = safeStat(p);
      if (st && st.isFile()) return p;
    }
  }
  return undefined;
}

/**
 * Resolve an optional TextMate grammar (.tmLanguage.json) inside the package.
 */
export function findTextMateGrammar(pkgDir: string): string | undefined {
  const subdirs = ['', 'grammars', 'grammar', 'textmate', 'tmlanguage'];
  for (const sub of subdirs) {
    const dir = sub ? join(pkgDir, sub) : pkgDir;
    const names = safeReaddir(dir);
    for (const n of names) {
      if (n.endsWith('.tmLanguage.json')) {
        return join(dir, n);
      }
    }
  }
  return undefined;
}

type TsEntry = {
  scope?: unknown;
  'file-types'?: unknown;
  path?: unknown;
  [k: string]: unknown;
};

/**
 * Normalize a discovered tree-sitter grammar package into provider entries.
 * Reads package.json, iterates each `tree-sitter` entry, and yields
 * Parse (+ optional Highlight) normalized entries.
 */
export function normalizeTreeSitterPackage(
  pkgDir: string,
  sourcePath: string,
  priority: number,
): NormalizedEntry[] {
  const pkgJsonPath = join(pkgDir, 'package.json');
  const pkg = readJsonIfExists(pkgJsonPath) as
    | { name?: string; 'tree-sitter'?: unknown }
    | undefined;
  if (!pkg || typeof pkg !== 'object') return [];
  const pkgName = typeof pkg.name === 'string' ? pkg.name : '';
  if (!pkgName) return [];

  const tsField = pkg['tree-sitter'];
  const entries: TsEntry[] = Array.isArray(tsField)
    ? (tsField as TsEntry[])
    : [];
  // Packages sometimes declare a single object rather than an array.
  if (!Array.isArray(tsField) && tsField && typeof tsField === 'object') {
    entries.push(tsField as TsEntry);
  }
  if (entries.length === 0) {
    // Fall back to a single synthetic entry keyed by package name.
    entries.push({});
  }

  const fallbackSlot = slotFromPackageName(pkgName);
  const tmPath = findTextMateGrammar(pkgDir);
  const out: NormalizedEntry[] = [];

  for (const entry of entries) {
    const scope = typeof entry.scope === 'string' ? entry.scope : '';
    const slot = (scope ? slotFromScope(scope) : '') || fallbackSlot;
    if (!slot) continue;

    const wasmPath = findWasmGrammar(pkgDir, pkgName, slot);
    if (!wasmPath) continue;

    const extensions = Array.isArray(entry['file-types'])
      ? (entry['file-types'] as unknown[])
          .map((v) => String(v))
          .map((v) => (v.startsWith('.') ? v : `.${v}`))
      : [];

    out.push({
      kind: 'parse',
      slot,
      provider: 'tree-sitter',
      options: encodeOptions({ grammar: wasmPath, packageName: pkgName }),
      extensions,
      priority,
      sourcePath,
    });

    if (tmPath) {
      out.push({
        kind: 'highlight',
        slot,
        provider: 'textmate',
        options: encodeOptions({ grammar: tmPath, packageName: pkgName }),
        extensions,
        priority,
        sourcePath,
      });
    }
  }

  return out;
}

/**
 * Walk a node_modules directory (top-level + @scoped subdirectories) and
 * return every package directory whose name starts with `tree-sitter-`.
 */
export function findTreeSitterPackages(nodeModulesDir: string): string[] {
  const results: string[] = [];
  const top = safeReaddir(nodeModulesDir);
  for (const name of top) {
    if (name.startsWith('.')) continue;
    const full = join(nodeModulesDir, name);
    if (name.startsWith('@')) {
      const scoped = safeReaddir(full);
      for (const inner of scoped) {
        if (inner.startsWith(PACKAGE_PREFIX)) {
          const p = join(full, inner);
          if (safeStat(p)?.isDirectory()) results.push(p);
        }
      }
      continue;
    }
    if (name.startsWith(PACKAGE_PREFIX)) {
      if (safeStat(full)?.isDirectory()) results.push(full);
    }
  }
  return results;
}

/**
 * Resolve the path argument passed to the reader into an absolute
 * node_modules directory. Accepts:
 *   - A node_modules directory path (used directly).
 *   - A project root (appends node_modules).
 *   - A glob-style sentinel like "node_modules/tree-sitter-*\/package.json"
 *     (the format string itself); resolved against cwd.
 */
export function resolveNodeModulesDir(path: string): string {
  const abs = isAbsolute(path) ? path : resolve(process.cwd(), path);
  // Strip a trailing glob like ".../node_modules/tree-sitter-*/package.json".
  const idx = abs.indexOf('node_modules');
  if (idx >= 0) {
    const after = abs.slice(idx);
    const afterNm = after.slice('node_modules'.length);
    if (afterNm === '' || afterNm.startsWith('/') || afterNm.startsWith('\\')) {
      return abs.slice(0, idx + 'node_modules'.length);
    }
  }
  // If it's a file path (e.g. a package.json), walk up to node_modules root.
  const st = safeStat(abs);
  if (st?.isFile()) {
    let dir = dirname(abs);
    while (dir && dir !== dirname(dir)) {
      if (dir.endsWith(`${'/'}node_modules`) || dir.endsWith(`\\node_modules`)) {
        return dir;
      }
      dir = dirname(dir);
    }
  }
  // Otherwise treat as project root.
  return join(abs, 'node_modules');
}

/**
 * Reader entrypoint used by ManifestReader/read — returns base64-encoded
 * JSON { entries: NormalizedEntry[] }.
 */
export function readTreeSitterAutodiscover(path: string): string {
  if (!path) {
    throw new Error('path is required');
  }
  const nodeModulesDir = resolveNodeModulesDir(path);
  const pkgs = findTreeSitterPackages(nodeModulesDir);
  const entries: NormalizedEntry[] = [];
  for (const pkgDir of pkgs) {
    const pkgEntries = normalizeTreeSitterPackage(
      pkgDir,
      join(pkgDir, 'package.json'),
      TREE_SITTER_AUTODISCOVER_PRIORITY,
    );
    entries.push(...pkgEntries);
  }
  return Buffer.from(JSON.stringify({ entries })).toString('base64');
}

/** Reader function variant used by ProviderManifest/load dispatch. */
export function readTreeSitterAutodiscoverEntries(
  path: string,
): NormalizedEntry[] {
  const nodeModulesDir = resolveNodeModulesDir(path);
  const pkgs = findTreeSitterPackages(nodeModulesDir);
  const entries: NormalizedEntry[] = [];
  for (const pkgDir of pkgs) {
    const pkgEntries = normalizeTreeSitterPackage(
      pkgDir,
      join(pkgDir, 'package.json'),
      TREE_SITTER_AUTODISCOVER_PRIORITY,
    );
    entries.push(...pkgEntries);
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Self-registration on import
// ---------------------------------------------------------------------------

registerManifestReaderFn(
  TREE_SITTER_AUTODISCOVER_READER_ID,
  readTreeSitterAutodiscover,
);
registerProviderManifestReader(
  TREE_SITTER_AUTODISCOVER_READER_ID,
  TREE_SITTER_AUTODISCOVER_FORMATS,
  TREE_SITTER_AUTODISCOVER_PRIORITY,
  readTreeSitterAutodiscoverEntries,
);
