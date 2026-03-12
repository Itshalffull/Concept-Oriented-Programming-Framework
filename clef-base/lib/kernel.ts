import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createConceptRegistry } from '../../runtime/adapters/transport';
import { createSelfHostedKernel } from '../../runtime/self-hosted';
import { createSyncEngineHandler } from '../../handlers/ts/framework/sync-engine.handler';
import { parseSyncFile } from '../../handlers/ts/framework/sync-parser.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createInMemoryStorage } from '../../runtime/adapters/storage';
import type { Kernel } from '../../runtime/self-hosted';
import type { ConceptHandler } from '../../runtime/types';

import { componentMappingHandler } from '../../handlers/ts/component-mapping.handler';
import { conceptBrowserHandler } from '../../handlers/ts/concept-browser.handler';
import { slotSourceHandler } from '../../handlers/ts/slot-source.handler';
import { blockEmbedSourceHandler } from '../../handlers/ts/block-embed-source.handler';
import { entityFieldSourceHandler } from '../../handlers/ts/entity-field-source.handler';
import { entityReferenceDisplaySourceHandler } from '../../handlers/ts/entity-reference-display-source.handler';
import { formulaSourceHandler } from '../../handlers/ts/formula-source.handler';
import { menuSourceHandler } from '../../handlers/ts/menu-source.handler';
import { staticValueSourceHandler } from '../../handlers/ts/static-value-source.handler';
import { viewEmbedSourceHandler } from '../../handlers/ts/view-embed-source.handler';
import { widgetEmbedSourceHandler } from '../../handlers/ts/widget-embed-source.handler';
import { hubProxyHandler } from '../handlers/ts/hub-proxy.handler';

// UI-App concepts (Navigator, Host, Shell)
import { navigatorHandler } from '../../handlers/ts/app/navigator.handler';
import { hostHandler } from '../../handlers/ts/app/host.handler';
import { shellHandler } from '../../handlers/ts/app/shell.handler';
import { transportHandler } from '../../handlers/ts/app/transport.handler';
import { nextjsAdapterHandler } from '../../handlers/ts/app/nextjs-adapter.handler';
import { platformAdapterHandler } from '../../handlers/ts/app/platform-adapter.handler';
import { destinationCatalogHandler } from '../../handlers/ts/app/destination-catalog.handler';
import { runtimeProfileHandler } from '../../handlers/ts/app/runtime-profile.handler';
import { platformBindingCatalogHandler } from '../../handlers/ts/app/platform-binding-catalog.handler';
import { interactorHandler } from '../../handlers/ts/app/interactor.handler';
import { affordanceHandler } from '../../handlers/ts/app/affordance.handler';
import { widgetResolverHandler } from '../../handlers/ts/app/widget-resolver.handler';
import { contractCheckerHandler } from '../../handlers/ts/app/contract-checker.handler';
import { widgetRegistryHandler } from '../../handlers/ts/app/widget-registry.handler';
import { uiSchemaHandler } from '../../handlers/ts/app/ui-schema.handler';
import { seedDataHandler } from '../../handlers/ts/seed-data.handler';

// Domain concepts
import { contentNodeHandler } from '../../handlers/ts/app/content-node.handler';
import { schemaHandler } from '../../handlers/ts/app/schema.handler';
import { viewHandler } from '../../handlers/ts/app/view.handler';
import { workflowHandler } from '../../handlers/ts/app/workflow.handler';
import { automationRuleHandler } from '../../handlers/ts/app/automation-rule.handler';
import { taxonomyHandler } from '../../handlers/ts/app/taxonomy.handler';
import { displayModeHandler } from '../../handlers/ts/app/display-mode.handler';
import { fieldPlacementHandler } from '../../handlers/ts/app/field-placement.handler';
import { rendererHandler } from '../../handlers/ts/app/renderer.handler';
import { componentHandler } from '../../handlers/ts/app/component.handler';
import { themeHandler } from '../../handlers/ts/app/theme.handler';
import { queryHandler } from '../../handlers/ts/app/query.handler';
import { contentStorageHandler } from '../../handlers/ts/app/content-storage.handler';
import { propertyHandler } from '../../handlers/ts/app/property.handler';
import { outlineHandler } from '../../handlers/ts/app/outline.handler';
import { layoutHandler } from '../../handlers/ts/app/layout.handler';
import { authenticationHandler } from '../../handlers/ts/app/authentication.handler';
import { authorizationHandler } from '../../handlers/ts/app/authorization.handler';
import { accessControlHandler } from '../../handlers/ts/app/access-control.handler';
import { accessCatalogHandler } from '../../handlers/ts/app/access-catalog.handler';
import { resourceGrantPolicyHandler } from '../../handlers/ts/app/resource-grant-policy.handler';
import { sessionHandler } from '../../handlers/ts/app/session.handler';
import { appInstallationHandler } from '../../handlers/ts/app/app-installation.handler';
import { graphAnalysisHandler } from '../../handlers/ts/app/graph-analysis.handler';
import { analysisOverlayHandler } from '../../handlers/ts/app/analysis-overlay.handler';
import { analysisReportHandler } from '../../handlers/ts/app/analysis-report.handler';

// Infrastructure concepts — auto-registration
import { fileCatalogHandler } from '../../handlers/ts/app/file-catalog.handler';
import { runtimeRegistryHandler } from '../../handlers/ts/app/runtime-registry.handler';
import { entityReflectorHandler, setEntityReflectorKernel } from '../../handlers/ts/app/entity-reflector.handler';

import { bootstrapIdentity, getIdentityStorage } from './identity';
import {
  pickActiveTheme,
  resolveThemeDocumentState,
  type ThemeDocumentState,
  type ThemeRecord,
} from './theme-selection';

let _kernel: Kernel | null = null;
let _seedPromise: Promise<void> | null = null;

const CLEF_BASE_SYNC_FILES = [
  'suites/app-shell/syncs/destination-catalog-registers-navigator.sync',
  'suites/identity-integration/syncs/access-control-on-content-load.sync',
  'suites/identity-integration/syncs/access-control-on-content-save.sync',
  'suites/identity-integration/syncs/access-control-on-schema-apply.sync',
  'suites/identity-integration/syncs/session-create-sets-ui-transport-auth.sync',
  'suites/identity-integration/syncs/session-refresh-sets-ui-transport-auth.sync',
  'suites/identity-integration/syncs/session-destroy-clears-ui-transport-auth.sync',
  'suites/identity-integration/syncs/session-destroy-all-clears-ui-transport-auth.sync',
] as const;

// process.cwd() is the clef-base/ dir when Next.js runs; __filename
// resolves inside .next/server/ at runtime, so we can't use it.
const CLEF_BASE_ROOT = process.cwd();

// Presentation syncs from the Repertoire — DisplayMode/FieldPlacement rendering pipeline
const PRESENTATION_SYNC_FILES = [
  '../repertoire/concepts/presentation/syncs/display-mode-resolve-strategy.sync',
  '../repertoire/concepts/presentation/syncs/display-mode-uses-layout.sync',
  '../repertoire/concepts/presentation/syncs/display-mode-uses-mapping.sync',
  '../repertoire/concepts/presentation/syncs/view-resolves-contextual-filters.sync',
  '../repertoire/concepts/presentation/syncs/area-renders-field-placement.sync',
  '../repertoire/concepts/presentation/syncs/field-placement-uses-mapping.sync',
] as const;

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-base:${conceptName}`) ?? createInMemoryStorage();
}

function registerClefBaseSyncs(kernel: Kernel): string[] {
  const loadedSyncs: string[] = [];

  for (const relativePath of CLEF_BASE_SYNC_FILES) {
    const source = readFileSync(resolve(CLEF_BASE_ROOT, relativePath), 'utf-8');
    const syncs = parseSyncFile(source);
    for (const sync of syncs) {
      kernel.registerSync(sync);
      loadedSyncs.push(sync.name ?? relativePath);
    }
  }

  for (const relativePath of PRESENTATION_SYNC_FILES) {
    try {
      const source = readFileSync(resolve(CLEF_BASE_ROOT, relativePath), 'utf-8');
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        kernel.registerSync(sync);
        loadedSyncs.push(sync.name ?? relativePath);
      }
    } catch {
      // Presentation syncs are optional — don't fail startup if missing
    }
  }

  return loadedSyncs;
}

// Track registrations for RuntimeRegistry population
interface RegEntry {
  uri: string;
  hasStorage: boolean;
  storageName: string;
  storageType: string;
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  const registrations: RegEntry[] = [];

  function reg(uri: string, handler: ConceptHandler, storage?: ReturnType<typeof makeStorage>, meta?: { storageName?: string; storageType?: string }) {
    kernel.registerConcept(uri, handler, storage);
    registrations.push({
      uri,
      hasStorage: !!storage,
      storageName: meta?.storageName ?? '',
      storageType: meta?.storageType ?? (storage ? 'standard' : 'none'),
    });
  }

  // --- 1. Register infrastructure concepts early ---
  reg('urn:clef/RuntimeRegistry', runtimeRegistryHandler, makeStorage('runtime-registry'), { storageName: 'runtime-registry' });
  reg('urn:clef/FileCatalog', fileCatalogHandler, makeStorage('file-catalog'), { storageName: 'file-catalog' });
  reg('urn:clef/EntityReflector', entityReflectorHandler, makeStorage('entity-reflector'), { storageName: 'entity-reflector' });

  // --- 2. Register all other concepts ---
  reg('urn:clef/ComponentMapping', componentMappingHandler, makeStorage('mapping'), { storageName: 'mapping' });
  reg('urn:clef/ConceptBrowser', conceptBrowserHandler, makeStorage('browser'), { storageName: 'browser' });
  reg('urn:clef/SlotSource', slotSourceHandler);
  reg('urn:clef/BlockEmbedSource', blockEmbedSourceHandler);
  reg('urn:clef/EntityFieldSource', entityFieldSourceHandler);
  reg('urn:clef/EntityReferenceDisplaySource', entityReferenceDisplaySourceHandler);
  reg('urn:clef/FormulaSource', formulaSourceHandler);
  reg('urn:clef/MenuSource', menuSourceHandler);
  reg('urn:clef/StaticValueSource', staticValueSourceHandler);
  reg('urn:clef/ViewEmbedSource', viewEmbedSourceHandler);
  reg('urn:clef/WidgetEmbedSource', widgetEmbedSourceHandler);
  reg('urn:clef/HubProxy', hubProxyHandler);

  // UI-App concepts — Navigator, Host, Shell (AppShell derived)
  reg('urn:clef/Navigator', navigatorHandler, makeStorage('navigator'), { storageName: 'navigator' });
  reg('urn:clef/DestinationCatalog', destinationCatalogHandler, makeStorage('destination-catalog'), { storageName: 'destination-catalog' });
  reg('urn:clef/RuntimeProfile', runtimeProfileHandler, makeStorage('runtime-profile'), { storageName: 'runtime-profile' });
  reg('urn:clef/PlatformBindingCatalog', platformBindingCatalogHandler, makeStorage('platform-binding-catalog'), { storageName: 'platform-binding-catalog' });
  reg('urn:clef/Host', hostHandler, makeStorage('host'), { storageName: 'host' });
  reg('urn:clef/Shell', shellHandler, makeStorage('shell'), { storageName: 'shell' });
  reg('urn:clef/Transport', transportHandler, makeStorage('transport'), { storageName: 'transport' });
  reg('urn:clef/NextjsAdapter', nextjsAdapterHandler, makeStorage('nextjs-adapter'), { storageName: 'nextjs-adapter' });
  reg('urn:clef/PlatformAdapter', platformAdapterHandler, makeStorage('platform-adapter'), { storageName: 'platform-adapter' });
  reg('urn:clef/SeedData', seedDataHandler, makeStorage('seed-data'), { storageName: 'seed-data' });
  reg('urn:clef/AppInstallation', appInstallationHandler, makeStorage('app-installation'), { storageName: 'app-installation' });
  reg('urn:clef/Interactor', interactorHandler, makeStorage('interactor'), { storageName: 'interactor' });
  reg('urn:clef/Affordance', affordanceHandler, makeStorage('affordance'), { storageName: 'affordance' });
  reg('urn:clef/WidgetResolver', widgetResolverHandler, makeStorage('widget-resolver'), { storageName: 'widget-resolver' });
  reg('urn:clef/ContractChecker', contractCheckerHandler, makeStorage('contract-checker'), { storageName: 'contract-checker' });
  reg('urn:clef/WidgetRegistry', widgetRegistryHandler, makeStorage('widget-registry'), { storageName: 'widget-registry' });
  reg('urn:clef/UISchema', uiSchemaHandler, makeStorage('ui-schema'), { storageName: 'ui-schema' });

  // Domain concepts
  reg('urn:clef/ContentNode', contentNodeHandler, makeStorage('content-node'), { storageName: 'content-node' });
  reg('urn:clef/Schema', schemaHandler, makeStorage('schema'), { storageName: 'schema' });
  reg('urn:clef/View', viewHandler, makeStorage('view'), { storageName: 'view' });
  reg('urn:clef/Workflow', workflowHandler, makeStorage('workflow'), { storageName: 'workflow' });
  reg('urn:clef/AutomationRule', automationRuleHandler, makeStorage('automation-rule'), { storageName: 'automation-rule' });
  reg('urn:clef/Taxonomy', taxonomyHandler, makeStorage('taxonomy'), { storageName: 'taxonomy' });
  reg('urn:clef/DisplayMode', displayModeHandler, makeStorage('display-mode'), { storageName: 'display-mode' });
  reg('urn:clef/FieldPlacement', fieldPlacementHandler, makeStorage('field-placement'), { storageName: 'field-placement' });
  reg('urn:clef/Renderer', rendererHandler, makeStorage('renderer'), { storageName: 'renderer' });
  reg('urn:clef/Component', componentHandler, makeStorage('component'), { storageName: 'component' });
  reg('urn:clef/Theme', themeHandler, makeStorage('theme'), { storageName: 'theme' });
  reg('urn:clef/Query', queryHandler, makeStorage('query'), { storageName: 'query' });
  reg('urn:clef/ContentStorage', contentStorageHandler, makeStorage('content-storage'), { storageName: 'content-storage' });
  reg('urn:clef/Property', propertyHandler, makeStorage('property'), { storageName: 'property' });
  reg('urn:clef/Outline', outlineHandler, makeStorage('outline'), { storageName: 'outline' });
  reg('urn:clef/Layout', layoutHandler, makeStorage('layout'), { storageName: 'layout' });
  reg('urn:clef/Authentication', authenticationHandler, getIdentityStorage('authentication'), { storageName: 'authentication', storageType: 'identity' });
  reg('urn:clef/Authorization', authorizationHandler, getIdentityStorage('authorization'), { storageName: 'authorization', storageType: 'identity' });
  reg('urn:clef/AccessControl', accessControlHandler, getIdentityStorage('access-control'), { storageName: 'access-control', storageType: 'identity' });
  reg('urn:clef/AccessCatalog', accessCatalogHandler, getIdentityStorage('access-catalog'), { storageName: 'access-catalog', storageType: 'identity' });
  reg('urn:clef/ResourceGrantPolicy', resourceGrantPolicyHandler, getIdentityStorage('resource-grant-policy'), { storageName: 'resource-grant-policy', storageType: 'identity' });
  reg('urn:clef/Session', sessionHandler, getIdentityStorage('session'), { storageName: 'session', storageType: 'identity' });

  // Graph analysis concepts
  reg('urn:clef/GraphAnalysis', graphAnalysisHandler, makeStorage('graph-analysis'), { storageName: 'graph-analysis' });
  reg('urn:clef/AnalysisOverlay', analysisOverlayHandler, makeStorage('analysis-overlay'), { storageName: 'analysis-overlay' });
  reg('urn:clef/AnalysisReport', analysisReportHandler, makeStorage('analysis-report'), { storageName: 'analysis-report' });

  // --- 3. Register syncs ---
  const loadedSyncs = registerClefBaseSyncs(kernel);

  // --- 4. Wire EntityReflector kernel reference ---
  setEntityReflectorKernel(kernel);

  // --- 5. Seed data + populate RuntimeRegistry + reflect entities ---
  _seedPromise = seedData(kernel, registrations, loadedSyncs).then(() => bootstrapIdentity(kernel));

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
  const resolvedTokens = resolved.variant === 'ok' && typeof resolved.tokens === 'string'
    ? JSON.parse(resolved.tokens as string) as Record<string, unknown>
    : {};
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
  const discovery = await kernel.invokeConcept('urn:clef/SeedData', 'discover', {
    base_path: resolve(CLEF_BASE_ROOT, 'seeds'),
  });
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

async function seedData(kernel: Kernel, registrations: RegEntry[], loadedSyncs: string[]) {
  if (_seeded) return;
  _seeded = true;

  // Populate RuntimeRegistry with all registered concepts and syncs
  await populateRuntimeRegistry(kernel, registrations, loadedSyncs);

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
