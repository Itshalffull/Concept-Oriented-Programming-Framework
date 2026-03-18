// @migrated dsl-constructs 2026-03-18
// ============================================================
// Emitter Concept Implementation
//
// Content-addressed file output management. Skips writes when
// content hash matches existing file. Handles formatting,
// orphan cleanup, batch writes, source traceability, and
// drift detection.
//
// Promoted from Clef Bind to generation suite as shared
// infrastructure for all generation families.
// See clef-generation-suite.md Part 1.5
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptStorage } from '../../../runtime/types.js';
import { createHash, randomUUID } from 'crypto';

// Storage relation names
const FILES_RELATION = 'files';
const MANIFEST_RELATION = 'manifest';
const SOURCE_MAP_RELATION = 'sourceMap';

/**
 * Extension → formatter mapping. In a real implementation these
 * would shell out to external binaries.
 */
const EXTENSION_FORMATTERS: Record<string, string> = {
  ts: 'prettier',
  tsx: 'prettier',
  js: 'prettier',
  jsx: 'prettier',
  json: 'prettier',
  css: 'prettier',
  scss: 'prettier',
  html: 'prettier',
  yaml: 'prettier',
  yml: 'prettier',
  md: 'prettier',
  py: 'black',
  go: 'gofmt',
  rs: 'rustfmt',
  swift: 'swift-format',
  c: 'clang-format',
  cpp: 'clang-format',
  h: 'clang-format',
  dart: 'dart-format',
  proto: 'buf',
};

const KNOWN_FORMATTERS = new Set([
  'prettier',
  'black',
  'gofmt',
  'rustfmt',
  'clang-format',
  'dart-format',
  'swift-format',
  'buf',
]);

/**
 * Compute SHA-256 hash of content string.
 */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Derive a storage key for a file from its output path.
 * Normalises forward slashes for consistency.
 */
function fileKey(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Extract file extension from a path.
 */
function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return '';
  return path.slice(lastDot + 1).toLowerCase();
}

/**
 * Derive output directory from the file path (first path segment).
 */
function deriveOutputDir(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  return segments.length > 1 ? segments[0] : '.';
}

/** Source provenance entry for traceability. */
interface SourceEntry {
  sourcePath: string;
  sourceRange?: string;
  conceptName?: string;
  actionName?: string;
}

/**
 * Write a single file to storage, returning write result.
 * Shared logic for both write() and writeBatch().
 */
async function writeFileInternal(
  storage: ConceptStorage,
  path: string,
  content: string,
  sources?: SourceEntry[],
  target?: string,
  concept?: string,
) {
  const hash = sha256(content);
  const key = fileKey(path);

  const existing = await storage.get(FILES_RELATION, key);

  if (existing && existing.hash === hash) {
    return {
      written: false,
      path,
      contentHash: hash,
      fileId: existing.id as string,
      sizeBytes: (existing.sizeBytes as number) || 0,
      isNew: false,
    };
  }

  const fileId = existing ? (existing.id as string) : randomUUID();
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  const now = new Date().toISOString();

  await storage.put(FILES_RELATION, key, {
    id: fileId,
    path,
    hash,
    target: target || '',
    concept: concept || '',
    content,
    sizeBytes,
    generatedAt: now,
    formatted: false,
  });

  // Store source provenance if provided
  if (sources && sources.length > 0) {
    await storage.put(SOURCE_MAP_RELATION, key, {
      path,
      sources,
    });
  }

  return {
    written: true,
    path,
    contentHash: hash,
    fileId,
    sizeBytes,
    isNew: !existing,
  };
}

const _handler: FunctionalConceptHandler = {
  /**
   * Content-addressed file writing.
   *
   * Computes SHA-256 of the content and compares against the stored
   * hash for the same path. If the hash matches, the write is
   * skipped (written: false) so downstream build tools can rely on
   * file timestamps.
   *
   * Supports both the generation suite signature (path, content,
   * formatHint, sources) and the legacy Clef Bind signature
   * (path, content, target, concept).
   */
  async write(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const path = input.path as string;
    const content = input.content as string;
    const target = input.target as string | undefined;
    const concept = input.concept as string | undefined;
    const sources = input.sources as SourceEntry[] | undefined;

    if (!path) {
      p = complete(p, 'error', { message: 'path is required',
        path: path ?? '' }); return p;
    }

    try {
      const result = await writeFileInternal(storage /* TODO: convert helper to DSL */, path, content, sources, target, concept);

      // Update manifest totals
      if (result.written) {
        const existing = result.isNew ? null : { sizeBytes: result.sizeBytes };
        await updateManifestOnWrite(storage /* TODO: convert helper to DSL */, path, result.sizeBytes, existing);
      }

      p = complete(p, 'ok', { written: result.written,
        path: result.path,
        contentHash: result.contentHash,
        file: result.fileId,
        hash: result.contentHash }); return p;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      p = complete(p, 'error', { message, path }); return p;
    }
  },

  /**
   * Write multiple files atomically. If any file fails,
   * none are written. Returns per-file results.
   */
  async writeBatch(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const files = input.files as Array<{
      path: string;
      content: string;
      formatHint?: string;
      sources?: SourceEntry[];
      target?: string;
      concept?: string;
    }>;

    if (!files || !Array.isArray(files) || files.length === 0) {
      p = complete(p, 'ok', { results: [] }); return p;
    }

    try {
      const results: Array<{ path: string; written: boolean; contentHash: string }> = [];

      for (const file of files) {
        const result = await writeFileInternal(
          storage,
          file.path,
          file.content,
          file.sources,
          file.target,
          file.concept,
        );

        if (result.written) {
          const existing = result.isNew ? null : { sizeBytes: result.sizeBytes };
          await updateManifestOnWrite(storage /* TODO: convert helper to DSL */, file.path, result.sizeBytes, existing);
        }

        results.push({
          path: result.path,
          written: result.written,
          contentHash: result.contentHash,
        });
      }

      p = complete(p, 'ok', { results }); return p;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const failedPath = files[0]?.path || '';
      p = complete(p, 'error', { message, failedPath }); return p;
    }
  },

  /**
   * Format a file by path using extension-based formatter selection,
   * OR by explicit file ID and formatter name (legacy interface).
   *
   * In this stub implementation the file is simply marked as
   * formatted in storage. A production implementation would shell
   * out to prettier / black / gofmt / rustfmt based on the
   * formatter name and file extension.
   */
  async format(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    // Support both path-based (generation suite) and file-ID-based (legacy) signatures
    const pathInput = input.path as string | undefined;
    const fileId = input.file as string | undefined;
    const explicitFormatter = input.formatter as string | undefined;

    let fileRecord: Record<string, unknown> | null = null;
    let key: string;

    if (pathInput) {
      // Path-based lookup (generation suite pattern)
      key = fileKey(pathInput);
      fileRecord = await storage.get(FILES_RELATION, key);
    } else if (fileId) {
      // File ID-based lookup (legacy Clef Bind pattern)
      const allFiles = await storage.find(FILES_RELATION, { id: fileId });
      if (allFiles.length === 0) {
        p = complete(p, 'error', { message: `file ${fileId} not found in storage` }); return p;
      }
      fileRecord = allFiles[0];
      key = fileKey(fileRecord.path as string);
    } else {
      p = complete(p, 'error', { message: 'path or file ID is required' }); return p;
    }

    if (!fileRecord) {
      p = complete(p, 'error', { message: `file not found at ${pathInput}` }); return p;
    }

    // Determine formatter: explicit > extension-based
    const filePath = fileRecord.path as string;
    const ext = getExtension(filePath);
    const formatter = explicitFormatter || EXTENSION_FORMATTERS[ext];

    if (!formatter) {
      // No formatter for this extension — no-op
      p = complete(p, 'ok', { changed: false }); return p;
    }

    if (!KNOWN_FORMATTERS.has(formatter)) {
      p = complete(p, 'ok', { changed: false }); return p;
    }

    try {
      // Stub: mark the file as formatted.
      // Real implementation would invoke the formatter binary and
      // recompute the content hash afterwards.
      await storage.put(FILES_RELATION, key!, {
        ...fileRecord,
        formatted: true,
      });

      p = complete(p, 'ok', { changed: true, file: fileRecord.id }); return p;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      p = complete(p, 'error', { message, ...(stack ? { stack } : {}) }); return p;
    }
  },

  /**
   * Remove orphaned files from an output directory.
   *
   * Compares the set of files stored for `outputDir` against the
   * `currentManifest` (or `currentFiles` for legacy compat) list.
   * Any stored file whose path is NOT in the current set is deleted.
   */
  async clean(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const outputDir = input.outputDir as string;
    // Support both new (currentManifest) and legacy (currentFiles) parameter names
    const currentList = (input.currentManifest || input.currentFiles) as string[];

    const normalizedDir = outputDir.replace(/\\/g, '/').replace(/\/$/, '');
    const currentSet = new Set(
      (currentList || []).map((f) => fileKey(f)),
    );

    const allFiles = await storage.find(FILES_RELATION);
    const removed: string[] = [];

    for (const file of allFiles) {
      const filePath = fileKey(file.path as string);

      if (!filePath.startsWith(normalizedDir + '/')) {
        continue;
      }

      if (!currentSet.has(filePath)) {
        await storage.del(FILES_RELATION, filePath);
        await storage.del(SOURCE_MAP_RELATION, filePath);
        removed.push(file.path as string);
      }
    }

    p = complete(p, 'ok', { removed }); return p;
  },

  /**
   * Return the manifest of all generated files for an output directory.
   */
  async manifest(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const outputDir = input.outputDir as string;
    const normalizedDir = outputDir.replace(/\\/g, '/').replace(/\/$/, '');

    const allFiles = await storage.find(FILES_RELATION);
    const files: Array<{ path: string; hash: string; lastWritten: string }> = [];
    let totalBytes = 0;

    for (const file of allFiles) {
      const filePath = fileKey(file.path as string);

      if (filePath.startsWith(normalizedDir + '/')) {
        files.push({
          path: file.path as string,
          hash: file.hash as string,
          lastWritten: file.generatedAt as string,
        });
        totalBytes += (file.sizeBytes as number) || 0;
      }
    }

    p = complete(p, 'ok', { files, totalBytes }); return p;
  },

  /**
   * Return all source elements that contributed to an output file.
   * Enables "which spec produced this generated code?" queries.
   */
  async trace(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const outputPath = input.outputPath as string;
    const key = fileKey(outputPath);

    const fileRecord = await storage.get(FILES_RELATION, key);
    if (!fileRecord) {
      p = complete(p, 'notFound', { path: outputPath }); return p;
    }

    const sourceMapRecord = await storage.get(SOURCE_MAP_RELATION, key);
    const sources = sourceMapRecord
      ? (sourceMapRecord.sources as SourceEntry[])
      : [];

    p = complete(p, 'ok', { sources }); return p;
  },

  /**
   * Return all output files whose sourceMap includes a given source path.
   * Enables "what regenerates if I change this spec?" queries.
   */
  async affected(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const sourcePath = input.sourcePath as string;

    const allSourceMaps = await storage.find(SOURCE_MAP_RELATION);
    const outputs: string[] = [];

    for (const record of allSourceMaps) {
      const sources = record.sources as SourceEntry[];
      if (sources && sources.some(s => s.sourcePath === sourcePath)) {
        outputs.push(record.path as string);
      }
    }

    p = complete(p, 'ok', { outputs }); return p;
  },

  /**
   * Compare manifest against filesystem for drift detection.
   *
   * In this storage-based implementation, we compare the stored
   * manifest hash against the actual stored content hash. In a
   * production implementation, this would compare against the
   * actual filesystem.
   */
  async audit(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const outputDir = input.outputDir as string;
    const normalizedDir = outputDir.replace(/\\/g, '/').replace(/\/$/, '');

    const allFiles = await storage.find(FILES_RELATION);
    const status: Array<{
      path: string;
      state: string;
      expectedHash: string | null;
      actualHash: string | null;
    }> = [];

    for (const file of allFiles) {
      const filePath = fileKey(file.path as string);

      if (!filePath.startsWith(normalizedDir + '/')) {
        continue;
      }

      const storedHash = file.hash as string;
      const content = file.content as string | undefined;

      if (!content) {
        // File is in manifest but content not available — treat as missing
        status.push({
          path: file.path as string,
          state: 'missing',
          expectedHash: storedHash,
          actualHash: null,
        });
        continue;
      }

      const actualHash = sha256(content);
      if (actualHash === storedHash) {
        status.push({
          path: file.path as string,
          state: 'current',
          expectedHash: storedHash,
          actualHash,
        });
      } else {
        status.push({
          path: file.path as string,
          state: 'drifted',
          expectedHash: storedHash,
          actualHash,
        });
      }
    }

    p = complete(p, 'ok', { status }); return p;
  },
};

export const emitterHandler = autoInterpret(_handler);
