// @migrated dsl-constructs 2026-03-18
// TargetProfile Concept Implementation
// Declare the technology dimensions for a project: languages, frameworks, deploy targets,
// storage adapters, and transport adapters. Profiles drive module derivation and codegen.
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

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

let nextIdVal = 1;
function makeId(): string {
  return `profile-${nextIdVal++}`;
}

export function resetTargetProfileIds() {
  nextIdVal = 1;
}

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

/** Helper to build a "set dimension" action. */
function setDimensionAction(dimension: string) {
  return async function(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues(dimension, values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      [dimension]: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  };
}

export const targetProfileHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const name = input.name as string;

    const existing = await storage.find('targetProfile', {}) as Record<string, unknown>[];
    if (existing.some(pr => pr.name === name)) {
      return { variant: 'duplicate', message: `Profile "${name}" already exists` };
    }

    const id = makeId();
    const now = new Date().toISOString();
    await storage.put('targetProfile', id, {
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
    return { variant: 'ok', profileId: id };
  },

  setBackendLanguages: setDimensionAction('backend_languages'),
  setFrontendFrameworks: setDimensionAction('frontend_frameworks'),
  setApiInterfaces: setDimensionAction('api_interfaces'),
  setSdkLanguages: setDimensionAction('sdk_languages'),
  setDeployTargets: setDimensionAction('deploy_targets'),
  setStorageAdapters: setDimensionAction('storage_adapters'),
  setTransportAdapters: setDimensionAction('transport_adapters'),

  async validate(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const profileId = input.profileId as string;

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

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
      return { variant: 'incomplete', errors: JSON.stringify(errors), warnings: JSON.stringify(warnings) };
    }

    return { variant: 'ok', warnings: JSON.stringify(warnings) };
  },

  async deriveModules(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const profileId = input.profileId as string;

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

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
    return { variant: 'ok', modules: JSON.stringify(derived) };
  },

  async listOptions(_input: Record<string, unknown>, _storage: ConceptStorage): Promise<Result> {
    const options: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(SUPPORTED_OPTIONS)) {
      options[key] = values;
    }
    return { variant: 'ok', options: JSON.stringify(options) };
  },
};
