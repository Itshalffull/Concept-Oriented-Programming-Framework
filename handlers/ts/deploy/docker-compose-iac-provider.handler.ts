// DockerComposeIacProvider Concept Implementation
// Docker Compose IaC provider. Generates Compose files from deploy plans,
// previews changes, applies services, and handles teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'dciac';

export const dockerComposeIacProviderHandler: ConceptHandler = {
  async generate(input, storage) {
    const plan = input.plan as string;

    const composeFileId = `compose-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['docker-compose.yml'];

    // Store concept state only — file output is routed through Emitter via syncs
    await storage.put(RELATION, composeFileId, {
      composeFile: composeFileId,
      plan,
      status: 'generated',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', composeFile: composeFileId, files };
  },

  async preview(input, storage) {
    const composeFile = input.composeFile as string;

    return {
      variant: 'ok',
      composeFile,
      toCreate: 0,
      toUpdate: 0,
      toDelete: 0,
    };
  },

  async apply(input, storage) {
    const composeFile = input.composeFile as string;

    const record = await storage.get(RELATION, composeFile);
    if (record) {
      await storage.put(RELATION, composeFile, {
        ...record,
        status: 'applied',
        appliedAt: new Date().toISOString(),
      });
    }

    return { variant: 'ok', composeFile, created: [], updated: [] };
  },

  async teardown(input, storage) {
    const composeFile = input.composeFile as string;

    const record = await storage.get(RELATION, composeFile);
    if (!record) {
      return { variant: 'ok', composeFile, destroyed: [] };
    }

    await storage.del(RELATION, composeFile);
    return { variant: 'ok', composeFile, destroyed: [composeFile] };
  },
};
