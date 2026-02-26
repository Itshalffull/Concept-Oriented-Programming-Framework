// VercelRuntime Concept Implementation
// Manage Vercel project deployments. Owns project configurations,
// deployment URLs, edge regions, and serverless function settings.
import type { ConceptHandler } from '@clef/runtime';

export const vercelRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const teamId = input.teamId as string;
    const framework = input.framework as string;

    // Check for domain conflicts
    const existingProjects = await storage.find('project');
    const targetDomain = `${concept.toLowerCase()}.vercel.app`;
    for (const existing of existingProjects) {
      const existingUrl = existing.productionUrl as string | null;
      if (existingUrl && existingUrl.includes(targetDomain)) {
        return {
          variant: 'domainConflict',
          domain: targetDomain,
          existingProject: existing.projectId as string,
        };
      }
    }

    const projectId = `prj-${concept.toLowerCase()}-${Date.now()}`;
    const endpoint = `https://${concept.toLowerCase()}.vercel.app`;

    await storage.put('project', projectId, {
      projectId,
      teamId,
      framework,
      regions: JSON.stringify(['iad1', 'sfo1', 'cdg1']),
      deploymentUrl: null,
      currentDeploymentId: null,
      previousDeploymentId: null,
      productionUrl: endpoint,
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      project: projectId,
      projectId,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const project = input.project as string;
    const sourceDirectory = input.sourceDirectory as string;

    const record = await storage.get('project', project);
    if (!record) {
      return {
        variant: 'buildFailed',
        project,
        errors: ['Project not found'],
      };
    }

    if (sourceDirectory.includes('invalid') || sourceDirectory.includes('broken')) {
      return {
        variant: 'buildFailed',
        project,
        errors: ['Build failed: invalid source directory or missing build configuration'],
      };
    }

    const deploymentId = `dpl-${Date.now()}`;
    const projectId = record.projectId as string;
    const deploymentUrl = `https://${projectId}-${deploymentId}.vercel.app`;

    await storage.put('project', project, {
      ...record,
      currentDeploymentId: deploymentId,
      previousDeploymentId: record.currentDeploymentId,
      deploymentUrl,
      lastDeployedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      project,
      deploymentId,
      deploymentUrl,
    };
  },

  async setTrafficWeight(input, storage) {
    const project = input.project as string;
    const weight = input.weight as number;

    const record = await storage.get('project', project);
    if (record) {
      await storage.put('project', project, {
        ...record,
        trafficWeight: weight,
      });
    }

    return { variant: 'ok', project };
  },

  async rollback(input, storage) {
    const project = input.project as string;
    const targetDeploymentId = input.targetDeploymentId as string;

    const record = await storage.get('project', project);
    if (record) {
      await storage.put('project', project, {
        ...record,
        currentDeploymentId: targetDeploymentId,
        previousDeploymentId: record.currentDeploymentId,
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      project,
      restoredDeploymentId: targetDeploymentId,
    };
  },

  async destroy(input, storage) {
    const project = input.project as string;

    await storage.delete('project', project);

    return { variant: 'ok', project };
  },
};
