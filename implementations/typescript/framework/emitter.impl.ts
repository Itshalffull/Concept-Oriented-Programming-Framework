// ============================================================
// Emitter Concept Implementation
//
// Content-addressed file output management. Skips writes when
// content hash matches existing file. Handles formatting and
// orphan cleanup.
// Architecture doc: Interface Kit, Section 1.6
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';
import { createHash, randomUUID } from 'crypto';

// Storage relation names
const FILES_RELATION = 'files';
const MANIFEST_RELATION = 'manifest';

/**
 * Known formatters. In a real implementation these would shell out
 * to external binaries (prettier, black, gofmt, rustfmt, etc.).
 */
const KNOWN_FORMATTERS = new Set([
  'prettier',
  'black',
  'gofmt',
  'rustfmt',
  'clang-format',
  'dart-format',
  'swift-format',
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

export const emitterHandler: ConceptHandler = {
  /**
   * Content-addressed file writing.
   *
   * Computes SHA-256 of the content and compares against the stored
   * hash for the same path.  If the hash matches, the write is
   * skipped (written: false) so downstream build tools can rely on
   * file timestamps.
   */
  async write(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const path = input.path as string;
    const content = input.content as string;
    const target = input.target as string;
    const concept = input.concept as string;

    if (!path) {
      return {
        variant: 'directoryError',
        path: path ?? '',
        reason: 'path is required',
      };
    }

    const hash = sha256(content);
    const key = fileKey(path);

    // Check for existing file with same hash (content-addressed skip)
    const existing = await storage.get(FILES_RELATION, key);

    if (existing && existing.hash === hash) {
      return {
        variant: 'ok',
        file: existing.id as string,
        hash,
        written: false,
      };
    }

    // Generate new file ID or reuse existing one for the same path
    const fileId = existing ? (existing.id as string) : randomUUID();
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    const now = new Date().toISOString();

    // Store file metadata
    await storage.put(FILES_RELATION, key, {
      id: fileId,
      path,
      hash,
      target,
      concept,
      content,
      sizeBytes,
      generatedAt: now,
      formatted: false,
    });

    // Update manifest totals for the output directory
    await updateManifestOnWrite(storage, path, sizeBytes, existing);

    return {
      variant: 'ok',
      file: fileId,
      hash,
      written: true,
    };
  },

  /**
   * Format a previously written file using a named formatter.
   *
   * In this stub implementation the file is simply marked as
   * formatted in storage.  A production implementation would shell
   * out to prettier / black / gofmt / rustfmt based on the
   * formatter name and file extension.
   */
  async format(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const fileId = input.file as string;
    const formatter = input.formatter as string;

    // Check whether the formatter is recognised
    if (!KNOWN_FORMATTERS.has(formatter)) {
      return {
        variant: 'formatterUnavailable',
        formatter,
      };
    }

    // Look up the file record by scanning stored files
    const allFiles = await storage.find(FILES_RELATION, { id: fileId });

    if (allFiles.length === 0) {
      return {
        variant: 'formatError',
        file: fileId,
        reason: `file ${fileId} not found in storage`,
      };
    }

    const fileRecord = allFiles[0];
    const key = fileKey(fileRecord.path as string);

    try {
      // Stub: mark the file as formatted.
      // Real implementation would invoke the formatter binary and
      // recompute the content hash afterwards.
      await storage.put(FILES_RELATION, key, {
        ...fileRecord,
        formatted: true,
      });

      return {
        variant: 'ok',
        file: fileId,
      };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        variant: 'formatError',
        file: fileId,
        reason,
      };
    }
  },

  /**
   * Remove orphaned files from an output directory.
   *
   * Compares the set of files stored for `outputDir` against the
   * `currentFiles` list.  Any stored file whose path is NOT in
   * `currentFiles` is deleted from storage.
   */
  async clean(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const outputDir = input.outputDir as string;
    const currentFiles = input.currentFiles as string[];

    const normalizedDir = outputDir.replace(/\\/g, '/').replace(/\/$/, '');
    const currentSet = new Set(
      (currentFiles || []).map((f) => fileKey(f)),
    );

    // Find all files stored under this output directory
    const allFiles = await storage.find(FILES_RELATION);
    const removed: string[] = [];

    for (const file of allFiles) {
      const filePath = fileKey(file.path as string);

      // Check if file belongs to this output directory
      if (!filePath.startsWith(normalizedDir + '/')) {
        continue;
      }

      // If the file is not in the current set, it is orphaned
      if (!currentSet.has(filePath)) {
        await storage.del(FILES_RELATION, filePath);
        removed.push(file.path as string);
      }
    }

    return {
      variant: 'ok',
      removed,
    };
  },

  /**
   * Return the manifest of all generated files for an output
   * directory, including the total byte count.
   */
  async manifest(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const outputDir = input.outputDir as string;
    const normalizedDir = outputDir.replace(/\\/g, '/').replace(/\/$/, '');

    const allFiles = await storage.find(FILES_RELATION);
    const files: string[] = [];
    let totalBytes = 0;

    for (const file of allFiles) {
      const filePath = fileKey(file.path as string);

      if (filePath.startsWith(normalizedDir + '/')) {
        files.push(file.path as string);
        totalBytes += (file.sizeBytes as number) || 0;
      }
    }

    return {
      variant: 'ok',
      files,
      totalBytes,
    };
  },
};

// ---- Internal helpers ----

/**
 * Update the aggregated manifest record for the output directory
 * that a file belongs to.  Adjusts file count and byte totals.
 */
async function updateManifestOnWrite(
  storage: ConceptStorage,
  filePath: string,
  newSize: number,
  existing: Record<string, unknown> | null,
): Promise<void> {
  // Derive output directory from the file path (first path segment)
  const normalizedPath = filePath.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  const outputDir = segments.length > 1 ? segments[0] : '.';

  const manifestRecord = await storage.get(MANIFEST_RELATION, outputDir);

  let totalFiles = 1;
  let totalBytes = newSize;

  if (manifestRecord) {
    totalFiles = (manifestRecord.totalFiles as number) || 0;
    totalBytes = (manifestRecord.totalBytes as number) || 0;

    if (existing) {
      // Replacing existing file: adjust byte count
      totalBytes = totalBytes - ((existing.sizeBytes as number) || 0) + newSize;
    } else {
      // New file
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
