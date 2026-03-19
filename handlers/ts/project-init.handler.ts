// ProjectInit Concept Implementation
// Orchestrate project scaffolding: create the init record, write clef.yaml and interface/deploy
// manifests, emit derived concept files, then advance through install and generate stages.
import type { ConceptHandler } from '@clef/runtime';

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

export const projectInitHandler: ConceptHandler = {
  async create(input, storage) {
    const projectName = input.project_name as string;
    const projectPath = input.project_path as string;
    const moduleList = JSON.parse(input.module_list as string) as string[];
    const profile = JSON.parse(input.profile as string) as Record<string, unknown>;
    const derivedConcepts = JSON.parse((input.derived_concepts as string) || '[]') as Array<{
      name: string;
      composes: string[];
    }>;

    if (!projectName || projectName.trim().length === 0) {
      return { variant: 'error', message: 'Project name is required' };
    }

    if (moduleList.length === 0) {
      return { variant: 'error', message: 'Module list cannot be empty' };
    }

    const id = makeId();
    const now = new Date().toISOString();

    await storage.put('projectInit', id, {
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

    return { variant: 'ok', initId: id, status: 'scaffolding' };
  },

  async writeManifest(input, storage) {
    const initId = input.init as string;

    const init = await storage.get('projectInit', initId);
    if (!init) {
      return { variant: 'notfound', message: `Init record "${initId}" not found` };
    }

    const projectName = init.projectName as string;
    const moduleList = JSON.parse(init.moduleList as string) as string[];
    const profile = JSON.parse(init.profile as string) as Record<string, unknown>;

    // Build clef.yaml content
    const packages: Record<string, { version: string; features?: string[] }> = {};
    for (const mod of moduleList) {
      if (mod.startsWith('derived:')) {
        // Derived concepts handled separately
        continue;
      }
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

    await storage.put('projectInit', initId, {
      ...init,
      manifests: JSON.stringify([{ path: 'clef.yaml', content: manifestContent }]),
      status: 'resolving',
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', status: 'resolving', manifest: manifestContent };
  },

  async writeInterfaceManifests(input, storage) {
    const initId = input.init as string;

    const init = await storage.get('projectInit', initId);
    if (!init) {
      return { variant: 'notfound', message: `Init record "${initId}" not found` };
    }

    const profile = JSON.parse(init.profile as string) as Record<string, unknown>;
    const apiInterfaces = (profile.api_interfaces as string[]) || [];
    const moduleList = JSON.parse(init.moduleList as string) as string[];

    // Filter out derived and infrastructure modules to get concept names
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

    await storage.put('projectInit', initId, {
      ...init,
      interfaceManifests: JSON.stringify(interfaceManifests),
      updatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      count: interfaceManifests.length,
      interfaces: JSON.stringify(interfaceManifests.map(m => m.path)),
    };
  },

  async writeDeployManifests(input, storage) {
    const initId = input.init as string;

    const init = await storage.get('projectInit', initId);
    if (!init) {
      return { variant: 'notfound', message: `Init record "${initId}" not found` };
    }

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

    await storage.put('projectInit', initId, {
      ...init,
      deployManifests: JSON.stringify(deployManifests),
      updatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      count: deployManifests.length,
      targets: JSON.stringify(deployManifests.map(m => m.path)),
    };
  },

  async writeDerivedConcepts(input, storage) {
    const initId = input.init as string;

    const init = await storage.get('projectInit', initId);
    if (!init) {
      return { variant: 'notfound', message: `Init record "${initId}" not found` };
    }

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

    await storage.put('projectInit', initId, {
      ...init,
      derivedFiles: JSON.stringify(derivedFiles),
      updatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      count: derivedFiles.length,
      files: JSON.stringify(derivedFiles.map(f => f.path)),
    };
  },

  async triggerInstall(input, storage) {
    const initId = input.init as string;

    const init = await storage.get('projectInit', initId);
    if (!init) {
      return { variant: 'notfound', message: `Init record "${initId}" not found` };
    }

    const moduleList = JSON.parse(init.moduleList as string) as string[];

    await storage.put('projectInit', initId, {
      ...init,
      status: 'installing',
      updatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      status: 'installing',
      moduleCount: moduleList.length,
    };
  },

  async triggerGenerate(input, storage) {
    const initId = input.init as string;

    const init = await storage.get('projectInit', initId);
    if (!init) {
      return { variant: 'notfound', message: `Init record "${initId}" not found` };
    }

    const interfaceManifests = JSON.parse(init.interfaceManifests as string) as unknown[];
    const deployManifests = JSON.parse(init.deployManifests as string) as unknown[];

    await storage.put('projectInit', initId, {
      ...init,
      status: 'generating',
      updatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      status: 'generating',
      interfaceCount: interfaceManifests.length,
      deployCount: deployManifests.length,
    };
  },

  async complete(input, storage) {
    const initId = input.init as string;

    const init = await storage.get('projectInit', initId);
    if (!init) {
      return { variant: 'notfound', message: `Init record "${initId}" not found` };
    }

    const moduleList = JSON.parse(init.moduleList as string) as string[];
    const interfaceManifests = JSON.parse(init.interfaceManifests as string) as unknown[];
    const deployManifests = JSON.parse(init.deployManifests as string) as unknown[];
    const derivedFiles = JSON.parse(init.derivedFiles as string) as unknown[];
    const manifests = JSON.parse(init.manifests as string) as unknown[];

    await storage.put('projectInit', initId, {
      ...init,
      status: 'complete',
      updatedAt: new Date().toISOString(),
    });

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

    return { variant: 'ok', summary: JSON.stringify(summary) };
  },
};
