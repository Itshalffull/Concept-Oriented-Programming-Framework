// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// DockerComposeIacProvider Concept Implementation
// Docker Compose IaC provider. Generates Compose files from deploy plans,
// previews changes, applies services, and handles teardown.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'dciac';

const _dockerComposeIacProviderHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const plan = input.plan as string;

    const composeFileId = `compose-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['docker-compose.yml'];

    let p = createProgram();
    p = put(p, RELATION, composeFileId, {
      composeFile: composeFileId,
      plan,
      status: 'generated',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { composeFile: composeFileId, files }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const composeFile = input.composeFile as string;

    const p = createProgram();
    return complete(p, 'ok', {
      composeFile,
      toCreate: 0,
      toUpdate: 0,
      toDelete: 0,
    }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const composeFile = input.composeFile as string;

    let p = createProgram();
    p = get(p, RELATION, composeFile, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, composeFile, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            status: 'applied',
            appliedAt: new Date().toISOString(),
          };
        });
        return complete(thenP, 'ok', { composeFile, created: [], updated: [] });
      },
      (elseP) => complete(elseP, 'ok', { composeFile, created: [], updated: [] }),
    ) as StorageProgram<Result>;
  },

  teardown(input: Record<string, unknown>) {
    const composeFile = input.composeFile as string;

    let p = createProgram();
    p = get(p, RELATION, composeFile, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, RELATION, composeFile);
        return complete(thenP, 'ok', { composeFile, destroyed: [composeFile] });
      },
      (elseP) => complete(elseP, 'ok', { composeFile, destroyed: [] }),
    ) as StorageProgram<Result>;
  },
};

export const dockerComposeIacProviderHandler = autoInterpret(_dockerComposeIacProviderHandler);
