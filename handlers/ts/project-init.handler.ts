// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ProjectInit Concept Implementation
// Orchestrate project scaffolding: create the init record, write clef.yaml and interface/deploy
// manifests, emit derived concept files, then advance through install and generate stages.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;
function makeId(): string {
  return `init-${nextId++}`;
}

export function resetProjectInitIds() {
  nextId = 1;
}

/** Map API interface names to their manifest format. */
const INTERFACE_MANIFEST_MAP: Record<string, { filename: string; format: string }> = {
  rest: { filename: 'openapi.yaml', format: 'openapi-3.1' },
  graphql: { filename: 'schema.graphql', format: 'graphql-sdl' },
  grpc: { filename: 'service.proto', format: 'protobuf-3' },
  cli: { filename: 'cli.yaml', format: 'clef-cli' },
  mcp: { filename: 'mcp.yaml', format: 'mcp-manifest' },
  'claude-skills': { filename: 'skills.yaml', format: 'claude-skills' },
};

/** Map deploy target names to their manifest format. */
const DEPLOY_MANIFEST_MAP: Record<string, { filename: string; format: string }> = {
  local: { filename: 'docker-compose.yaml', format: 'docker-compose' },
  vercel: { filename: 'vercel.json', format: 'vercel' },
  lambda: { filename: 'serverless.yaml', format: 'serverless' },
  cloudrun: { filename: 'cloudrun.yaml', format: 'cloud-run' },
  cloudflare: { filename: 'wrangler.toml', format: 'cloudflare-workers' },
  k8s: { filename: 'k8s/', format: 'kubernetes' },
  'docker-compose': { filename: 'docker-compose.yaml', format: 'docker-compose' },
};

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const projectName = input.project_name as string;
    const projectPath = input.project_path as string;

    if (!projectName || projectName.trim().length === 0) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Project name is required' }) as StorageProgram<Result>;
    }

    let moduleList: string[];
    try {
      const parsed = JSON.parse(input.module_list as string);
      moduleList = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Non-JSON string: treat as a single module name
      const raw = (input.module_list as string) || '';
      moduleList = raw.trim() ? [raw.trim()] : [];
    }

    let profile: Record<string, unknown>;
    try {
      profile = JSON.parse((input.profile as string) || '{}') as Record<string, unknown>;
    } catch {
      profile = {};
    }

    let derivedConcepts: Array<{ name: string; composes: string[] }>;
    try {
      derivedConcepts = JSON.parse((input.derived_concepts as string) || '[]') as Array<{ name: string; composes: string[] }>;
      if (!Array.isArray(derivedConcepts)) derivedConcepts = [];
    } catch {
      derivedConcepts = [];
    }

    if (moduleList.length === 0) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Module list cannot be empty' }) as StorageProgram<Result>;
    }

    const id = makeId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'projectInit', id, {
      id,
      projectName,
      projectPath,
      moduleList: JSON.stringify(moduleList),
      profile: JSON.stringify(profile),
      derivedConcepts: JSON.stringify(derivedConcepts),
      status: 'scaffolding',
      manifests: JSON.stringify([]),
      interfaceManifests: JSON.stringify([]),
      deployManifests: JSON.stringify([]),
      derivedFiles: JSON.stringify([]),
      createdAt: now,
      updatedAt: now,
    });

    return complete(p, 'ok', { init: id, status: 'scaffolding' }) as StorageProgram<Result>;
  },

  writeManifest(input: Record<string, unknown>) {
    const initId = input.init as string;

    let p = createProgram();
    p = get(p, 'projectInit', initId, 'init');

    return branch(p, 'init',
      (thenP) => {
        // Persist the manifest in the init record
        thenP = putFrom(thenP, 'projectInit', initId, (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          return { ...init, manifests: JSON.stringify(['clef.yaml']) };
        });

        return completeFrom(thenP, 'ok', (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const projectName = init.projectName as string;
          const moduleList = JSON.parse(init.moduleList as string) as string[];
          const profile = JSON.parse(init.profile as string) as Record<string, unknown>;

          const packages: Record<string, { version: string; features?: string[] }> = {};
          for (const mod of moduleList) {
            if (mod.startsWith('derived:')) continue;
            packages[mod] = { version: 'latest' };
          }

          const manifest = {
            name: projectName,
            version: '0.1.0',
            clef: '1.0',
            profile: {
              backend_languages: profile.backend_languages || [],
              frontend_frameworks: profile.frontend_frameworks || [],
              api_interfaces: profile.api_interfaces || [],
              deploy_targets: profile.deploy_targets || [],
            },
            packages,
          };

          const manifestContent = JSON.stringify(manifest, null, 2);
          return { status: 'resolving', manifest: manifestContent };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Init record "${initId}" not found` }),
    ) as StorageProgram<Result>;
  },

  writeInterfaceManifests(input: Record<string, unknown>) {
    const initId = input.init as string;

    let p = createProgram();
    p = get(p, 'projectInit', initId, 'init');

    return branch(p, 'init',
      (thenP) => {
        // Persist the interface manifests in the init record
        thenP = putFrom(thenP, 'projectInit', initId, (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const profile = JSON.parse(init.profile as string) as Record<string, unknown>;
          const apiInterfaces = (profile.api_interfaces as string[]) || [];
          const moduleList = JSON.parse(init.moduleList as string) as string[];

          const concepts = moduleList.filter(m => !m.startsWith('derived:') && !m.endsWith('Adapter')
            && !m.endsWith('Runtime') && !m.endsWith('Target') && !m.endsWith('Transport')
            && !m.endsWith('Provider') && !m.endsWith('Spec'));

          const interfaceManifests: Array<{ path: string; format: string }> = [];

          for (const iface of apiInterfaces) {
            const mapping = INTERFACE_MANIFEST_MAP[iface];
            if (!mapping) continue;
            interfaceManifests.push({
              path: `interfaces/${mapping.filename}`,
              format: mapping.format,
            });
          }

          return { ...init, interfaceManifests: JSON.stringify(interfaceManifests) };
        });

        return completeFrom(thenP, 'ok', (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const profile = JSON.parse(init.profile as string) as Record<string, unknown>;
          const apiInterfaces = (profile.api_interfaces as string[]) || [];
          const moduleList = JSON.parse(init.moduleList as string) as string[];

          const concepts = moduleList.filter(m => !m.startsWith('derived:') && !m.endsWith('Adapter')
            && !m.endsWith('Runtime') && !m.endsWith('Target') && !m.endsWith('Transport')
            && !m.endsWith('Provider') && !m.endsWith('Spec'));

          const interfaceManifests: Array<{ path: string; format: string; content: string }> = [];

          for (const iface of apiInterfaces) {
            const mapping = INTERFACE_MANIFEST_MAP[iface];
            if (!mapping) continue;

            const manifest = {
              format: mapping.format,
              interface: iface,
              concepts,
              generatedAt: new Date().toISOString(),
            };

            interfaceManifests.push({
              path: `interfaces/${mapping.filename}`,
              format: mapping.format,
              content: JSON.stringify(manifest, null, 2),
            });
          }

          return {
            count: interfaceManifests.length,
            interfaces: JSON.stringify(interfaceManifests.map(m => m.path)),
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Init record "${initId}" not found` }),
    ) as StorageProgram<Result>;
  },

  writeDeployManifests(input: Record<string, unknown>) {
    const initId = input.init as string;

    let p = createProgram();
    p = get(p, 'projectInit', initId, 'init');

    return branch(p, 'init',
      (thenP) => {
        // Persist deploy manifests in the init record
        thenP = putFrom(thenP, 'projectInit', initId, (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const profile = JSON.parse(init.profile as string) as Record<string, unknown>;
          const deployTargets = (profile.deploy_targets as string[]) || [];

          const deployManifests: Array<{ path: string; format: string }> = [];
          for (const target of deployTargets) {
            const mapping = DEPLOY_MANIFEST_MAP[target];
            if (!mapping) continue;
            deployManifests.push({ path: `deploy/${mapping.filename}`, format: mapping.format });
          }

          return { ...init, deployManifests: JSON.stringify(deployManifests) };
        });

        return completeFrom(thenP, 'ok', (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const profile = JSON.parse(init.profile as string) as Record<string, unknown>;
          const deployTargets = (profile.deploy_targets as string[]) || [];
          const projectName = init.projectName as string;

          const deployManifests: Array<{ path: string; format: string; content: string }> = [];

          for (const target of deployTargets) {
            const mapping = DEPLOY_MANIFEST_MAP[target];
            if (!mapping) continue;

            const manifest = {
              format: mapping.format,
              target,
              project: projectName,
              generatedAt: new Date().toISOString(),
            };

            deployManifests.push({
              path: `deploy/${mapping.filename}`,
              format: mapping.format,
              content: JSON.stringify(manifest, null, 2),
            });
          }

          return {
            count: deployManifests.length,
            targets: JSON.stringify(deployManifests.map(m => m.path)),
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Init record "${initId}" not found` }),
    ) as StorageProgram<Result>;
  },

  writeDerivedConcepts(input: Record<string, unknown>) {
    const initId = input.init as string;

    let p = createProgram();
    p = get(p, 'projectInit', initId, 'init');

    return branch(p, 'init',
      (thenP) => {
        // Persist derived concept files in the init record
        thenP = putFrom(thenP, 'projectInit', initId, (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const derivedConcepts = JSON.parse(init.derivedConcepts as string) as Array<{
            name: string;
            composes: string[];
          }>;

          const derivedFiles = derivedConcepts.map(d => `concepts/derived/${d.name}.derived.yaml`);
          return { ...init, derivedFiles: JSON.stringify(derivedFiles) };
        });

        return completeFrom(thenP, 'ok', (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const derivedConcepts = JSON.parse(init.derivedConcepts as string) as Array<{
            name: string;
            composes: string[];
          }>;

          const derivedFiles: Array<{ path: string; content: string }> = [];

          for (const derived of derivedConcepts) {
            const derivedContent = {
              name: derived.name,
              composes: derived.composes,
              generatedAt: new Date().toISOString(),
            };

            derivedFiles.push({
              path: `concepts/derived/${derived.name}.derived.yaml`,
              content: JSON.stringify(derivedContent, null, 2),
            });
          }

          return {
            count: derivedFiles.length,
            files: JSON.stringify(derivedFiles.map(f => f.path)),
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Init record "${initId}" not found` }),
    ) as StorageProgram<Result>;
  },

  triggerInstall(input: Record<string, unknown>) {
    const initId = input.init as string;

    let p = createProgram();
    p = get(p, 'projectInit', initId, 'init');

    return branch(p, 'init',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const moduleList = JSON.parse(init.moduleList as string) as string[];
          return { status: 'installing', moduleCount: moduleList.length };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Init record "${initId}" not found` }),
    ) as StorageProgram<Result>;
  },

  triggerGenerate(input: Record<string, unknown>) {
    const initId = input.init as string;

    let p = createProgram();
    p = get(p, 'projectInit', initId, 'init');

    return branch(p, 'init',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const interfaceManifests = JSON.parse(init.interfaceManifests as string) as unknown[];
          const deployManifests = JSON.parse(init.deployManifests as string) as unknown[];
          return {
            status: 'generating',
            interfaceCount: interfaceManifests.length,
            deployCount: deployManifests.length,
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Init record "${initId}" not found` }),
    ) as StorageProgram<Result>;
  },

  complete(input: Record<string, unknown>) {
    const initId = input.init as string;

    let p = createProgram();
    p = get(p, 'projectInit', initId, 'init');

    return branch(p, 'init',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const init = bindings.init as Record<string, unknown>;
          const moduleList = JSON.parse(init.moduleList as string) as string[];
          const interfaceManifests = JSON.parse(init.interfaceManifests as string) as unknown[];
          const deployManifests = JSON.parse(init.deployManifests as string) as unknown[];
          const derivedFiles = JSON.parse(init.derivedFiles as string) as unknown[];
          const manifests = JSON.parse(init.manifests as string) as unknown[];

          const summary = {
            projectName: init.projectName as string,
            projectPath: init.projectPath as string,
            status: 'complete',
            modules: moduleList.length,
            manifests: manifests.length,
            interfaceManifests: interfaceManifests.length,
            deployManifests: deployManifests.length,
            derivedConcepts: derivedFiles.length,
          };

          return { summary: JSON.stringify(summary) };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Init record "${initId}" not found` }),
    ) as StorageProgram<Result>;
  },
};

export const projectInitHandler = autoInterpret(_handler);
