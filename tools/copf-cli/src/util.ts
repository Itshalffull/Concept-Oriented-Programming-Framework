// ============================================================
// COPF CLI — Shared Utilities
// ============================================================

import { readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { ConceptStorage } from '../../../kernel/src/types.js';
import { emitterHandler } from '../../../implementations/typescript/framework/emitter.impl.js';

/**
 * Recursively find files matching an extension under a directory.
 * Returns absolute paths sorted alphabetically.
 */
export function findFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];

  function walk(current: string): void {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith(ext)) {
          results.push(fullPath);
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  }

  walk(dir);
  return results.sort();
}

/** A file to be written by the generation pipeline. */
export interface GeneratedFile {
  path: string;
  content: string;
  target?: string;
  concept?: string;
}

/** Result of writing generated files through Emitter. */
export interface WriteResult {
  writtenCount: number;
  skippedCount: number;
}

/**
 * Write generated files through the Emitter handler for content-addressed writes.
 * Shared by both `generate` and `interface` commands to avoid duplication.
 */
export async function writeGeneratedFiles(
  files: GeneratedFile[],
  outputDir: string,
  emitStorage: ConceptStorage,
  options?: { target?: string; concept?: string },
): Promise<WriteResult> {
  let writtenCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const filePath = join(outputDir, file.path);
    mkdirSync(dirname(filePath), { recursive: true });

    const writeResult = await emitterHandler.write(
      {
        path: filePath,
        content: file.content,
        target: file.target ?? options?.target ?? 'generated',
        concept: file.concept ?? options?.concept ?? 'unknown',
      },
      emitStorage,
    );

    if (writeResult.variant === 'ok' && writeResult.written) {
      writtenCount++;
    } else {
      skippedCount++;
    }
  }

  return { writtenCount, skippedCount };
}
