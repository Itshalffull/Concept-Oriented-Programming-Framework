// @migrated dsl-constructs 2026-03-18
// VercelRuntime Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, find, put, del, putFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _vercelRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string; const teamId = input.teamId as string; const framework = input.framework as string;
    const projectId = `prj-${concept.toLowerCase()}-${Date.now()}`; const endpoint = `https://${concept.toLowerCase()}.vercel.app`;
    let p = createProgram();
    p = put(p, 'project', projectId, { projectId, teamId, framework, regions: JSON.stringify(['iad1','sfo1','cdg1']), deploymentUrl: null, currentDeploymentId: null, previousDeploymentId: null, productionUrl: endpoint, createdAt: new Date().toISOString() });
    return complete(p, 'ok', { project: projectId, projectId, endpoint }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    const project = input.project as string; const sourceDirectory = input.sourceDirectory as string;
    let p = createProgram();
    p = spGet(p, 'project', project, 'record');
    p = branch(p, 'record',
      (b) => {
        if (sourceDirectory.includes('invalid') || sourceDirectory.includes('broken')) {
          return complete(b, 'buildFailed', { project, errors: ['Build failed: invalid source directory or missing build configuration'] });
        }
        const deploymentId = `dpl-${Date.now()}`;
        let b2 = putFrom(b, 'project', project, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, currentDeploymentId: deploymentId, previousDeploymentId: record.currentDeploymentId, deploymentUrl: `https://${record.projectId}-${deploymentId}.vercel.app`, lastDeployedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { project, deploymentId, deploymentUrl: '' });
      },
      (b) => complete(b, 'buildFailed', { project, errors: ['Project not found'] }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const project = input.project as string; const weight = input.weight as number;
    let p = createProgram();
    p = spGet(p, 'project', project, 'record');
    p = branch(p, 'record',
      (b) => { let b2 = putFrom(b, 'project', project, (bindings) => ({ ...(bindings.record as Record<string, unknown>), trafficWeight: weight })); return complete(b2, 'ok', { project }); },
      (b) => complete(b, 'ok', { project }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const project = input.project as string; const targetDeploymentId = input.targetDeploymentId as string;
    let p = createProgram();
    p = spGet(p, 'project', project, 'record');
    p = branch(p, 'record',
      (b) => { let b2 = putFrom(b, 'project', project, (bindings) => { const r = bindings.record as Record<string, unknown>; return { ...r, currentDeploymentId: targetDeploymentId, previousDeploymentId: r.currentDeploymentId, lastDeployedAt: new Date().toISOString() }; }); return complete(b2, 'ok', { project, restoredDeploymentId: targetDeploymentId }); },
      (b) => complete(b, 'ok', { project, restoredDeploymentId: targetDeploymentId }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const project = input.project as string;
    let p = createProgram();
    p = del(p, 'project', project);
    return complete(p, 'ok', { project }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const vercelRuntimeHandler = autoInterpret(_vercelRuntimeHandler);

