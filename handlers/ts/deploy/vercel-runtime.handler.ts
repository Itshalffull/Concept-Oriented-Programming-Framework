// VercelRuntime Concept Implementation
// Vercel provider for the Runtime coordination concept. Manages project
// provisioning, deployment, traffic splitting, and teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'vercel';

export const vercelRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const teamId = input.teamId as string;
    const framework = input.framework as string;

    const projectId = `prj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const endpoint = `https://${concept}.vercel.app`;

    await storage.put(RELATION, projectId, {
      project: projectId,
      concept,
      teamId,
      framework,
      projectId,
      endpoint,
      currentDeploymentId: '',
      previousDeploymentId: '',
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', project: projectId, projectId, endpoint };
  },

  async deploy(input, storage) {
    const project = input.project as string;
    const sourceDirectory = input.sourceDirectory as string;

    const record = await storage.get(RELATION, project);
    if (!record) {
      return { variant: 'buildFailed', project, errors: ['Project not found'] };
    }

    const deploymentId = `dpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const deploymentUrl = `https://${deploymentId}.vercel.app`;

    await storage.put(RELATION, project, {
      ...record,
      previousDeploymentId: record.currentDeploymentId,
      currentDeploymentId: deploymentId,
      sourceDirectory,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', project, deploymentId, deploymentUrl };
  },

  async setTrafficWeight(input, storage) {
    const project = input.project as string;
    const weight = input.weight as number;

    const record = await storage.get(RELATION, project);
    if (record) {
      await storage.put(RELATION, project, { ...record, trafficWeight: weight });
    }

    return { variant: 'ok', project };
  },

  async rollback(input, storage) {
    const project = input.project as string;
    const targetDeploymentId = input.targetDeploymentId as string;

    const record = await storage.get(RELATION, project);
    if (record) {
      await storage.put(RELATION, project, {
        ...record,
        currentDeploymentId: targetDeploymentId,
        status: 'rolledback',
      });
    }

    return { variant: 'ok', project, restoredDeploymentId: targetDeploymentId };
  },

  async destroy(input, storage) {
    const project = input.project as string;

    const record = await storage.get(RELATION, project);
    if (!record) {
      return { variant: 'ok', project };
    }

    await storage.del(RELATION, project);
    return { variant: 'ok', project };
  },
};
