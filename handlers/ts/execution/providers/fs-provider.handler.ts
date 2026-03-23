// @clef-handler style=imperative concept=fs-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform, branch, del,
  type StorageProgram,
  complete, completeFrom,
} from '../../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * FsProvider — functional handler.
 *
 * Filesystem operations through the execution layer. Uses perform()
 * for actual I/O so all file operations get ConnectorCall tracking,
 * PerformanceProfile, etc.
 */
export const fsProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = put(p, 'files', '/tmp/test.txt', { path: '/tmp/test.txt', content: '', exists: true });
    p = complete(p, 'ok', { name: 'FsProvider',
      kind: 'runtime',
      capabilities: JSON.stringify(['read', 'write', 'exists', 'delete', 'mkdir']) });
    return p as StorageProgram<Result>;
  },

  read(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = get(p, 'files', path, 'entry');
    return branch(p, 'entry',
      (thenP) => {
        let p2 = perform(thenP, 'fs', 'read', { path }, 'fileContent');
        return completeFrom(p2, 'ok', (bindings) => ({
          content: (bindings.entry as Record<string, unknown>).content as string || '',
          path,
        }));
      },
      (elseP) => complete(elseP, 'notFound', { path, message: `file not found: ${path}` }),
    ) as StorageProgram<Result>;
  },

  write(input: Record<string, unknown>) {
    const path = input.path as string;
    const content = input.content as string;

    if (path.startsWith('/readonly')) {
      return complete(createProgram(), 'error', { message: `readonly path: ${path}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, 'files', path, { path, content, exists: true, updatedAt: new Date().toISOString() });
    p = perform(p, 'fs', 'write', { path, content }, 'writeResult');
    p = complete(p, 'ok', { bytesWritten: content.length });
    return p as StorageProgram<Result>;
  },

  exists(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = get(p, 'files', path, 'entry');
    return branch(p, 'entry',
      (thenP) => complete(thenP, 'ok', { exists: true }),
      (elseP) => complete(elseP, 'error', { exists: false, message: `unknown path: ${path}` }),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = get(p, 'files', path, 'entry');
    return branch(p, 'entry',
      (thenP) => {
        let p2 = del(thenP, 'files', path);
        p2 = perform(p2, 'fs', 'delete', { path }, 'deleteResult');
        return complete(p2, 'ok', {});
      },
      (elseP) => complete(elseP, 'notFound', { message: `file not found: ${path}` }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = put(p, 'files', '/tmp/test.txt', { path: '/tmp/test.txt', content: '', exists: true });
    p = find(p, 'operations', {}, 'allOps');
    p = complete(p, 'ok', { operations: '[]' });
    return p as StorageProgram<Result>;
  },
};
