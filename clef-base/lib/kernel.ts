import { resolve } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { bootKernel } from '../../handlers/ts/framework/kernel-boot.handler';
import type { ConceptRegistration, RegEntry } from '../../handlers/ts/framework/kernel-boot.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createSQLiteStorage } from '../../runtime/adapters/sqlite-storage';
import type { Kernel } from '../../runtime/self-hosted';
import { versionContextHandler } from '../../handlers/ts/version-context.handler';
import { workspaceHandler } from '../../handlers/ts/app/workspace.handler';
import { mediaAssetHandler } from '../../handlers/ts/app/media-asset.handler';
import { transcriptHandler } from '../../handlers/ts/media/transcript.handler';
import { clipHandler } from '../../handlers/ts/media/clip.handler';
import { keyBindingHandler } from '../../handlers/ts/app/key-binding.handler';
import { actionBindingHandler } from '../../handlers/ts/app/action-binding.handler';
import { textSpanHandler } from '../../handlers/ts/app/text-span.handler';
import { inputRuleHandler } from '../../handlers/ts/app/input-rule.handler';
import { testGenerationHandler } from '../../handlers/ts/repertoire/testing/test-generation.handler';
import { builderHandler } from '../../handlers/ts/deploy/builder.handler';
import { qualitySignalHandler } from '../../handlers/ts/framework/test/quality-signal.handler';
import { flakyTestHandler } from '../../handlers/ts/framework/test/flaky-test.handler';
import { testSelectionHandler } from '../../handlers/ts/framework/test/test-selection.handler';
import { fieldDefinitionHandler } from '../../handlers/ts/app/field-definition.handler';
import { formSpecHandler } from '../../handlers/ts/view/form-spec.handler';
import { scoreApiHandler } from '../../handlers/ts/score/score-api.handler';
import { scoreIndexHandler } from '../../handlers/ts/score/score-index.handler';
// Process Platform
import { processSpecHandler } from '../../handlers/ts/process-foundation/process-spec.handler';
import { processRunHandler } from '../../handlers/ts/process-foundation/process-run.handler';
import { stepRunHandler } from '../../handlers/ts/process-foundation/step-run.handler';
import { workItemHandler } from '../../handlers/ts/process-human/work-item.handler';
import { processConversationHandler } from '../../handlers/ts/process-conversation.handler';
// Agent / LLM Platform
import { agentSessionHandler } from '../../handlers/ts/app/agent-session.handler';
import { agentTriggerHandler } from '../../handlers/ts/app/agent-trigger.handler';
import { constitutionHandler } from '../../handlers/ts/llm-agent/constitution.handler';
// Governance Platform
import { proposalHandler } from '../../handlers/ts/app/governance/proposal.handler';
import { policyHandler } from '../../handlers/ts/app/governance/policy.handler';
import { roleHandler } from '../../handlers/ts/app/governance/role.handler';
import { circleHandler } from '../../handlers/ts/app/governance/circle.handler';
// Verification
import { checkVerificationHandler } from '../../handlers/ts/app/check-verification.handler';
// Versioning
import { versionSpaceHandler } from '../../handlers/ts/version-space.handler';
// Canvas
import { canvasHandler } from '../../handlers/ts/app/canvas.handler';
// Research / Evidence Platform
import { claimHandler } from '../../handlers/ts/app/claim.handler';
import { researchProjectHandler } from '../../handlers/ts/app/research-project.handler';
import { citationHandler } from '../../handlers/ts/app/citation.handler';
// Governance — reputation, audit trail, permission
import { reputationHandler } from '../../handlers/ts/app/governance/reputation.handler';
import { auditTrailHandler } from '../../handlers/ts/app/governance/audit-trail.handler';
import { permissionHandler } from '../../handlers/ts/app/governance/permission.handler';
// Notification
import { notificationHandler } from '../../handlers/ts/app/notification.handler';
// LLM / Agent — memory and conversation
import { agentMemoryHandler } from '../../handlers/ts/llm-agent/agent-memory.handler';
import { conversationHandler } from '../../handlers/ts/llm-conversation/conversation.handler';

import { REGISTRY_ENTRIES, SYNC_FILES } from '../../generated/kernel-registry';
import { discoverFromFilesystem, parseSeedsYaml } from '../../handlers/ts/seed-data.handler';
import { setEntityReflectorKernel } from '../../handlers/ts/app/entity-reflector.handler';
import { setViewShellKernel } from '../../handlers/ts/view/view-shell.handler';
import { bootstrapIdentity, getIdentityStorage } from './identity';
import {
  pickActiveTheme,
  resolveThemeDocumentState,
  type ThemeDocumentState,
  type ThemeRecord,
} from './theme-selection';

let _kernel: Kernel | null = null;
let _seedPromise: Promise<void> | null = null;

const SUPPLEMENTAL_REGISTRY_ENTRIES = [
  {
    uri: 'urn:clef/VersionContext',
    handler: versionContextHandler,
    storageName: 'version-context',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Workspace',
    handler: workspaceHandler,
    storageName: 'workspace',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/MediaAsset',
    handler: mediaAssetHandler,
    storageName: 'media-asset',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Transcript',
    handler: transcriptHandler,
    storageName: 'transcript',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Clip',
    handler: clipHandler,
    storageName: 'clip',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/KeyBinding',
    handler: keyBindingHandler,
    storageName: 'key-binding',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ActionBinding',
    handler: actionBindingHandler,
    storageName: 'action-binding',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/TextSpan',
    handler: textSpanHandler,
    storageName: 'text-span',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/InputRule',
    handler: inputRuleHandler,
    storageName: 'input-rule',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/TestGeneration',
    handler: testGenerationHandler,
    storageName: 'test-generation',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Builder',
    handler: builderHandler,
    storageName: 'builder',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/QualitySignal',
    handler: qualitySignalHandler,
    storageName: 'quality-signal',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/FlakyTest',
    handler: flakyTestHandler,
    storageName: 'flaky-test',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/TestSelection',
    handler: testSelectionHandler,
    storageName: 'test-selection',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/FieldDefinition',
    handler: fieldDefinitionHandler,
    storageName: 'field-definition',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/FormSpec',
    handler: formSpecHandler,
    storageName: 'form-spec',
    storageType: 'standard' as const,
  },
  // ScoreApi and ScoreIndex share the same storage namespace so that
  // ScoreIndex/upsertConcept writes are visible to ScoreApi/listConcepts.
  {
    uri: 'urn:clef/ScoreIndex',
    handler: scoreIndexHandler,
    storageName: 'score-index',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ScoreApi',
    handler: scoreApiHandler,
    storageName: 'score-index',
    storageType: 'standard' as const,
  },
  // Process Platform
  {
    uri: 'urn:clef/ProcessSpec',
    handler: processSpecHandler,
    storageName: 'process-spec',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ProcessRun',
    handler: processRunHandler,
    storageName: 'process-run',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/StepRun',
    handler: stepRunHandler,
    storageName: 'step-run',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/WorkItem',
    handler: workItemHandler,
    storageName: 'work-item',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ProcessConversation',
    handler: processConversationHandler,
    storageName: 'process-conversation',
    storageType: 'standard' as const,
  },
  // Agent / LLM Platform
  {
    uri: 'urn:clef/AgentSession',
    handler: agentSessionHandler,
    storageName: 'agent-session',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/AgentTrigger',
    handler: agentTriggerHandler,
    storageName: 'agent-trigger',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Constitution',
    handler: constitutionHandler,
    storageName: 'constitution',
    storageType: 'standard' as const,
  },
  // Governance Platform
  {
    uri: 'urn:clef/Proposal',
    handler: proposalHandler,
    storageName: 'proposal',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Policy',
    handler: policyHandler,
    storageName: 'policy',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Role',
    handler: roleHandler,
    storageName: 'role',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Circle',
    handler: circleHandler,
    storageName: 'circle',
    storageType: 'standard' as const,
  },
  // Verification
  {
    uri: 'urn:clef/CheckVerification',
    handler: checkVerificationHandler,
    storageName: 'check-verification',
    storageType: 'standard' as const,
  },
  // Versioning
  {
    uri: 'urn:clef/VersionSpace',
    handler: versionSpaceHandler,
    storageName: 'version-space',
    storageType: 'standard' as const,
  },
  // Canvas
  {
    uri: 'urn:clef/Canvas',
    handler: canvasHandler,
    storageName: 'canvas',
    storageType: 'standard' as const,
  },
  // Research / Evidence Platform
  {
    uri: 'urn:clef/Claim',
    handler: claimHandler,
    storageName: 'claim',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ResearchProject',
    handler: researchProjectHandler,
    storageName: 'research-project',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Citation',
    handler: citationHandler,
    storageName: 'citation',
    storageType: 'standard' as const,
  },
  // Governance — reputation, audit trail, permission
  {
    uri: 'urn:clef/Reputation',
    handler: reputationHandler,
    storageName: 'reputation',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/AuditTrail',
    handler: auditTrailHandler,
    storageName: 'audit-trail',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Permission',
    handler: permissionHandler,
    storageName: 'permission',
    storageType: 'standard' as const,
  },
  // Notification
  {
    uri: 'urn:clef/Notification',
    handler: notificationHandler,
    storageName: 'notification',
    storageType: 'standard' as const,
  },
  // LLM / Agent — memory and conversation
  {
    uri: 'urn:clef/AgentMemory',
    handler: agentMemoryHandler,
    storageName: 'agent-memory',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Conversation',
    handler: conversationHandler,
    storageName: 'conversation',
    storageType: 'standard' as const,
  },
];

// Only syncs whose where/then expressions use helpers the current sync
// engine implements (engine.ts resolveTemplateValue supports `concat` and
// `cond`; `equals`, `pluck`, `firstOf`, `sourcesFor` are not). The rest of
// the Builder/test sync chain stays dormant until those helpers land.
const SUPPLEMENTAL_SYNC_FILES = [
  'repertoire/concepts/testing/syncs/unit-tests-publish-quality-signal.sync',
];

// process.cwd() is the clef-base/ dir when Next.js runs; __filename
// resolves inside .next/server/ at runtime, so we can't use it.
// When running from the project root (e.g., during tests), detect
// and resolve to the clef-base subdirectory for seed/suite paths.
const _cwd = process.cwd();
const CLEF_BASE_ROOT = existsSync(resolve(_cwd, 'seeds'))
  ? _cwd
  : existsSync(resolve(_cwd, 'clef-base', 'seeds'))
    ? resolve(_cwd, 'clef-base')
    : _cwd;

// Project root for resolving sync file paths from kernel-registry.ts
const PROJECT_ROOT = existsSync(resolve(_cwd, 'clef-base'))
  ? _cwd
  : resolve(_cwd, '..');

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-base:${conceptName}`) ?? createSQLiteStorage({
    dbPath: resolve(CLEF_BASE_ROOT, '.clef', 'clef-base.db'),
    namespace: conceptName,
  });
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registryEntries = [...REGISTRY_ENTRIES];
  for (const entry of SUPPLEMENTAL_REGISTRY_ENTRIES) {
    if (!registryEntries.some((existing) => existing.uri === entry.uri)) {
      registryEntries.push(entry);
    }
  }

  const concepts: ConceptRegistration[] = registryEntries.map(entry => ({
    uri: entry.uri,
    handler: entry.handler,
    storage: entry.storageType === 'identity'
      ? getIdentityStorage(entry.storageName as Parameters<typeof getIdentityStorage>[0])
      : entry.storageType === 'standard'
        ? makeStorage(entry.storageName)
        : undefined,
    storageName: entry.storageName,
    storageType: entry.storageType,
  }));

  const syncFiles = [...SYNC_FILES, ...SUPPLEMENTAL_SYNC_FILES]
    .map(p => resolve(PROJECT_ROOT, p));

  const result = bootKernel({
    concepts,
    syncFiles,
    makeStorage: (name) => makeStorage(name),
  });

  const kernel = result.kernel;

  // Wire EntityReflector kernel reference
  setEntityReflectorKernel(kernel);

  // Wire ViewShell kernel reference so resolveHydrated can dispatch cross-concept gets
  setViewShellKernel(kernel);

  // Seed data + populate RuntimeRegistry + reflect entities
  _seedPromise = seedData(kernel, result.registrations, result.loadedSyncs).then(() => bootstrapIdentity(kernel));

  _kernel = kernel;
  return kernel;
}

/** Await this before querying seeded data */
export function ensureSeeded(): Promise<void> {
  getKernel(); // ensure initialized
  return _seedPromise ?? Promise.resolve();
}

export async function getActiveThemeId(defaultTheme = 'light') {
  await ensureSeeded();
  const themes = await getKernel().queryConcept('urn:clef/Theme', 'theme');
  return pickActiveTheme(themes as ThemeRecord[], defaultTheme);
}

export async function getActiveThemeDocumentState(defaultTheme = 'light'): Promise<ThemeDocumentState> {
  await ensureSeeded();
  const kernel = getKernel();
  const themes = await kernel.queryConcept('urn:clef/Theme', 'theme');
  const themeId = pickActiveTheme(themes as ThemeRecord[], defaultTheme);
  const resolved = await kernel.invokeConcept('urn:clef/Theme', 'resolve', { theme: themeId });
  let resolvedTokens: Record<string, unknown> = {};
  if (resolved.variant === 'ok' && typeof resolved.tokens === 'string' && resolved.tokens.trim()) {
    try {
      resolvedTokens = JSON.parse(resolved.tokens as string) as Record<string, unknown>;
    } catch {
      resolvedTokens = {};
    }
  }
  return resolveThemeDocumentState(themes as ThemeRecord[], resolvedTokens, defaultTheme);
}

let _seeded = false;

function parseSeedEntries(raw: unknown): Array<Record<string, unknown>> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  const entries = JSON.parse(raw) as string[];
  return entries.map((entry) => JSON.parse(entry) as Record<string, unknown>);
}

async function applyDeclarativeSeeds(kernel: Kernel) {
  const discovery = await discoverFromFilesystem({
    base_path: resolve(CLEF_BASE_ROOT, 'seeds'),
  }, makeStorage('seed-data'));
  if (discovery.variant !== 'ok') {
    throw new Error(String(discovery.message ?? 'Failed to discover seed data'));
  }

  const seeds = await kernel.queryConcept('urn:clef/SeedData', 'seed-data');
  for (const seed of seeds) {
    if (seed.applied === true) {
      continue;
    }

    const conceptUri = String(seed.concept_uri ?? '');
    const actionName = String(seed.action_name ?? '');
    const entries = parseSeedEntries(seed.entries);
    for (const entry of entries) {
      await kernel.invokeConcept(conceptUri, actionName, entry).catch(() => {});
    }
    await kernel.invokeConcept('urn:clef/SeedData', 'apply', {
      seed: seed.id,
    }).catch(() => {});
  }
}

async function populateRuntimeRegistry(kernel: Kernel, registrations: RegEntry[], loadedSyncs: string[]) {
  // Register all concepts in RuntimeRegistry
  for (const reg of registrations) {
    await kernel.invokeConcept('urn:clef/RuntimeRegistry', 'registerConcept', {
      uri: reg.uri,
      has_storage: reg.hasStorage,
      storage_name: reg.storageName,
      storage_type: reg.storageType,
    }).catch(() => {});
  }

  // Register all syncs in RuntimeRegistry
  for (const syncName of loadedSyncs) {
    await kernel.invokeConcept('urn:clef/RuntimeRegistry', 'registerSync', {
      sync_name: syncName,
      source: 'file',
      suite: '',
    }).catch(() => {});
  }
}

/**
 * Populate ScoreApi's concept index from the kernel's registered concepts.
 *
 * ScoreApi/listConcepts reads from the 'concepts' relation written by
 * ScoreIndex/upsertConcept. The ScoreIndex pipeline (ConceptEntity/register
 * → upsertConcept) doesn't auto-run in clef-base, so we bootstrap it here
 * by mirroring RuntimeRegistry registrations into the score index. This
 * step is idempotent — upsertConcept overwrites existing entries by key.
 */
async function populateScoreApiIndex(kernel: Kernel, registrations: RegEntry[]) {
  for (const reg of registrations) {
    // Derive human-readable concept name from URI (e.g. urn:clef/ContentNode → ContentNode)
    const conceptName = reg.uri.split('/').pop() ?? reg.uri;
    if (!conceptName) continue;
    await kernel.invokeConcept('urn:clef/ScoreIndex', 'upsertConcept', {
      name: conceptName,
      purpose: '',
      actions: [],
      stateFields: [],
      file: '',
    }).catch(() => {});
  }
}

async function ensureBootstrapWorkspace(kernel: Kernel) {
  try {
    const existing = await kernel.invokeConcept('urn:clef/Workspace', 'list', { owner: 'system' });
    if (existing.variant === 'ok') {
      const workspaces = Array.isArray(existing.workspaces)
        ? existing.workspaces
        : typeof existing.workspaces === 'string' && existing.workspaces.trim()
          ? JSON.parse(existing.workspaces as string) as unknown[]
          : [];
      if (workspaces.length > 0) {
        return;
      }
    }

    await kernel.invokeConcept('urn:clef/Workspace', 'create', {
      workspace: 'default-admin',
      name: 'Default Admin',
      owner: 'system',
      description: 'Standard admin workspace with content browser, concept sidebar, and system panel.',
    }).catch(() => {});

    await kernel.invokeConcept('urn:clef/Workspace', 'setDefault', {
      workspace: 'default-admin',
    }).catch(() => {});
  } catch {
    // Workspace bootstrap is best-effort and should not block shell boot.
  }
}

/**
 * Recovery guard: if no KeyBinding entries exist after declarative seeding (which can
 * happen when earlier boots marked seeds as applied while the handler silently rejected
 * all entries due to chord-string parsing), force-re-register all KeyBinding seed files.
 *
 * This is idempotent: if all entries already exist the handler returns 'duplicate' and
 * no state changes. The guard fires only when the bindings relation is completely empty.
 */
async function ensureKeyBindings(kernel: Kernel) {
  try {
    const check = await kernel.invokeConcept('urn:clef/KeyBinding', 'listByScope', { scope: 'app' });
    if (check.variant !== 'ok') return;
    const existing = check.bindings;
    const count = Array.isArray(existing)
      ? existing.length
      : typeof existing === 'string' && existing.trim()
        ? (JSON.parse(existing) as unknown[]).length
        : 0;
    if (count > 0) return; // already populated — nothing to do

    // Zero bindings found — re-run all KeyBinding seed files
    const seedsDir = resolve(CLEF_BASE_ROOT, 'seeds');
    if (!existsSync(seedsDir)) return;
    const allFiles: string[] = [];
    for (const entry of readdirSync(seedsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() && entry.name.startsWith('KeyBinding') && entry.name.endsWith('.seeds.yaml')) {
        allFiles.push(resolve(seedsDir, entry.name));
      }
    }
    for (const filePath of allFiles) {
      const content = readFileSync(filePath, 'utf8');
      const parsed = parseSeedsYaml(content);
      for (const seed of parsed) {
        for (const entry of seed.entries) {
          await kernel.invokeConcept(
            seed.concept_uri.startsWith('urn:') ? seed.concept_uri : `urn:clef/${seed.concept_uri}`,
            seed.action_name,
            entry,
          ).catch(() => {}); // duplicate entries return 'duplicate' — that's fine
        }
      }
    }
  } catch {
    // ensureKeyBindings is best-effort — don't fail boot
  }
}

async function seedData(kernel: Kernel, registrations: RegEntry[], loadedSyncs: string[]) {
  if (_seeded) return;
  _seeded = true;

  // Populate RuntimeRegistry with all registered concepts and syncs
  await populateRuntimeRegistry(kernel, registrations, loadedSyncs);

  // Populate ScoreApi index so ConceptActionPicker can list live concepts
  await populateScoreApiIndex(kernel, registrations);

  // Run FileCatalog discovery (scans specs, syncs, surface, repertoire)
  await kernel.invokeConcept('urn:clef/FileCatalog', 'discover', {
    base_paths: [
      resolve(CLEF_BASE_ROOT, '..', 'specs'),
      resolve(CLEF_BASE_ROOT, '..', 'syncs'),
      resolve(CLEF_BASE_ROOT, '..', 'surface'),
      resolve(CLEF_BASE_ROOT, '..', 'repertoire', 'concepts'),
      resolve(CLEF_BASE_ROOT, 'suites'),
    ].join(','),
  }).catch(() => {
    // FileCatalog discovery is best-effort — don't fail boot
  });

  // Apply declarative seeds (Schema, View, ContentNode, etc.)
  await applyDeclarativeSeeds(kernel);

  // Recovery: earlier boots could mark KeyBinding seeds as applied even when
  // all entries silently failed (chord was a JSON string, handler expected array).
  // If no bindings exist after seeding, force re-registration from seed files.
  await ensureKeyBindings(kernel);

  // Earlier broken boots could mark Workspace seeds as applied before the
  // concept existed. Ensure the shell still has a default workspace.
  await ensureBootstrapWorkspace(kernel);

  // Reflect entities — auto-creates ContentNode entries from RuntimeRegistry + FileCatalog
  await kernel.invokeConcept('urn:clef/EntityReflector', 'reflect', {}).catch(() => {
    // Entity reflection is best-effort — don't fail boot
  });
}

export function getRegisteredConcepts() {
  getKernel(); // ensure initialized
  // Query RuntimeRegistry for live data instead of stale array
  return _kernel!.invokeConcept('urn:clef/RuntimeRegistry', 'listConcepts', {}).then(result => {
    if (result.variant === 'ok') {
      const concepts = JSON.parse(result.concepts as string) as Array<Record<string, unknown>>;
      return concepts.map(c => ({ uri: c.uri as string, hasStorage: c.has_storage as boolean }));
    }
    return [];
  });
}
