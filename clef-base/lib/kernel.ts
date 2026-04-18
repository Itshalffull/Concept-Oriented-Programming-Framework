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
import { keybindingPresetHandler } from '../../handlers/ts/app/keybinding-preset.handler';
import { actionBindingHandler } from '../../handlers/ts/app/action-binding.handler';
import { uiEventBindingHandler } from '../../handlers/ts/app/ui-event-binding.handler';
import { pilotHandler } from '../../handlers/ts/surface/pilot.handler';
import { pageMapHandler } from '../../handlers/ts/surface/page-map.handler';
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
import { agentRegistrationHandler } from '../../handlers/ts/app/agent-registration.handler';
import { constitutionHandler } from '../../handlers/ts/llm-agent/constitution.handler';
// Identity — Subject unification layer
import { subjectHandler } from '../../handlers/ts/app/identity/subject.handler';
// Governance Platform
import { proposalHandler } from '../../handlers/ts/app/governance/proposal.handler';
import { policyHandler } from '../../handlers/ts/app/governance/policy.handler';
import { governanceOfficeHandler } from '../../handlers/ts/app/governance/governance-office.handler';
import { pilotModeHandler } from '../../handlers/ts/app/governance/pilot-mode.handler';
import { teamHandler } from '../../handlers/ts/app/governance/team.handler';
// Verification
import { checkVerificationHandler } from '../../handlers/ts/app/check-verification.handler';
// Versioning
import { versionSpaceHandler } from '../../handlers/ts/version-space.handler';
// Canvas
import { canvasHandler } from '../../handlers/ts/app/canvas.handler';
// Content extras
import { snippetHandler } from '../../handlers/ts/app/snippet.handler';
// Editor surface integrations
import { editSurfaceHandler } from '../../handlers/ts/app/edit-surface.handler';
import { contentCompilerHandler } from '../../handlers/ts/app/content-compiler.handler';
// Content reconciliation (reverse projection)
import { contentReconcilerHandler } from '../../handlers/ts/app/content-reconciler.handler';
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
// Taxonomy aliases — Vocabulary and TaxonomyTerm are schema-level concepts
// backed by the Taxonomy handler which manages the shared taxonomy storage.
import { taxonomyHandler } from '../../handlers/ts/app/taxonomy.handler';
import { dailyNoteHandler } from '../../handlers/ts/app/daily-note.handler';
// Utility
import { slugHandler } from '../../handlers/ts/repertoire/utility/slug.handler';

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
    uri: 'urn:clef/KeybindingPreset',
    handler: keybindingPresetHandler,
    storageName: 'keybinding-preset',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ActionBinding',
    handler: actionBindingHandler,
    storageName: 'action-binding',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/UIEventBinding',
    handler: uiEventBindingHandler,
    storageName: 'ui-event-binding',
    storageType: 'standard' as const,
  },
  // Surface — Pilot shares page-map storage so snapshot() can read the
  // entries and page_binding relations registered by PageMap/register and
  // PageMap/registerBinding. Both handlers must agree on the storage
  // namespace for in-kernel cross-reads.
  {
    uri: 'urn:clef/Pilot',
    handler: pilotHandler,
    storageName: 'page-map',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/PageMap',
    handler: pageMapHandler,
    storageName: 'page-map',
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
    uri: 'urn:clef/AgentRegistration',
    handler: agentRegistrationHandler,
    storageName: 'agent-registration',
    storageType: 'standard' as const,
  },
  // Identity — Subject unification layer (MAG-952)
  // All acting principals (human users, registered agents, service accounts)
  // project into Subject via syncs. Cross-cutting consumers (auth, audit,
  // rate limiting) query Subject rather than each source concept.
  {
    uri: 'urn:clef/Subject',
    handler: subjectHandler,
    storageName: 'subject',
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
    uri: 'urn:clef/GovernanceOffice',
    handler: governanceOfficeHandler,
    storageName: 'role',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/PilotMode',
    handler: pilotModeHandler,
    storageName: 'pilot-mode',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Team',
    handler: teamHandler,
    storageName: 'team',
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
  // Editor surface integrations — must be registered so block editor resolve
  // and compile-status calls don't return "Concept not found" 500s.
  {
    uri: 'urn:clef/EditSurface',
    handler: editSurfaceHandler,
    storageName: 'edit-surface',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ContentCompiler',
    handler: contentCompilerHandler,
    storageName: 'content-compiler',
    storageType: 'standard' as const,
  },
  // Content extras
  {
    uri: 'urn:clef/Snippet',
    handler: snippetHandler,
    storageName: 'snippet',
    storageType: 'standard' as const,
  },
  // Content reconciliation (reverse projection)
  {
    uri: 'urn:clef/ContentReconciler',
    handler: contentReconcilerHandler,
    storageName: 'content-reconciler',
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
  // Vocabulary and TaxonomyTerm are schema-level aliases backed by the shared
  // Taxonomy handler. Views and entity-pickers that call Vocabulary/list or
  // TaxonomyTerm/list need these URIs registered.
  {
    uri: 'urn:clef/Vocabulary',
    handler: taxonomyHandler,
    storageName: 'taxonomy',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/TaxonomyTerm',
    handler: taxonomyHandler,
    storageName: 'taxonomy',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/DailyNote',
    handler: dailyNoteHandler,
    storageName: 'daily-note',
    storageType: 'standard' as const,
  },
  // Utility — slug derivation with per-namespace rules
  {
    uri: 'urn:clef/Slug',
    handler: slugHandler,
    storageName: 'slug',
    storageType: 'standard' as const,
  },
];

// Only syncs whose where/then expressions use helpers the current sync
// engine implements (engine.ts resolveTemplateValue supports `concat` and
// `cond`; `equals`, `pluck`, `firstOf`, `sourcesFor` are not). The rest of
// the Builder/test sync chain stays dormant until those helpers land.
const SUPPLEMENTAL_SYNC_FILES = [
  'repertoire/concepts/testing/syncs/unit-tests-publish-quality-signal.sync',
  // Unified schema-membership syncs: keep ContentNode/get.schemas in agreement
  // with Schema/applyTo and Schema/removeFrom (fix for three-source inconsistency).
  'clef-base/suites/entity-lifecycle/syncs/schema-apply-records-membership.sync',
  'clef-base/suites/entity-lifecycle/syncs/schema-remove-forgets-membership.sync',
  // Bridge createWithSchema → Schema storage so Schema/listMemberships reflects
  // nodes created via ContentNode/createWithSchema (fixes schemas: [] in ViewRenderer).
  'clef-base/suites/entity-lifecycle/syncs/content-node-create-applies-schema.sync',
  // AgentRegistration → Subject projection.
  'syncs/identity/agent-registration-to-subject.sync',
  // User → Subject projection (human principals from User/register).
  'syncs/identity/user-to-subject.sync',
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

  // Seed data + populate RuntimeRegistry + reflect entities.
  // Pass `concepts` (ConceptRegistration[]) alongside result.registrations so
  // populateScoreApiIndex can extract action names from handler object keys.
  _seedPromise = seedData(kernel, result.registrations, result.loadedSyncs, concepts).then(() => bootstrapIdentity(kernel));

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

// NOTE: From this commit forward, seed re-application is automatic whenever a
// .seeds.yaml file's SHA-256 content hash changes — no manual intervention needed.
// One-time migration for existing dbs: delete clef-base/.clef/clef-base.db* before
// starting the dev server so seeds are re-discovered with fresh hashes.
async function applyDeclarativeSeeds(kernel: Kernel) {
  const seedStorage = makeStorage('seed-data');
  const discovery = await discoverFromFilesystem({
    base_path: resolve(CLEF_BASE_ROOT, 'seeds'),
  }, seedStorage);
  if (discovery.variant !== 'ok') {
    throw new Error(String(discovery.message ?? 'Failed to discover seed data'));
  }

  // Build a map of seedId → currentHash from the discovery results so we
  // can compare against the stored content_hash without re-hashing files.
  const currentHashById = new Map<string, string>();
  if (Array.isArray(discovery.found)) {
    for (const entry of discovery.found as Array<{ id: string; currentHash: string } | string>) {
      if (typeof entry === 'object' && entry !== null) {
        currentHashById.set(entry.id, entry.currentHash);
      }
    }
  }

  const seeds = await kernel.queryConcept('urn:clef/SeedData', 'seed-data');
  for (const seed of seeds) {
    const seedId = String(seed.id ?? '');
    const storedHash = seed.content_hash != null ? String(seed.content_hash) : null;
    const currentHash = currentHashById.get(seedId) ?? null;

    // Determine if this seed needs (re-)application.
    // Skip only when applied=true AND the stored hash matches the current file hash.
    const hashMatch = storedHash !== null && currentHash !== null && storedHash === currentHash;
    if (seed.applied === true && hashMatch) {
      continue;
    }

    // When the file has changed (or was never hashed), store the current hash
    // via reapply before applying. This resets applied=false and records the
    // new hash so the next boot will skip unless the file changes again.
    if (currentHash !== null) {
      await kernel.invokeConcept('urn:clef/SeedData', 'reapply', {
        seed: seedId,
        content_hash: currentHash,
      }).catch(() => {});
    }

    const conceptUri = String(seed.concept_uri ?? '');
    const actionName = String(seed.action_name ?? '');
    const entries = parseSeedEntries(seed.entries);
    // isReapply is true when the file hash changed — existing records must be
    // updated, not silently skipped as duplicates (Section 16.12).
    const isReapply = storedHash !== null && currentHash !== null && storedHash !== currentHash;
    for (const entry of entries) {
      const result = await kernel.invokeConcept(conceptUri, actionName, entry).catch(() => ({ variant: 'error' }));
      // When re-applying a changed seed, if the create action returns duplicate,
      // fall back to update so the existing record is replaced with the new
      // seed values instead of being left stale.
      if (isReapply && (result.variant === 'duplicate' || result.variant === 'already_exists')) {
        await kernel.invokeConcept(conceptUri, 'update', entry).catch(() => {});
      }
    }
    await kernel.invokeConcept('urn:clef/SeedData', 'apply', {
      seed: seedId,
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
 *
 * Action names are extracted from the handler object's own keys —
 * ConceptHandler is an index-signature type whose keys are action names.
 * This is the authoritative source of truth for what actions a concept exposes.
 */
async function populateScoreApiIndex(kernel: Kernel, concepts: ConceptRegistration[]) {
  for (const concept of concepts) {
    // Derive human-readable concept name from URI (e.g. urn:clef/ContentNode → ContentNode)
    const conceptName = concept.uri.split('/').pop() ?? concept.uri;
    if (!conceptName) continue;

    // Extract action names from handler keys — ConceptHandler is an index-signature
    // interface so Object.keys gives the actual registered action names.
    const actionNames = Object.keys(concept.handler).filter(k => typeof concept.handler[k] === 'function');

    await kernel.invokeConcept('urn:clef/ScoreIndex', 'upsertConcept', {
      name: conceptName,
      purpose: '',
      actions: actionNames,
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

/**
 * Recovery guard: if declarative seeding metadata says ActionBinding seed files
 * were applied but one or more expected bindings are absent from storage,
 * force-re-register all ActionBinding seed files.
 *
 * This mirrors ensureKeyBindings but validates against the concrete binding ids
 * declared in the seed files, since a non-zero binding count is not sufficient
 * for editor boot if core bindings like "insert-block" are missing.
 */
async function ensureActionBindings(kernel: Kernel) {
  try {
    const listResult = await kernel.invokeConcept('urn:clef/ActionBinding', 'list', {});
    if (listResult.variant !== 'ok') return;
    const existingRows = typeof listResult.bindings === 'string' && listResult.bindings.trim()
      ? JSON.parse(listResult.bindings as string) as Array<Record<string, unknown>>
      : Array.isArray(listResult.bindings)
        ? listResult.bindings as Array<Record<string, unknown>>
        : [];
    const existingIds = new Set(existingRows.map((row) => String(row.binding ?? row.id ?? '')));

    const seedsDir = resolve(CLEF_BASE_ROOT, 'seeds');
    if (!existsSync(seedsDir)) return;

    const expectedRows = new Map<string, Record<string, unknown>>();
    for (const entry of readdirSync(seedsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() && entry.name.startsWith('ActionBinding') && entry.name.endsWith('.seeds.yaml')) {
        const filePath = resolve(seedsDir, entry.name);
        const content = readFileSync(filePath, 'utf8');
        const parsed = parseSeedsYaml(content);
        for (const seed of parsed) {
          for (const row of seed.entries) {
            const bindingId = String(row.binding ?? row.name ?? '').trim();
            if (bindingId) expectedRows.set(bindingId, row);
          }
        }
      }
    }

    const existingById = new Map(existingRows.map((row) => [String(row.binding ?? row.id ?? ''), row]));
    const fieldsToCheck = [
      'target',
      'parameterMap',
      'precondition',
      'confirmWhen',
      'executionPolicy',
      'retryPolicy',
      'reversalAction',
      'label',
      'icon',
      'buttonVariant',
      'slash_command',
      'toolbar_command',
      'context_menu',
      'keyboard',
      'section',
    ];

    const needsRepair = Array.from(expectedRows.entries()).filter(([bindingId, expected]) => {
      const existing = existingById.get(bindingId);
      if (!existingIds.has(bindingId) || !existing) return true;
      return fieldsToCheck.some((field) => {
        const want = expected[field] ?? null;
        const have = existing[field] ?? null;
        return JSON.stringify(want) !== JSON.stringify(have);
      });
    });
    if (needsRepair.length === 0) return;

    for (const [bindingId, row] of needsRepair) {
      if (existingById.has(bindingId)) {
        await kernel.invokeConcept('urn:clef/ActionBinding', 'remove', { binding: bindingId }).catch(() => {});
      }
      await kernel.invokeConcept('urn:clef/ActionBinding', 'bind', row).catch(() => {});
    }
  } catch {
    // ensureActionBindings is best-effort — don't fail boot
  }
}

/**
 * Backfill schema memberships for ContentNodes created via ContentNode/create.
 *
 * ContentNode/create records the `type` field on the node row but does NOT
 * write a membership entry — that only happens via ContentNode/createWithSchema
 * (and its companion content-node-create-applies-schema.sync → Schema/applyTo
 * → schema-apply-records-membership.sync → ContentNode/recordSchema chain).
 *
 * Seeds that use ContentNode/create with a non-empty `type` (e.g. the 7
 * built-in agent-persona nodes) therefore have no membership entries, which
 * means ContentNode/listBySchema returns 0 rows for them even though the
 * nodes are present in storage.
 *
 * This function walks every ContentNode, and for each row where `type` is set
 * but no membership exists, calls ContentNode/recordSchema to write the entry.
 * The call is idempotent — recordSchema returns ok if the membership already
 * exists, so re-running at boot is safe.
 */
async function ensureSchemaMemberships(kernel: Kernel) {
  try {
    const listResult = await kernel.invokeConcept('urn:clef/ContentNode', 'list', {});
    if (listResult.variant !== 'ok') return;

    const nodes: Array<Record<string, unknown>> = typeof listResult.items === 'string' && listResult.items.trim()
      ? JSON.parse(listResult.items as string) as Array<Record<string, unknown>>
      : Array.isArray(listResult.items)
        ? listResult.items as Array<Record<string, unknown>>
        : [];

    for (const node of nodes) {
      const nodeId = String(node.node ?? '').trim();
      const type = String(node.type ?? '').trim();
      if (!nodeId || !type) continue;

      // Check whether a membership entry already exists for this (node, type) pair.
      // ContentNode/listBySchema reads from the 'membership' relation, so we use it
      // as a proxy: if the node appears in the schema's membership list, skip it.
      // We do this cheaply by calling ContentNode/recordSchema directly — it is
      // idempotent and only writes when the entry is missing.
      await kernel.invokeConcept('urn:clef/ContentNode', 'recordSchema', {
        node: nodeId,
        schema: type,
      }).catch(() => {});
    }
  } catch {
    // ensureSchemaMemberships is best-effort — don't fail boot
  }
}

async function seedData(kernel: Kernel, registrations: RegEntry[], loadedSyncs: string[], concepts: ConceptRegistration[]) {
  if (_seeded) return;
  _seeded = true;

  // Populate RuntimeRegistry with all registered concepts and syncs
  await populateRuntimeRegistry(kernel, registrations, loadedSyncs);

  // Populate ScoreApi index so ConceptActionPicker can list live concepts.
  // Pass the full ConceptRegistration array so action names can be extracted
  // from the handler object keys.
  await populateScoreApiIndex(kernel, concepts);

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

  // Backfill schema memberships for ContentNodes seeded via ContentNode/create.
  // ContentNode/create stores `type` on the row but does not write a membership
  // entry — so listBySchema returns 0 rows for those nodes. This idempotent
  // pass calls ContentNode/recordSchema for every node whose type has no
  // corresponding membership entry, fixing listBySchema for all seeded personas.
  await ensureSchemaMemberships(kernel);

  // Recovery: earlier boots could mark KeyBinding seeds as applied even when
  // all entries silently failed (chord was a JSON string, handler expected array).
  // If no bindings exist after seeding, force re-registration from seed files.
  await ensureKeyBindings(kernel);

  // Same recovery for ActionBinding seeds. Existing dbs can report seed files
  // as applied while missing concrete bindings required by the editor.
  await ensureActionBindings(kernel);

  // Earlier broken boots could mark Workspace seeds as applied before the
  // concept existed. Ensure the shell still has a default workspace.
  await ensureBootstrapWorkspace(kernel);

  // Reflect entities — auto-creates ContentNode entries from RuntimeRegistry + FileCatalog
  await kernel.invokeConcept('urn:clef/EntityReflector', 'reflect', {}).catch(() => {
    // Entity reflection is best-effort — don't fail boot
  });
}

export async function getRegisteredConcepts() {
  // Ensure seeding is complete before reading — populateRuntimeRegistry must
  // have written all concepts into the 'concept' relation before listConcepts
  // can return a non-empty result. Callers that await ensureSeeded() before
  // calling this function are safe either way; callers that do not (e.g. direct
  // utility use) are protected by this await.
  await ensureSeeded();
  const result = await _kernel!.invokeConcept('urn:clef/RuntimeRegistry', 'listConcepts', {});
  if (result.variant === 'ok') {
    const concepts = JSON.parse(result.concepts as string) as Array<Record<string, unknown>>;
    return concepts.map(c => ({ uri: c.uri as string, hasStorage: c.has_storage as boolean }));
  }
  return [];
}

export async function getRegisteredSyncs(): Promise<string[]> {
  // Same seeding guarantee as getRegisteredConcepts — populateRuntimeRegistry
  // writes all sync names before listSyncs can return a non-empty result.
  await ensureSeeded();
  const result = await _kernel!.invokeConcept('urn:clef/RuntimeRegistry', 'listSyncs', {});
  if (result.variant === 'ok') {
    const syncs = JSON.parse(result.syncs as string) as Array<Record<string, unknown>>;
    return syncs.map(s => s.sync_name as string);
  }
  return [];
}
