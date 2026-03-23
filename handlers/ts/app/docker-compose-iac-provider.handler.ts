// @clef-handler style=functional concept=DockerComposeIacProvider
// @migrated dsl-constructs 2026-03-18
// DockerComposeIacProvider Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
type R = { variant: string; [key: string]: unknown };
const _dockerComposeIacProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {
      name: 'DockerComposeIacProvider', inputKind: 'DeployPlan',
      outputKind: 'DockerComposeYaml',
      capabilities: JSON.stringify(['yaml', 'services', 'networks']),
      providerKey: 'docker-compose', providerType: 'iac',
    }) as StorageProgram<R>;
  },
  generate(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<R>;
    }
    const plan = input.plan as string;
    const composeFileId = `compose-iac-${plan}-${Date.now()}`;
    const composePath = `./docker-compose-${plan}.yml`;
    let p = createProgram();
    p = put(p, 'composeFile', composeFileId, {
      composePath, projectName: `project-${plan}`,
      services: JSON.stringify([]), runningContainers: JSON.stringify([]),
      lastAppliedAt: null, createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { composeFile: composeFileId, files: [composePath] }) as StorageProgram<R>;
  },
  preview(input: Record<string, unknown>) {
    if (!input.composeFile || (typeof input.composeFile === 'string' && (input.composeFile as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'composeFile is required' }) as StorageProgram<R>;
    }
    const composeFile = input.composeFile as string;
    let p = createProgram();
    p = spGet(p, 'composeFile', composeFile, 'record');
    return branch(p, 'record',
      (b) => complete(b, 'ok', { composeFile, toCreate: 0, toUpdate: 0, toDelete: 0 }),
      (b) => complete(b, 'ok', { composeFile, toCreate: 0, toUpdate: 0, toDelete: 0 }),
    ) as StorageProgram<R>;
  },
  apply(input: Record<string, unknown>) {
    if (!input.composeFile || (typeof input.composeFile === 'string' && (input.composeFile as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'composeFile is required' }) as StorageProgram<R>;
    }
    const composeFile = input.composeFile as string;
    let p = createProgram();
    p = spGet(p, 'composeFile', composeFile, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = put(b, 'composeFile', composeFile, {
          services: JSON.stringify(['app', 'db', 'redis']),
          runningContainers: JSON.stringify([]), lastAppliedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { composeFile, created: [], updated: [] });
      },
      (b) => complete(b, 'ok', { composeFile, created: [], updated: [] }),
    ) as StorageProgram<R>;
  },
  teardown(input: Record<string, unknown>) {
    if (!input.composeFile || (typeof input.composeFile === 'string' && (input.composeFile as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'composeFile is required' }) as StorageProgram<R>;
    }
    const composeFile = input.composeFile as string;
    let p = createProgram();
    p = spGet(p, 'composeFile', composeFile, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = del(b, 'composeFile', composeFile);
        return complete(b2, 'ok', { composeFile, destroyed: [] });
      },
      (b) => {
        let b2 = del(b, 'composeFile', composeFile);
        return complete(b2, 'ok', { composeFile, destroyed: [] });
      },
    ) as StorageProgram<R>;
  },
};
export const dockerComposeIacProviderHandler = autoInterpret(_dockerComposeIacProviderHandler);
