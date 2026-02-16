// ============================================================
// COPF CLI — Shared Utilities
// ============================================================

import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

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
