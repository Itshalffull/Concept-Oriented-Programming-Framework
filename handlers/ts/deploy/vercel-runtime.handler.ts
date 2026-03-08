// VercelRuntime Concept Implementation
// Vercel provider for the Runtime coordination concept. Manages project
// provisioning, deployment, traffic splitting, and teardown via the Vercel API.
import type { ConceptHandler } from '../../../runtime/types.js';
import { execSync } from 'child_process';
import path from 'path';

const RELATION = 'vercel';

function getVercelToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN environment variable is required');
  return token;
}

function getTeamId(): string | undefined {
  return process.env.VERCEL_TEAM_ID;
}

async function vercelApi(method: string, apiPath: string, body?: unknown): Promise<any> {
  const token = getVercelToken();
  const teamId = getTeamId();
  const url = new URL(`https://api.vercel.com${apiPath}`);
  if (teamId) url.searchParams.set('teamId', teamId);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Vercel API ${method} ${apiPath}: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

export const vercelRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const teamId = input.teamId as string | undefined;
    const framework = input.framework as string;

    try {
      const projectName = concept.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      let data: any;
      let alreadyExists = false;

      try {
        data = await vercelApi('POST', '/v10/projects', {
          name: projectName,
          framework,
        });
      } catch (createErr) {
        // Project may already exist (409 conflict) — fetch it instead
        const errMsg = String(createErr);
        if (errMsg.includes('409') || errMsg.includes('conflict')) {
          data = await vercelApi('GET', `/v9/projects/${projectName}`);
          alreadyExists = true;
        } else {
          throw createErr;
        }
      }

      const projectId = data.id;
      const endpoint = `https://${projectName}.vercel.app`;

      await storage.put(RELATION, projectId, {
        project: projectId,
        projectName,
        concept,
        teamId: teamId || getTeamId() || '',
        framework,
        projectId,
        endpoint,
        currentDeploymentId: '',
        previousDeploymentId: '',
        status: alreadyExists ? 'alreadyProvisioned' : 'provisioned',
        createdAt: new Date().toISOString(),
      });

      return {
        variant: alreadyExists ? 'alreadyProvisioned' : 'ok',
        project: projectId,
        projectId,
        endpoint,
      };
    } catch (err) {
      return { variant: 'domainConflict', domain: concept, existingProject: String(err) };
    }
  },

  async deploy(input, storage) {
    const project = input.project as string;
    const sourceDirectory = input.sourceDirectory as string;

    // Look up by project ID first, then by concept name (for sync-routed calls
    // where project is the Runtime instance ID, not the Vercel project ID)
    let record = await storage.get(RELATION, project);
    if (!record) {
      const byName = await storage.find(RELATION, { concept: project });
      if (byName.length > 0) {
        record = byName[0];
      } else {
        const byProjectName = await storage.find(RELATION, {
          projectName: project.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        });
        record = byProjectName.length > 0 ? byProjectName[0] : null;
      }
    }
    if (!record) {
      return { variant: 'buildFailed', project, errors: ['Project not found in storage'] };
    }

    try {
      const projectName = record.projectName as string;
      const resolvedSourceDir = path.resolve(sourceDirectory);
      const appSubdir = path.basename(resolvedSourceDir);

      // Configure the Vercel project's rootDirectory so Vercel builds
      // from the app subdirectory within the monorepo.
      try {
        await vercelApi('PATCH', `/v9/projects/${projectName}`, {
          rootDirectory: appSubdir,
        });
      } catch {
        // Non-fatal — project settings may already be correct
      }

      // Create a deployment via Vercel API.
      // Git-based deployments clone the full monorepo, so cross-directory
      // imports (../runtime/, ../framework-handlers/) resolve correctly.
      // The rootDirectory setting tells Vercel to build from the app subdir.
      const deployData = await vercelApi('POST', '/v13/deployments', {
        name: projectName,
        project: record.projectId as string,
        gitSource: {
          type: 'github',
          org: 'Itshalffull',
          repo: 'Concept-Oriented-Programming-Framework',
          ref: 'main',
        },
      });

      const deploymentUrl = `https://${deployData.url}`;
      const deploymentId = deployData.id;

      await storage.put(RELATION, record.projectId as string, {
        ...record,
        previousDeploymentId: record.currentDeploymentId,
        currentDeploymentId: deploymentId,
        sourceDirectory,
        status: 'deployed',
        deployedAt: new Date().toISOString(),
        deploymentUrl,
      });

      return { variant: 'ok', project, deploymentId, deploymentUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'buildFailed', project, errors: [message] };
    }
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

    try {
      const record = await storage.get(RELATION, project);
      if (!record) {
        return { variant: 'ok', project, restoredDeploymentId: targetDeploymentId };
      }

      // Use Vercel API to rollback
      const projectName = record.projectName as string;
      await vercelApi('POST', `/v9/projects/${projectName}/rollback`, {
        deploymentId: targetDeploymentId,
      });

      await storage.put(RELATION, project, {
        ...record,
        currentDeploymentId: targetDeploymentId,
        status: 'rolledback',
      });

      return { variant: 'ok', project, restoredDeploymentId: targetDeploymentId };
    } catch (err) {
      return { variant: 'ok', project, restoredDeploymentId: targetDeploymentId };
    }
  },

  async configureEnv(input, storage) {
    const project = input.project as string;
    const envVars = input.envVars as string;

    // Look up the Vercel project record
    let record = await storage.get(RELATION, project);
    if (!record) {
      const byName = await storage.find(RELATION, { concept: project });
      if (byName.length > 0) {
        record = byName[0];
      } else {
        const byProjectName = await storage.find(RELATION, {
          projectName: project.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        });
        record = byProjectName.length > 0 ? byProjectName[0] : null;
      }
    }
    if (!record) {
      return { variant: 'configFailed', project, reason: 'Project not found in storage' };
    }

    const projectId = record.projectId as string;
    const vars: Record<string, string> = JSON.parse(envVars);
    let configured = 0;

    for (const [key, value] of Object.entries(vars)) {
      try {
        // Try to create the env var first; if it already exists (409), update it
        try {
          await vercelApi('POST', `/v10/projects/${projectId}/env`, {
            key,
            value,
            type: 'encrypted',
            target: ['production', 'preview', 'development'],
          });
        } catch (createErr) {
          const errMsg = String(createErr);
          if (errMsg.includes('409') || errMsg.includes('already') || errMsg.includes('existing')) {
            // Fetch existing env vars to find the ID, then update
            const existing = await vercelApi('GET', `/v9/projects/${projectId}/env`);
            const envList = existing.envs || [];
            const found = envList.find((e: Record<string, unknown>) => e.key === key);
            if (found) {
              await vercelApi('PATCH', `/v9/projects/${projectId}/env/${found.id}`, {
                value,
              });
            }
          } else {
            throw createErr;
          }
        }
        configured++;
      } catch (err) {
        // Log but continue — partial configuration is better than none
        console.error(`  Failed to set ${key} on ${projectId}: ${err}`);
      }
    }

    return { variant: 'ok', project, configured };
  },

  async destroy(input, storage) {
    const project = input.project as string;

    const record = await storage.get(RELATION, project);
    if (!record) {
      return { variant: 'ok', project };
    }

    try {
      const projectName = record.projectName as string;
      await vercelApi('DELETE', `/v10/projects/${projectName}`);
    } catch {
      // Project may already be deleted
    }

    await storage.del(RELATION, project);
    return { variant: 'ok', project };
  },
};
