// DockerComposeIacProvider Concept Implementation
// Generate and apply Docker Compose files from COPF deploy plans. Owns
// the compose file path, service definitions, and running container state
// for local IaC management.
import type { ConceptHandler } from '@copf/kernel';

export const dockerComposeIacProviderHandler: ConceptHandler = {
  async generate(input, storage) {
    const plan = input.plan as string;

    const composeFileId = `compose-iac-${plan}-${Date.now()}`;
    const composePath = `./docker-compose-${plan}.yml`;
    const files = [composePath];

    await storage.put('composeFile', composeFileId, {
      composePath,
      projectName: `project-${plan}`,
      services: JSON.stringify([]),
      runningContainers: JSON.stringify([]),
      lastAppliedAt: null,
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      composeFile: composeFileId,
      files,
    };
  },

  async preview(input, storage) {
    const composeFile = input.composeFile as string;

    const record = await storage.get('composeFile', composeFile);
    if (!record) {
      return {
        variant: 'ok',
        composeFile,
        toCreate: 0,
        toUpdate: 0,
        toDelete: 0,
      };
    }

    const runningContainers: string[] = JSON.parse(record.runningContainers as string);
    const services: string[] = JSON.parse(record.services as string);

    const toCreate = Math.max(0, services.length - runningContainers.length);
    const toUpdate = Math.min(services.length, runningContainers.length);
    const toDelete = Math.max(0, runningContainers.length - services.length);

    return {
      variant: 'ok',
      composeFile,
      toCreate,
      toUpdate,
      toDelete,
    };
  },

  async apply(input, storage) {
    const composeFile = input.composeFile as string;

    const record = await storage.get('composeFile', composeFile);
    if (!record) {
      return {
        variant: 'ok',
        composeFile,
        created: [],
        updated: [],
      };
    }

    const services: string[] = JSON.parse(record.services as string);
    const defaultServices = services.length > 0 ? services : ['app', 'db', 'redis'];
    const containers = defaultServices.map(s => `${record.projectName}-${s}-1`);

    await storage.put('composeFile', composeFile, {
      ...record,
      services: JSON.stringify(defaultServices),
      runningContainers: JSON.stringify(containers),
      lastAppliedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      composeFile,
      created: containers,
      updated: [],
    };
  },

  async teardown(input, storage) {
    const composeFile = input.composeFile as string;

    const record = await storage.get('composeFile', composeFile);
    const destroyed: string[] = record
      ? JSON.parse(record.runningContainers as string)
      : [];

    if (record) {
      await storage.put('composeFile', composeFile, {
        ...record,
        runningContainers: JSON.stringify([]),
        services: JSON.stringify([]),
        lastAppliedAt: new Date().toISOString(),
      });
    }

    await storage.delete('composeFile', composeFile);

    return {
      variant: 'ok',
      composeFile,
      destroyed,
    };
  },
};
