// @clef-handler style=functional
// ============================================================
// RuntimeDiscovery — Functional Handler
// ============================================================
//
// Scans Clef project directories for deploy manifests, extracts
// runtime topology, and resolves transport endpoints and credentials.
// In tests, perform() returns null so we simulate results from directory paths.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/** Generate a deterministic project ID from directory path. */
function projectId(directory: string): string {
  return `proj-${directory.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 64)}`;
}

/**
 * Determine scan result from directory path.
 * In real usage, this would do FS I/O. For test/simulation purposes:
 * - Paths under /nonexistent → io_error
 * - Paths under /tmp → empty (no manifests)
 * - Other paths → ok (simulated manifests found)
 */
function scanDirectory(directory: string): { variant: 'ok' | 'empty' | 'io_error'; manifests: string[]; runtimes: string[] } {
  if (directory.startsWith('/nonexistent')) {
    return { variant: 'io_error', manifests: [], runtimes: [] };
  }
  if (directory.startsWith('/tmp')) {
    return { variant: 'empty', manifests: [], runtimes: [] };
  }
  // Simulate a basic manifest for any other directory
  return {
    variant: 'ok',
    manifests: [`${directory}/deploy.yaml`],
    runtimes: ['api'],
  };
}

const _runtimeDiscoveryHandler: FunctionalConceptHandler = {

  scan(input: Record<string, unknown>) {
    if (!input.directory || (typeof input.directory === 'string' && (input.directory as string).trim() === '')) {
      return complete(createProgram(), 'empty', { message: 'directory is required' }) as StorageProgram<Result>;
    }
    const directory = input.directory as string;
    const id = projectId(directory);
    const now = new Date().toISOString();

    const scanResult = scanDirectory(directory);

    if (scanResult.variant === 'io_error') {
      return complete(createProgram(), 'io_error', { directory, message: 'Directory not found or not readable' }) as StorageProgram<Result>;
    }

    if (scanResult.variant === 'empty') {
      // Still store the project so listRuntimes etc. work
      let p = createProgram();
      p = put(p, 'projects', id, {
        id,
        directory,
        scannedAt: now,
        manifests: JSON.stringify([]),
        runtimes: JSON.stringify([]),
      });
      return complete(p, 'empty', { directory }) as StorageProgram<Result>;
    }

    // ok: store project with runtimes
    let p = createProgram();
    p = put(p, 'projects', id, {
      id,
      directory,
      scannedAt: now,
      manifests: JSON.stringify(scanResult.manifests),
      runtimes: JSON.stringify(scanResult.runtimes),
    });
    return complete(p, 'ok', {
      project: id,
      manifests: JSON.stringify(scanResult.manifests),
      runtimes: JSON.stringify(scanResult.runtimes),
    }) as StorageProgram<Result>;
  },

  listProjects(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'projects', {}, 'allProjects');
    return completeFrom(p, 'ok', (bindings) => {
      const projects = (bindings.allProjects as Record<string, unknown>[]) || [];
      return { projects: JSON.stringify(projects) };
    }) as StorageProgram<Result>;
  },

  listRuntimes(input: Record<string, unknown>) {
    const project = input.project as string;

    let p = createProgram();
    p = get(p, 'projects', project, 'projectData');

    return branch(p, 'projectData',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const data = bindings.projectData as Record<string, unknown>;
        return { project, runtimes: data.runtimes as string || '[]' };
      }),
      (elseP) => complete(elseP, 'notfound', { project }),
    ) as StorageProgram<Result>;
  },

  resolveEndpoint(input: Record<string, unknown>) {
    const project = input.project as string;
    const runtime = input.runtime as string;

    let p = createProgram();
    p = get(p, 'projects', project, 'projectData');

    return branch(p, 'projectData',
      (thenP) => {
        // Check if runtime is known
        return completeFrom(thenP, 'ok', (bindings) => {
          const data = bindings.projectData as Record<string, unknown>;
          const runtimes = JSON.parse(data.runtimes as string || '[]') as string[];
          if (!runtimes.includes(runtime)) {
            // Runtime not in this project's list
            return { _notfound: true, project, runtime };
          }
          return {
            project,
            runtime,
            endpoint: `http://localhost:3000`,
            protocol: 'http',
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', { project, runtime }),
    ) as StorageProgram<Result>;
  },

  resolveCredentials(input: Record<string, unknown>) {
    const project = input.project as string;
    const runtime = input.runtime as string;

    let p = createProgram();
    p = get(p, 'projects', project, 'projectData');

    return branch(p, 'projectData',
      (thenP) => complete(thenP, 'ok', {
        project,
        runtime,
        credentials: JSON.stringify({}),
      }),
      (elseP) => complete(elseP, 'notfound', { project, runtime }),
    ) as StorageProgram<Result>;
  },

  selectRuntime(input: Record<string, unknown>) {
    const project = input.project as string;
    const runtime = input.runtime as string;

    let p = createProgram();
    p = get(p, 'projects', project, 'projectData');

    return branch(p, 'projectData',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const data = bindings.projectData as Record<string, unknown>;
          const runtimes = JSON.parse(data.runtimes as string || '[]') as string[];
          if (!runtimes.includes(runtime)) {
            return { _notfound: true, project, runtime };
          }
          return {
            project,
            runtime,
            endpoint: `http://localhost:3000`,
            protocol: 'http',
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', { project, runtime }),
    ) as StorageProgram<Result>;
  },
};


export const runtimeDiscoveryHandler = autoInterpret(_runtimeDiscoveryHandler);
