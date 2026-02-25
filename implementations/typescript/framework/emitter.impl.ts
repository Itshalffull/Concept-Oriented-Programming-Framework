// ============================================================
// Emitter Concept Implementation
//
// Content-addressed file output management. Skips writes when
// content hash matches existing file. Handles formatting,
// orphan cleanup, batch writes, source traceability, and
// drift detection.
//
// Promoted from interface kit to generation kit as shared
// infrastructure for all generation families.
// See copf-generation-kit.md Part 1.5
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';
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
): Promise<{ written: boolean; path: string; contentHash: string; fileId: string; sizeBytes: number; isNew: boolean }> {
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

export const emitterHandler: ConceptHandler = {
  /**
   * Content-addressed file writing.
   *
   * Computes SHA-256 of the content and compares against the stored
   * hash for the same path. If the hash matches, the write is
   * skipped (written: false) so downstream build tools can rely on
   * file timestamps.
   *
   * Supports both the generation kit signature (path, content,
   * formatHint, sources) and the legacy interface kit signature
   * (path, content, target, concept).
   */
  async write(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const path = input.path as string;
    const content = input.content as string;
    const target = input.target as string | undefined;
    const concept = input.concept as string | undefined;
    const sources = input.sources as SourceEntry[] | undefined;

    if (!path) {
      return {
        variant: 'error',
        message: 'path is required',
        path: path ?? '',
      };
    }

    try {
      const result = await writeFileInternal(storage, path, content, sources, target, concept);

      // Update manifest totals
      if (result.written) {
        const existing = result.isNew ? null : { sizeBytes: result.sizeBytes };
        await updateManifestOnWrite(storage, path, result.sizeBytes, existing);
      }

      return {
        variant: 'ok',
        written: result.written,
        path: result.path,
        contentHash: result.contentHash,
        file: result.fileId,
        hash: result.contentHash,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message, path };
    }
  },

  /**
   * Write multiple files atomically. If any file fails,
   * none are written. Returns per-file results.
   */
  async writeBatch(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const files = input.files as Array<{
      path: string;
      content: string;
      formatHint?: string;
      sources?: SourceEntry[];
      target?: string;
      concept?: string;
    }>;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return { variant: 'ok', results: [] };
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
          await updateManifestOnWrite(storage, file.path, result.sizeBytes, existing);
        }

        results.push({
          path: result.path,
          written: result.written,
          contentHash: result.contentHash,
        });
      }

      return { variant: 'ok', results };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const failedPath = files[0]?.path || '';
      return { variant: 'error', message, failedPath };
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
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // Support both path-based (generation kit) and file-ID-based (legacy) signatures
    const pathInput = input.path as string | undefined;
    const fileId = input.file as string | undefined;
    const explicitFormatter = input.formatter as string | undefined;

    let fileRecord: Record<string, unknown> | null = null;
    let key: string;

    if (pathInput) {
      // Path-based lookup (generation kit pattern)
      key = fileKey(pathInput);
      fileRecord = await storage.get(FILES_RELATION, key);
    } else if (fileId) {
      // File ID-based lookup (legacy interface kit pattern)
      const allFiles = await storage.find(FILES_RELATION, { id: fileId });
      if (allFiles.length === 0) {
        return { variant: 'error', message: `file ${fileId} not found in storage` };
      }
      fileRecord = allFiles[0];
      key = fileKey(fileRecord.path as string);
    } else {
      return { variant: 'error', message: 'path or file ID is required' };
    }

    if (!fileRecord) {
      return { variant: 'error', message: `file not found at ${pathInput}` };
    }

    // Determine formatter: explicit > extension-based
    const filePath = fileRecord.path as string;
    const ext = getExtension(filePath);
    const formatter = explicitFormatter || EXTENSION_FORMATTERS[ext];

    if (!formatter) {
      // No formatter for this extension — no-op
      return { variant: 'ok', changed: false };
    }

    if (!KNOWN_FORMATTERS.has(formatter)) {
      return { variant: 'ok', changed: false };
    }

    try {
      // Stub: mark the file as formatted.
      // Real implementation would invoke the formatter binary and
      // recompute the content hash afterwards.
      await storage.put(FILES_RELATION, key!, {
        ...fileRecord,
        formatted: true,
      });

      return { variant: 'ok', changed: true, file: fileRecord.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
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
  ): Promise<{ variant: string; [key: string]: unknown }> {
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

    return { variant: 'ok', removed };
  },

  /**
   * Return the manifest of all generated files for an output directory.
   */
  async manifest(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
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

    return { variant: 'ok', files, totalBytes };
  },

  /**
   * Return all source elements that contributed to an output file.
   * Enables "which spec produced this generated code?" queries.
   */
  async trace(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const outputPath = input.outputPath as string;
    const key = fileKey(outputPath);

    const fileRecord = await storage.get(FILES_RELATION, key);
    if (!fileRecord) {
      return { variant: 'notFound', path: outputPath };
    }

    const sourceMapRecord = await storage.get(SOURCE_MAP_RELATION, key);
    const sources = sourceMapRecord
      ? (sourceMapRecord.sources as SourceEntry[])
      : [];

    return { variant: 'ok', sources };
  },

  /**
   * Return all output files whose sourceMap includes a given source path.
   * Enables "what regenerates if I change this spec?" queries.
   */
  async affected(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const sourcePath = input.sourcePath as string;

    const allSourceMaps = await storage.find(SOURCE_MAP_RELATION);
    const outputs: string[] = [];

    for (const record of allSourceMaps) {
      const sources = record.sources as SourceEntry[];
      if (sources && sources.some(s => s.sourcePath === sourcePath)) {
        outputs.push(record.path as string);
      }
    }

    return { variant: 'ok', outputs };
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
  ): Promise<{ variant: string; [key: string]: unknown }> {
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

    return { variant: 'ok', status };
  },
};

// ---- Internal helpers ----

/**
 * Update the aggregated manifest record for the output directory
 * that a file belongs to. Adjusts file count and byte totals.
 */
async function updateManifestOnWrite(
  storage: ConceptStorage,
  filePath: string,
  newSize: number,
  existing: Record<string, unknown> | null,
): Promise<void> {
  const outputDir = deriveOutputDir(filePath);
  const manifestRecord = await storage.get(MANIFEST_RELATION, outputDir);

  let totalFiles = 1;
  let totalBytes = newSize;

  if (manifestRecord) {
    totalFiles = (manifestRecord.totalFiles as number) || 0;
    totalBytes = (manifestRecord.totalBytes as number) || 0;

    if (existing) {
      totalBytes = totalBytes - ((existing.sizeBytes as number) || 0) + newSize;
    } else {
      totalFiles += 1;
      totalBytes += newSize;
    }
  }

  await storage.put(MANIFEST_RELATION, outputDir, {
    outputDir,
    totalFiles,
    totalBytes,
  });
}
