// @clef-handler style=functional concept=DockerComposeIacProvider
// @migrated dsl-constructs 2026-03-18
// DockerComposeIacProvider Concept Implementation
// Generate and apply Docker Compose files from Clef deploy plans. Owns
// the compose file path, service definitions, and running container state
// for local IaC management.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _dockerComposeIacProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'DockerComposeIacProvider',
      inputKind: 'DeployPlan',
      outputKind: 'DockerComposeYaml',
      capabilities: JSON.stringify(['yaml', 'services', 'networks']),
      providerKey: 'docker-compose',
      providerType: 'iac',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generate(input: Record<string, unknown>) {
    const plan = input.plan as string;

    const composeFileId = `compose-iac-${plan}-${Date.now()}`;
    const composePath = `./docker-compose-${plan}.yml`;
    const files = [composePath];

    let p = createProgram();
    p = put(p, 'composeFile', composeFileId, {
      composePath,
      projectName: `project-${plan}`,
      services: JSON.stringify([]),
      runningContainers: JSON.stringify([]),
      lastAppliedAt: null,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      composeFile: composeFileId,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  preview(input: Record<string, unknown>) {
    const composeFile = input.composeFile as string;

    let p = createProgram();
    p = spGet(p, 'composeFile', composeFile, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', {
        composeFile,
        toCreate: 0,
        toUpdate: 0,
        toDelete: 0,
      }),
      (b) => complete(b, 'ok', {
        composeFile,
        toCreate: 0,
        toUpdate: 0,
        toDelete: 0,
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  apply(input: Record<string, unknown>) {
    const composeFile = input.composeFile as string;

    let p = createProgram();
    p = spGet(p, 'composeFile', composeFile, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'composeFile', composeFile, {
          services: JSON.stringify(['app', 'db', 'redis']),
          runningContainers: JSON.stringify([]),
          lastAppliedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {
          composeFile,
          created: [],
          updated: [],
        });
      },
      (b) => complete(b, 'ok', {
        composeFile,
        created: [],
        updated: [],
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  teardown(input: Record<string, unknown>) {
    const composeFile = input.composeFile as string;

    let p = createProgram();
    p = spGet(p, 'composeFile', composeFile, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'composeFile', composeFile, {
          runningContainers: JSON.stringify([]),
          services: JSON.stringify([]),
          lastAppliedAt: new Date().toISOString(),
        });
        b2 = del(b2, 'composeFile', composeFile);
        return complete(b2, 'ok', {
          composeFile,
          destroyed: [],
        });
      },
      (b) => {
        let b2 = del(b, 'composeFile', composeFile);
        return complete(b2, 'ok', {
          composeFile,
          destroyed: [],
        });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const dockerComposeIacProviderHandler = autoInterpret(_dockerComposeIacProviderHandler);

