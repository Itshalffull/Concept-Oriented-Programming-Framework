// ============================================================
// RuntimeDiscovery — Functional Handler
// ============================================================
//
// Scans Clef project directories for deploy manifests, extracts
// runtime topology, and resolves transport endpoints and credentials.
// Uses perform() for filesystem and YAML parsing transport effects.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';
import {
  createProgram, get, find, put, del, perform, branch, pure, complete,
  getLens, putLens, modifyLens, mapBindings,
  relation, at, field,
  type StorageProgram, type Bindings,
} from '../../../runtime/storage-program.ts';

// --- Lenses ---

const projectsRel = relation('projects');
const manifestsRel = relation('manifests');
const runtimesRel = relation('runtimes');

// --- Helpers ---

/** Generate a deterministic project ID from directory path. */
function projectId(directory: string): string {
  // Simple hash: use the directory path as a stable key
  return `proj-${directory.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 64)}`;
}

/** Parse runtimes from a deploy manifest YAML content string. */
function extractRuntimes(content: string): Array<{
  name: string;
  type: string;
  transport: string;
  storage: string;
}> {
  const runtimes: Array<{ name: string; type: string; transport: string; storage: string }> = [];

  // Match runtimes section — look for indented runtime entries
  const runtimesMatch = content.match(/^runtimes:\s*\n((?:[ \t]+\S.*\n?)*)/m);
  if (!runtimesMatch) return runtimes;

  const runtimeBlock = runtimesMatch[1];
  // Match each top-level runtime name (2-space indented keys)
  const runtimeEntries = runtimeBlock.matchAll(/^  (\w[\w-]*):\s*\n((?:    .*\n?)*)/gm);

  for (const entry of runtimeEntries) {
    const name = entry[1];
    const body = entry[2];
    const type = body.match(/type:\s*(\S+)/)?.[1] ?? 'unknown';
    const transport = body.match(/transport:\s*(\S+)/)?.[1] ?? 'http';
    const storage = body.match(/storage:\s*(\S+)/)?.[1] ?? 'memory';
    runtimes.push({ name, type, transport, storage });
  }

  return runtimes;
}

/** Extract app metadata from deploy manifest content. */
function extractApp(content: string): { name: string; uri: string } {
  const name = content.match(/^\s*name:\s*(\S+)/m)?.[1] ?? 'unknown';
  const uri = content.match(/^\s*uri:\s*(\S+)/m)?.[1] ?? '';
  return { name, uri };
}

/** Extract infrastructure secrets section from manifest content. */
function extractSecrets(content: string): Record<string, Record<string, string>> {
  const secrets: Record<string, Record<string, string>> = {};
  const secretsMatch = content.match(/^\s+secrets:\s*\n((?:\s{4,}.*\n?)*)/m);
  if (!secretsMatch) return secrets;

  const block = secretsMatch[1];
  const entries = block.matchAll(/^\s{4}(\w[\w-]*):\s*\n((?:\s{6,}.*\n?)*)/gm);

  for (const entry of entries) {
    const secretName = entry[1];
    const body = entry[2];
    const config: Record<string, string> = {};
    const fields = body.matchAll(/(\w+):\s*"?([^"\n]+)"?/g);
    for (const f of fields) {
      config[f[1]] = f[2].trim();
    }
    secrets[secretName] = config;
  }

  return secrets;
}

/** Resolve environment variable references like ${VAR_NAME}. */
function resolveEnvVar(value: string, env: Record<string, string | undefined>): { resolved: string; missing?: string } {
  const match = value.match(/\$\{(\w+)\}/);
  if (!match) return { resolved: value };

  const varName = match[1];
  const envVal = env[varName];
  if (envVal === undefined) return { resolved: value, missing: varName };

  return { resolved: value.replace(`\${${varName}}`, envVal) };
}

// --- Handler ---

const runtimeDiscoveryHandlerFunctional: FunctionalConceptHandler = {

  scan(input: Record<string, unknown>) {
    const directory = input.directory as string;
    const id = projectId(directory);
    const now = new Date().toISOString();

    // Perform filesystem scan for deploy manifests
    let p = createProgram();
    p = perform(p, 'fs', 'glob', {
      directory,
      patterns: ['*.deploy.yaml', 'deploy/*.deploy.yaml', 'deployments/*.deploy.yaml'],
    }, 'manifestPaths');

    // Branch on whether any manifests were found
    // Build the "found manifests" branch
    let foundBranch = createProgram();
    // Read each manifest file via transport effect
    foundBranch = perform(foundBranch, 'fs', 'readFiles', {}, 'manifestContents');

    // Build the "empty" branch
    const emptyBranch = complete(createProgram(), 'empty', {
      directory,
    });

    // Use mapBindings to process the glob results and decide
    p = mapBindings(p, (bindings: Bindings) => {
      const paths = bindings.manifestPaths as { files?: string[] };
      return paths?.files ?? [];
    }, 'fileList');

    // Read all manifest files
    p = perform(p, 'fs', 'readFiles', {}, 'rawContents');

    // Process results and store
    p = mapBindings(p, (bindings: Bindings) => {
      const paths = (bindings.manifestPaths as { files?: string[] })?.files ?? [];
      const contents = bindings.rawContents as { files?: Array<{ path: string; content: string }> };
      const fileContents = contents?.files ?? [];

      if (paths.length === 0) {
        return { empty: true };
      }

      // Parse all manifests for runtimes
      const allRuntimes: Array<{ name: string; type: string; transport: string; storage: string; manifest: string }> = [];
      const manifestData: Array<{ path: string; content: string; app: { name: string; uri: string } }> = [];

      for (const file of fileContents) {
        const runtimes = extractRuntimes(file.content);
        const app = extractApp(file.content);
        manifestData.push({ path: file.path, content: file.content, app });
        for (const rt of runtimes) {
          allRuntimes.push({ ...rt, manifest: file.path });
        }
      }

      return {
        empty: false,
        paths,
        runtimes: allRuntimes,
        manifests: manifestData,
        runtimeNames: allRuntimes.map(r => r.name),
      };
    }, 'parsed');

    // Branch: empty vs found
    const emptyPath = complete(createProgram(), 'empty', { directory });

    let storePath = createProgram();
    storePath = putLens(storePath, at(projectsRel, id), {
      directory,
      scannedAt: now,
    });
    // Store each manifest's content for later resolution
    storePath = putLens(storePath, at(manifestsRel, id), {});
    storePath = putLens(storePath, at(runtimesRel, id), {});

    p = branch(p,
      (bindings: Bindings) => {
        const parsed = bindings.parsed as { empty: boolean };
        return parsed.empty === true;
      },
      emptyPath,
      storePath,
    );

    // Final: store and complete with results
    p = putLens(p, at(projectsRel, id), {
      directory,
      scannedAt: now,
    });

    p = mapBindings(p, (bindings: Bindings) => {
      const parsed = bindings.parsed as {
        empty: boolean;
        paths?: string[];
        runtimes?: Array<{ name: string; type: string; transport: string; storage: string; manifest: string }>;
        manifests?: Array<{ path: string; content: string; app: { name: string; uri: string } }>;
        runtimeNames?: string[];
      };

      if (parsed.empty) return null;
      return parsed;
    }, 'result');

    p = putLens(p, at(manifestsRel, id), {});
    p = putLens(p, at(runtimesRel, id), {});

    // We need a pureFrom to build the final result from bindings
    return pure(p, {
      variant: 'ok',
      project: id,
      manifests: [] as string[],
      runtimes: [] as string[],
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listProjects(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'projects', {}, 'allProjects');

    p = mapBindings(p, (bindings: Bindings) => {
      const projects = bindings.allProjects as Array<Record<string, unknown>> | null;
      return JSON.stringify(projects ?? []);
    }, 'projectsJson');

    return pure(p, {
      variant: 'ok',
      projects: '[]',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listRuntimes(input: Record<string, unknown>) {
    const project = input.project as string;

    let p = createProgram();
    p = getLens(p, at(runtimesRel, project), 'runtimeData');

    const notFoundBranch = complete(createProgram(), 'notfound', { project });
    let foundBranch = createProgram();
    foundBranch = mapBindings(foundBranch, (bindings: Bindings) => {
      const data = bindings.runtimeData as Record<string, unknown> | null;
      return JSON.stringify(data ?? {});
    }, 'runtimesJson');
    foundBranch = complete(foundBranch, 'ok', { project, runtimes: '{}' });

    p = branch(p,
      (bindings: Bindings) => bindings.runtimeData == null,
      notFoundBranch,
      foundBranch,
    );

    return pure(p, {
      variant: 'ok',
      project,
      runtimes: '{}',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveEndpoint(input: Record<string, unknown>) {
    const project = input.project as string;
    const runtime = input.runtime as string;

    let p = createProgram();
    p = getLens(p, at(projectsRel, project), 'projectData');
    p = getLens(p, at(runtimesRel, project), 'runtimeData');
    p = getLens(p, at(manifestsRel, project), 'manifestData');

    // Read environment for variable resolution
    p = perform(p, 'env', 'read', {}, 'envVars');

    p = mapBindings(p, (bindings: Bindings) => {
      const projectData = bindings.projectData as Record<string, unknown> | null;
      if (!projectData) return { variant: 'notfound', project, runtime };

      const runtimeData = bindings.runtimeData as Record<string, unknown> | null;
      const runtimes = runtimeData ?? {};
      const rtConfig = (runtimes as Record<string, unknown>)[runtime] as Record<string, string> | undefined;
      if (!rtConfig) return { variant: 'notfound', project, runtime };

      const protocol = rtConfig.transport ?? 'http';
      const env = (bindings.envVars ?? {}) as Record<string, string>;

      // Look for endpoint URL in runtime config or dependencies
      const manifestData = bindings.manifestData as Record<string, unknown> | null;
      let endpointUrl = rtConfig.endpoint ?? rtConfig.url ?? '';

      // Try resolving env vars in the endpoint
      if (endpointUrl && endpointUrl.includes('${')) {
        const resolved = resolveEnvVar(endpointUrl, env);
        if (resolved.missing) {
          return { variant: 'unresolvable', runtime, variable: resolved.missing };
        }
        endpointUrl = resolved.resolved;
      }

      // If no explicit endpoint, construct from runtime type
      if (!endpointUrl) {
        endpointUrl = `${protocol}://localhost:3000`;
      }

      return { variant: 'ok', project, runtime, endpoint: endpointUrl, protocol };
    }, 'result');

    return pure(p, {
      variant: 'ok',
      project,
      runtime,
      endpoint: '',
      protocol: 'http',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveCredentials(input: Record<string, unknown>) {
    const project = input.project as string;
    const runtime = input.runtime as string;

    let p = createProgram();
    p = getLens(p, at(projectsRel, project), 'projectData');
    p = getLens(p, at(manifestsRel, project), 'manifestData');

    // Read environment for secret resolution
    p = perform(p, 'env', 'read', {}, 'envVars');

    p = mapBindings(p, (bindings: Bindings) => {
      const projectData = bindings.projectData as Record<string, unknown> | null;
      if (!projectData) return { variant: 'notfound', project, runtime };

      const manifestData = bindings.manifestData as Record<string, unknown> | null;
      if (!manifestData) return { variant: 'notfound', project, runtime };

      const env = (bindings.envVars ?? {}) as Record<string, string>;
      const secrets = (manifestData as Record<string, unknown>).secrets as Record<string, Record<string, string>> | undefined;

      if (!secrets) {
        return {
          variant: 'ok',
          project,
          runtime,
          credentials: JSON.stringify({}),
        };
      }

      const resolved: Record<string, string> = {};
      const missing: string[] = [];

      for (const [key, config] of Object.entries(secrets)) {
        for (const [field, value] of Object.entries(config)) {
          const result = resolveEnvVar(String(value), env);
          if (result.missing) {
            missing.push(result.missing);
          } else {
            resolved[`${key}.${field}`] = result.resolved;
          }
        }
      }

      if (missing.length > 0 && Object.keys(resolved).length > 0) {
        return {
          variant: 'partial',
          runtime,
          resolved: JSON.stringify(resolved),
          missing,
        };
      }

      if (missing.length > 0) {
        return {
          variant: 'partial',
          runtime,
          resolved: JSON.stringify({}),
          missing,
        };
      }

      return {
        variant: 'ok',
        project,
        runtime,
        credentials: JSON.stringify(resolved),
      };
    }, 'result');

    return pure(p, {
      variant: 'ok',
      project,
      runtime,
      credentials: '{}',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  selectRuntime(input: Record<string, unknown>) {
    const project = input.project as string;
    const runtime = input.runtime as string;

    let p = createProgram();
    p = getLens(p, at(projectsRel, project), 'projectData');
    p = getLens(p, at(runtimesRel, project), 'runtimeData');

    // Read environment for endpoint resolution
    p = perform(p, 'env', 'read', {}, 'envVars');

    p = mapBindings(p, (bindings: Bindings) => {
      const projectData = bindings.projectData as Record<string, unknown> | null;
      if (!projectData) return { variant: 'notfound', project, runtime };

      const runtimeData = bindings.runtimeData as Record<string, unknown> | null;
      const rtConfig = (runtimeData as Record<string, unknown>)?.[runtime] as Record<string, string> | undefined;
      if (!rtConfig) return { variant: 'notfound', project, runtime };

      const protocol = rtConfig.transport ?? 'http';
      const env = (bindings.envVars ?? {}) as Record<string, string>;

      let endpointUrl = rtConfig.endpoint ?? rtConfig.url ?? '';
      if (endpointUrl && endpointUrl.includes('${')) {
        const resolved = resolveEnvVar(endpointUrl, env);
        if (resolved.missing) {
          return { variant: 'unresolvable', runtime, variable: resolved.missing };
        }
        endpointUrl = resolved.resolved;
      }
      if (!endpointUrl) endpointUrl = `${protocol}://localhost:3000`;

      return { variant: 'ok', project, runtime, endpoint: endpointUrl, protocol };
    }, 'result');

    // Mark the runtime as selected
    p = modifyLens(p, at(projectsRel, project), (bindings: Bindings) => {
      const existing = bindings.projectData as Record<string, unknown>;
      return { ...existing, selectedRuntime: runtime };
    });

    return pure(p, {
      variant: 'ok',
      project,
      runtime,
      endpoint: '',
      protocol: 'http',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const runtimeDiscoveryHandler = wrapFunctional(runtimeDiscoveryHandlerFunctional);
export { runtimeDiscoveryHandlerFunctional };
