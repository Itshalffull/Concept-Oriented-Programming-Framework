// @clef-handler style=functional
// VercelRuntime Concept Implementation — Functional Style
// Vercel provider for the Runtime coordination concept. Manages project
// provisioning, deployment, traffic splitting, and teardown.
// Uses perform("http", ...) for Vercel API calls, routing through the
// execution layer: ExternalCall → HttpProvider → vercel-api endpoint.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, del, pure, perform,
  type StorageProgram,
  complete,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const RELATION = 'vercel';

const _vercelRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;
    const teamId = (input.teamId as string) || '';
    const framework = input.framework as string;
    const projectName = concept.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    let p = createProgram();

    // Create project via Vercel API
    p = perform(p, 'http', 'POST', {
      endpoint: 'vercel-api',
      path: '/v10/projects',
      body: JSON.stringify({ name: projectName, framework }),
    }, 'createResponse');

    const projectId = `prj_${projectName}`;
    const endpoint = `https://${projectName}.vercel.app`;

    p = put(p, RELATION, projectId, {
      project: projectId,
      projectName,
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

    p = complete(p, 'ok', { project: projectId,
      projectId,
      endpoint });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    if (!input.project || (typeof input.project === 'string' && (input.project as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'project is required' }) as StorageProgram<Result>;
    }
    const project = input.project as string;
    const sourceDirectory = input.sourceDirectory as string;

    let p = createProgram();
    p = get(p, RELATION, project, 'projectRecord');

    // Configure rootDirectory
    p = perform(p, 'http', 'PATCH', {
      endpoint: 'vercel-api',
      path: `/v9/projects/${project}`,
      body: JSON.stringify({ rootDirectory: sourceDirectory }),
    }, 'configResponse');

    // Create deployment
    p = perform(p, 'http', 'POST', {
      endpoint: 'vercel-api',
      path: '/v13/deployments',
      body: JSON.stringify({
        name: project,
        project,
        gitSource: {
          type: 'github',
          org: 'Itshalffull',
          repo: 'Concept-Oriented-Programming-Framework',
          ref: 'main',
        },
      }),
    }, 'deployResponse');

    const deploymentId = `dpl_${Date.now()}`;
    const deploymentUrl = `https://${project}.vercel.app`;

    p = put(p, RELATION, project, {
      currentDeploymentId: deploymentId,
      sourceDirectory,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
      deploymentUrl,
    });

    p = complete(p, 'ok', { project,
      deploymentId,
      deploymentUrl });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    if (!input.project || (typeof input.project === 'string' && (input.project as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'project is required' }) as StorageProgram<Result>;
    }
    const project = input.project as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = get(p, RELATION, project, 'projectRecord');
    p = put(p, RELATION, project, { trafficWeight: weight });
    p = complete(p, 'ok', { project });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    if (!input.project || (typeof input.project === 'string' && (input.project as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'project is required' }) as StorageProgram<Result>;
    }
    const project = input.project as string;
    const targetDeploymentId = input.targetDeploymentId as string;

    if (!targetDeploymentId || targetDeploymentId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'targetDeploymentId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, project, 'projectRecord');

    // Rollback via Vercel API
    p = perform(p, 'http', 'POST', {
      endpoint: 'vercel-api',
      path: `/v9/projects/${project}/rollback`,
      body: JSON.stringify({ deploymentId: targetDeploymentId }),
    }, 'rollbackResponse');

    p = put(p, RELATION, project, {
      currentDeploymentId: targetDeploymentId,
      status: 'rolledback',
    });

    p = complete(p, 'ok', { project,
      restoredDeploymentId: targetDeploymentId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  configureEnv(input: Record<string, unknown>) {
    if (!input.project || (typeof input.project === 'string' && (input.project as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'project is required' }) as StorageProgram<Result>;
    }
    const project = input.project as string;
    const envVars = input.envVars as string;

    if (!envVars || envVars === '[]' || envVars === '{}' || envVars.trim() === '') {
      return complete(createProgram(), 'error', { message: 'envVars must not be empty' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, project, 'projectRecord');

    // Set env vars via Vercel API
    p = perform(p, 'http', 'POST', {
      endpoint: 'vercel-api',
      path: `/v10/projects/${project}/env`,
      body: envVars,
    }, 'envResponse');

    p = complete(p, 'ok', { project, configured: 0 });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    if (!input.project || (typeof input.project === 'string' && (input.project as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'project is required' }) as StorageProgram<Result>;
    }
    const project = input.project as string;

    let p = createProgram();
    p = get(p, RELATION, project, 'projectRecord');

    // Delete project via Vercel API
    p = perform(p, 'http', 'DELETE', {
      endpoint: 'vercel-api',
      path: `/v10/projects/${project}`,
      body: '',
    }, 'deleteResponse');

    p = del(p, RELATION, project);
    p = complete(p, 'ok', { project });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const vercelRuntimeHandler = autoInterpret(_vercelRuntimeHandler);
