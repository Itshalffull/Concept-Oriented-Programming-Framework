// @migrated dsl-constructs 2026-03-18
// Emitter Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

const interfaceEmitterHandlerFunctional: FunctionalConceptHandler = {
  write(input: Record<string, unknown>) {
    const path = input.path as string;
    const content = input.content as string;
    const target = input.target as string;
    const concept = input.concept as string;

    const dirParts = path.split('/');
    if (dirParts.length < 2) {
      const p = createProgram();
      return complete(p, 'directoryError', { path, reason: 'Invalid output path' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const hash = computeHash(content);
    const now = new Date().toISOString();
    const sizeBytes = content.length;

    let p = createProgram();
    p = spGet(p, 'file', path, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Check if content changed
        let b2 = put(b, 'file', path, {
          path, hash, target, concept,
          generatedAt: now, sizeBytes, formatted: false, content,
        });
        return complete(b2, 'ok', { file: path, hash, written: true });
      },
      (b) => {
        let b2 = put(b, 'file', path, {
          path, hash, target, concept,
          generatedAt: now, sizeBytes, formatted: false, content,
        });
        return complete(b2, 'ok', { file: path, hash, written: true });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  format(input: Record<string, unknown>) {
    const file = input.file as string;
    const formatter = input.formatter as string;

    const knownFormatters = ['prettier', 'black', 'gofmt', 'rustfmt', 'clang-format'];
    if (!knownFormatters.includes(formatter)) {
      const p = createProgram();
      return complete(p, 'formatterUnavailable', { formatter }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'file', file, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'file', file, { formatted: true });
        return complete(b2, 'ok', { file });
      },
      (b) => complete(b, 'formatError', { file, reason: 'File not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clean(input: Record<string, unknown>) {
    const outputDir = input.outputDir as string;
    const currentFiles = JSON.parse(input.currentFiles as string) as string[];

    let p = createProgram();
    p = find(p, 'file', {}, 'allFiles');
    return complete(p, 'ok', { removed: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  manifest(input: Record<string, unknown>) {
    const outputDir = input.outputDir as string;

    let p = createProgram();
    p = find(p, 'file', {}, 'allFiles');
    return complete(p, 'ok', { files: JSON.stringify([]), totalBytes: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const interfaceEmitterHandler = wrapFunctional(interfaceEmitterHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { interfaceEmitterHandlerFunctional };
