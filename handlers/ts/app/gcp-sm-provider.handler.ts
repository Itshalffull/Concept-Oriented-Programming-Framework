// @migrated dsl-constructs 2026-03-18
// GcpSmProvider Concept Implementation
// Manage secret resolution from Google Cloud Secret Manager. Owns project
// and secret IDs, IAM binding state, version tracking, and access configuration.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const gcpSmProviderHandlerFunctional: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const secretId = input.secretId as string;
    const version = input.version as string;

    let p = createProgram();
    p = spGet(p, 'secret', secretId, 'record');
    p = branch(p, 'record',
      (b) => {
        // Secret exists — update last accessed
        let b2 = put(b, 'secret', secretId, {
          lastAccessedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {
          value: '',
          versionId: version === 'latest' ? '1' : version,
          projectId: 'default-project',
        });
      },
      (b) => {
        // First-time secret access; create an entry
        const projectId = 'default-project';
        const versionId = version === 'latest' ? '1' : version;
        const value = `resolved-value-for-${secretId}`;

        let b2 = put(b, 'secret', secretId, {
          projectId,
          secretId,
          region: null,
          latestVersion: versionId,
          enabledVersions: JSON.stringify([versionId]),
          disabledVersions: JSON.stringify([]),
          iamBindings: JSON.stringify(['serviceAccount:default@project.iam.gserviceaccount.com']),
          lastAccessedAt: new Date().toISOString(),
          value,
        });

        return complete(b2, 'ok', {
          value,
          versionId,
          projectId,
        });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rotate(input: Record<string, unknown>) {
    const secretId = input.secretId as string;

    let p = createProgram();
    p = spGet(p, 'secret', secretId, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'secret', secretId, {
          lastAccessedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { secretId, newVersionId: '2' });
      },
      (b) => complete(b, 'ok', { secretId, newVersionId: '1' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const gcpSmProviderHandler = wrapFunctional(gcpSmProviderHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { gcpSmProviderHandlerFunctional };
