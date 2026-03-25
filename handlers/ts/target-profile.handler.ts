// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// TargetProfile Concept Implementation
// Declare the technology dimensions for a project: languages, frameworks, deploy targets,
// storage adapters, and transport adapters. Profiles drive module derivation and codegen.

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  putFrom, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let profileCounter = 0;
function nextProfileId(): string {
  return `profile-${++profileCounter}`;
}

/** All supported option values keyed by dimension name. */
const SUPPORTED_OPTIONS: Record<string, string[]> = {
  backend_languages: ['typescript', 'rust', 'go', 'python', 'swift', 'kotlin', 'solidity'],
  frontend_frameworks: ['react', 'vue', 'svelte', 'swiftui', 'compose', 'react-native', 'ink', 'nativescript'],
  api_interfaces: ['rest', 'graphql', 'grpc', 'cli', 'mcp', 'claude-skills'],
  sdk_languages: ['typescript', 'rust', 'go', 'python', 'swift', 'kotlin'],
  deploy_targets: ['local', 'vercel', 'lambda', 'cloudrun', 'cloudflare', 'k8s', 'docker-compose'],
  storage_adapters: ['postgres', 'sqlite', 'mongodb', 'dynamodb', 'memory', 'core-data', 'localstorage'],
  transport_adapters: ['http', 'grpc', 'ws', 'nats', 'in-process'],
};

/** Map deploy targets to the infrastructure modules they require. */
const DEPLOY_MODULE_MAP: Record<string, string[]> = {
  local: ['DockerComposeRuntime'],
  vercel: ['VercelRuntime', 'EcsRuntime'],
  lambda: ['LambdaRuntime'],
  cloudrun: ['CloudRunRuntime'],
  cloudflare: ['CloudflareRuntime'],
  k8s: ['K8sRuntime', 'HelmProvider'],
  'docker-compose': ['DockerComposeRuntime'],
};

/** Map storage adapters to infrastructure modules. */
const STORAGE_MODULE_MAP: Record<string, string[]> = {
  postgres: ['PostgresAdapter'],
  sqlite: ['SqliteAdapter'],
  mongodb: ['MongoAdapter'],
  dynamodb: ['DynamoAdapter'],
  memory: ['MemoryAdapter'],
  'core-data': ['CoreDataAdapter'],
  localstorage: ['LocalStorageAdapter'],
};

/** Map API interfaces to interface generation modules. */
const API_MODULE_MAP: Record<string, string[]> = {
  rest: ['RestTarget', 'OpenApiSpec'],
  graphql: ['GraphqlTarget'],
  grpc: ['GrpcTarget', 'ProtobufSpec'],
  cli: ['CliTarget'],
  mcp: ['McpTarget'],
  'claude-skills': ['ClaudeSkillsTarget'],
};

/** Map transport adapters to transport modules. */
const TRANSPORT_MODULE_MAP: Record<string, string[]> = {
  http: ['HttpTransport'],
  grpc: ['GrpcTransport'],
  ws: ['WsTransport'],
  nats: ['NatsTransport'],
  'in-process': ['InProcessTransport'],
};

/** Validate that all values in the list belong to the supported set. */
function validateValues(dimension: string, values: string[]): string[] {
  const supported = SUPPORTED_OPTIONS[dimension];
  if (!supported) return [`Unknown dimension "${dimension}"`];
  const errors: string[] = [];
  for (const v of values) {
    if (!supported.includes(v)) {
      errors.push(`Unsupported ${dimension} value "${v}". Supported: ${supported.join(', ')}`);
    }
  }
  return errors;
}

/**
 * Factory for functional setDimension actions.
 * Each reads the profile, validates, writes back with the new dimension value.
 */
function makeFunctionalSetDimension(dimension: string): (input: Record<string, unknown>) => StorageProgram<Result> {
  return (input: Record<string, unknown>) => {
    const profileId = (input.profileId ?? input.profile) as string;

    if (!profileId) {
      return complete(createProgram(), 'notfound', {
        message: 'profileId is required',
        output: { message: 'profileId is required' },
      }) as StorageProgram<Result>;
    }

    let valuesArr: string[];
    try {
      valuesArr = JSON.parse(input.values as string) as string[];
    } catch {
      return complete(createProgram(), 'invalid', {
        errors: JSON.stringify(['Invalid JSON for values']),
        output: { errors: JSON.stringify(['Invalid JSON for values']) },
      }) as StorageProgram<Result>;
    }

    const errors = validateValues(dimension, valuesArr);
    if (errors.length > 0) {
      return complete(createProgram(), 'invalid', {
        errors: JSON.stringify(errors),
        output: { errors: JSON.stringify(errors) },
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'targetProfile', profileId, 'profile');

    return branch(p,
      (b) => !b.profile,
      (b) => complete(b, 'notfound', {
        message: `Profile "${profileId}" not found`,
        output: { message: `Profile "${profileId}" not found` },
      }) as StorageProgram<Result>,
      (b) => {
        let b2 = putFrom(b, 'targetProfile', profileId, (bindings) => {
          const profile = bindings.profile as Record<string, unknown>;
          return {
            ...profile,
            [dimension]: JSON.stringify(valuesArr),
            updatedAt: new Date().toISOString(),
          };
        });
        return complete(b2, 'ok', { output: {} }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  };
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    if (!name || (name as string).trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
        output: { message: 'name is required' },
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'targetProfile', {}, 'existing');

    return branch(p,
      (b) => {
        const profiles = b.existing as Record<string, unknown>[];
        return profiles.some(pr => pr.name === name);
      },
      (b) => complete(b, 'duplicate', {
        message: `Profile "${name}" already exists`,
        output: { message: `Profile "${name}" already exists` },
      }) as StorageProgram<Result>,
      (b) => {
        const id = nextProfileId();
        const now = new Date().toISOString();
        let b2 = put(b, 'targetProfile', id, {
          id,
          name,
          backend_languages: JSON.stringify([]),
          frontend_frameworks: JSON.stringify([]),
          api_interfaces: JSON.stringify([]),
          sdk_languages: JSON.stringify([]),
          deploy_targets: JSON.stringify([]),
          storage_adapters: JSON.stringify([]),
          transport_adapters: JSON.stringify([]),
          createdAt: now,
          updatedAt: now,
        });

        return complete(b2, 'ok', {
          profile: id, profileId: id, output: { profile: id, profileId: id },
        }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  setBackendLanguages: makeFunctionalSetDimension('backend_languages'),
  setFrontendFrameworks: makeFunctionalSetDimension('frontend_frameworks'),
  setApiInterfaces: makeFunctionalSetDimension('api_interfaces'),
  setSdkLanguages: makeFunctionalSetDimension('sdk_languages'),
  setDeployTargets: makeFunctionalSetDimension('deploy_targets'),
  setStorageAdapters: makeFunctionalSetDimension('storage_adapters'),
  setTransportAdapters: makeFunctionalSetDimension('transport_adapters'),

  validate(input: Record<string, unknown>) {
    const profileId = (input.profileId ?? input.profile) as string;

    if (!profileId) {
      const allDims = ['backend_languages', 'frontend_frameworks', 'api_interfaces',
        'sdk_languages', 'deploy_targets', 'storage_adapters', 'transport_adapters'];
      return complete(createProgram(), 'ok', {
        missing: JSON.stringify(allDims),
        warnings: JSON.stringify([]),
        output: { missing: JSON.stringify(allDims), warnings: JSON.stringify([]) },
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'targetProfile', profileId, 'profile');

    return branch(p,
      (b) => !b.profile,
      (b) => complete(b, 'notfound', {
        message: `Profile "${profileId}" not found`,
        output: { message: `Profile "${profileId}" not found` },
      }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const profile = bindings.profile as Record<string, unknown>;
        const warnings: string[] = [];
        const errors: string[] = [];

        const backendLangs = JSON.parse(profile.backend_languages as string) as string[];
        const frontendFrameworks = JSON.parse(profile.frontend_frameworks as string) as string[];
        const apiInterfaces = JSON.parse(profile.api_interfaces as string) as string[];
        const deployTargets = JSON.parse(profile.deploy_targets as string) as string[];
        const storageAdapters = JSON.parse(profile.storage_adapters as string) as string[];

        if (backendLangs.length === 0) {
          errors.push('At least one backend language must be specified');
        }
        if (frontendFrameworks.includes('swiftui') && deployTargets.includes('vercel')) {
          warnings.push('SwiftUI frontend is not deployable to Vercel');
        }
        if (frontendFrameworks.includes('compose') && deployTargets.includes('vercel')) {
          warnings.push('Compose frontend is not deployable to Vercel');
        }
        if (backendLangs.includes('solidity') && !storageAdapters.some(s => ['memory'].includes(s))) {
          warnings.push('Solidity backend typically uses on-chain storage, not traditional adapters');
        }
        if (apiInterfaces.includes('grpc') && deployTargets.includes('cloudflare')) {
          warnings.push('gRPC is not natively supported on Cloudflare Workers');
        }

        if (errors.length > 0) {
          return {
            missing: JSON.stringify(errors),
            warnings: JSON.stringify(warnings),
            output: { missing: JSON.stringify(errors), warnings: JSON.stringify(warnings) },
          };
        }
        return {
          warnings: JSON.stringify(warnings),
          output: { warnings: JSON.stringify(warnings) },
        };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  deriveModules(input: Record<string, unknown>) {
    const profileId = (input.profileId ?? input.profile) as string;

    if (!profileId) {
      return complete(createProgram(), 'notfound', {
        message: 'profileId is required',
        output: { message: 'profileId is required' },
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'targetProfile', profileId, 'profile');

    return branch(p,
      (b) => !b.profile,
      (b) => complete(b, 'notfound', {
        message: `Profile "${profileId}" not found`,
        output: { message: `Profile "${profileId}" not found` },
      }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const profile = bindings.profile as Record<string, unknown>;
        const modules = new Set<string>();

        const deployTargets = JSON.parse(profile.deploy_targets as string) as string[];
        for (const target of deployTargets) {
          const mods = DEPLOY_MODULE_MAP[target];
          if (mods) mods.forEach(m => modules.add(m));
        }

        const storageAdapters = JSON.parse(profile.storage_adapters as string) as string[];
        for (const adapter of storageAdapters) {
          const mods = STORAGE_MODULE_MAP[adapter];
          if (mods) mods.forEach(m => modules.add(m));
        }

        const apiInterfaces = JSON.parse(profile.api_interfaces as string) as string[];
        for (const iface of apiInterfaces) {
          const mods = API_MODULE_MAP[iface];
          if (mods) mods.forEach(m => modules.add(m));
        }

        const transportAdapters = JSON.parse(profile.transport_adapters as string) as string[];
        for (const transport of transportAdapters) {
          const mods = TRANSPORT_MODULE_MAP[transport];
          if (mods) mods.forEach(m => modules.add(m));
        }

        const derived = Array.from(modules).sort();
        return { modules: JSON.stringify(derived), output: { modules: JSON.stringify(derived) } };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  listOptions(_input: Record<string, unknown>) {
    const options: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(SUPPORTED_OPTIONS)) {
      options[key] = values;
    }
    const optionsJson = JSON.stringify(options);
    return complete(createProgram(), 'ok', {
      options: optionsJson,
      output: { options: optionsJson },
    }) as StorageProgram<Result>;
  },
};

export const targetProfileHandler = autoInterpret(_handler);

export function resetTargetProfileIds() {
  profileCounter = 0;
}
