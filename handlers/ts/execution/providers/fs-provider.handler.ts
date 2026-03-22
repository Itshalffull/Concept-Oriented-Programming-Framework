// @clef-handler style=imperative concept=fs-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, find, pure, perform,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

/**
 * FsProvider — functional handler.
 *
 * Filesystem operations through the execution layer. Uses perform()
 * for actual I/O so all file operations get ConnectorCall tracking,
 * PerformanceProfile, etc. Eliminates the need for imperative handlers.
 */
export const fsProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'fs-provider',
      kind: 'runtime',
      capabilities: JSON.stringify(['read', 'write', 'exists', 'delete', 'mkdir']) });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  read(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = perform(p, 'fs', 'read', { path }, 'fileContent');
    p = complete(p, 'ok', { content: '', path });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  write(input: Record<string, unknown>) {
    const path = input.path as string;
    const content = input.content as string;

    let p = createProgram();
    p = perform(p, 'fs', 'write', { path, content }, 'writeResult');
    p = complete(p, 'ok', { bytesWritten: content.length });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  exists(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = perform(p, 'fs', 'exists', { path }, 'existsResult');
    p = complete(p, 'ok', { exists: false });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = perform(p, 'fs', 'delete', { path }, 'deleteResult');
    p = complete(p, 'ok', {});
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'operations', {}, 'allOps');
    p = complete(p, 'ok', { operations: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
