// TargetProfile Concept Implementation
// Declare the technology dimensions for a project: languages, frameworks, deploy targets,
// storage adapters, and transport adapters. Profiles drive module derivation and codegen.
import type { ConceptHandler } from '@clef/runtime';

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

let nextId = 1;
function makeId(): string {
  return `profile-${nextId++}`;
}

export function resetTargetProfileIds() {
  nextId = 1;
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

export const targetProfileHandler: ConceptHandler = {
  async create(input, storage) {
    const name = input.name as string;

    const existing = await storage.find('targetProfile');
    const duplicate = existing.find(p => p.name === name);
    if (duplicate) {
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

  async setBackendLanguages(input, storage) {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues('backend_languages', values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      backend_languages: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setFrontendFrameworks(input, storage) {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues('frontend_frameworks', values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      frontend_frameworks: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setApiInterfaces(input, storage) {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues('api_interfaces', values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      api_interfaces: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setSdkLanguages(input, storage) {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues('sdk_languages', values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      sdk_languages: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setDeployTargets(input, storage) {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues('deploy_targets', values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      deploy_targets: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setStorageAdapters(input, storage) {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues('storage_adapters', values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      storage_adapters: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setTransportAdapters(input, storage) {
    const profileId = input.profileId as string;
    const values = JSON.parse(input.values as string) as string[];

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const errors = validateValues('transport_adapters', values);
    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    await storage.put('targetProfile', profileId, {
      ...profile,
      transport_adapters: JSON.stringify(values),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async validate(input, storage) {
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

    // Completeness: at least backend_languages must be set
    if (backendLangs.length === 0) {
      errors.push('At least one backend language must be specified');
    }

    // Compatibility checks
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

  async deriveModules(input, storage) {
    const profileId = input.profileId as string;

    const profile = await storage.get('targetProfile', profileId);
    if (!profile) {
      return { variant: 'notfound', message: `Profile "${profileId}" not found` };
    }

    const modules = new Set<string>();

    // Derive from deploy targets
    const deployTargets = JSON.parse(profile.deploy_targets as string) as string[];
    for (const target of deployTargets) {
      const mods = DEPLOY_MODULE_MAP[target];
      if (mods) mods.forEach(m => modules.add(m));
    }

    // Derive from storage adapters
    const storageAdapters = JSON.parse(profile.storage_adapters as string) as string[];
    for (const adapter of storageAdapters) {
      const mods = STORAGE_MODULE_MAP[adapter];
      if (mods) mods.forEach(m => modules.add(m));
    }

    // Derive from API interfaces
    const apiInterfaces = JSON.parse(profile.api_interfaces as string) as string[];
    for (const iface of apiInterfaces) {
      const mods = API_MODULE_MAP[iface];
      if (mods) mods.forEach(m => modules.add(m));
    }

    // Derive from transport adapters
    const transportAdapters = JSON.parse(profile.transport_adapters as string) as string[];
    for (const transport of transportAdapters) {
      const mods = TRANSPORT_MODULE_MAP[transport];
      if (mods) mods.forEach(m => modules.add(m));
    }

    const derived = Array.from(modules).sort();
    return { variant: 'ok', modules: JSON.stringify(derived) };
  },

  async listOptions(_input, _storage) {
    const options: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(SUPPORTED_OPTIONS)) {
      options[key] = values;
    }
    return { variant: 'ok', options: JSON.stringify(options) };
  },
};
