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
import { bootstrapIdentity, getIdentityStorage } from './identity';
import { pickActiveTheme, type ThemeRecord } from './theme-selection';

let _kernel: Kernel | null = null;
let _seedPromise: Promise<void> | null = null;
const _registeredConcepts: { uri: string; hasStorage: boolean }[] = [];
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

function registerClefBaseSyncs(kernel: Kernel) {
  for (const relativePath of CLEF_BASE_SYNC_FILES) {
    const source = readFileSync(resolve(relativePath), 'utf-8');
    const syncs = parseSyncFile(source);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }
  }

  for (const relativePath of PRESENTATION_SYNC_FILES) {
    try {
      const source = readFileSync(resolve(relativePath), 'utf-8');
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        kernel.registerSync(sync);
      }
    } catch {
      // Presentation syncs are optional — don't fail startup if missing
    }
  }
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  function reg(uri: string, handler: ConceptHandler, storage?: ReturnType<typeof makeStorage>) {
    kernel.registerConcept(uri, handler, storage);
    _registeredConcepts.push({ uri, hasStorage: !!storage });
  }

  reg('urn:clef/ComponentMapping', componentMappingHandler, makeStorage('mapping'));
  reg('urn:clef/ConceptBrowser', conceptBrowserHandler, makeStorage('browser'));
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
  reg('urn:clef/Navigator', navigatorHandler, makeStorage('navigator'));
  reg('urn:clef/DestinationCatalog', destinationCatalogHandler, makeStorage('destination-catalog'));
  reg('urn:clef/RuntimeProfile', runtimeProfileHandler, makeStorage('runtime-profile'));
  reg('urn:clef/PlatformBindingCatalog', platformBindingCatalogHandler, makeStorage('platform-binding-catalog'));
  reg('urn:clef/Host', hostHandler, makeStorage('host'));
  reg('urn:clef/Shell', shellHandler, makeStorage('shell'));
  reg('urn:clef/Transport', transportHandler, makeStorage('transport'));
  reg('urn:clef/NextjsAdapter', nextjsAdapterHandler, makeStorage('nextjs-adapter'));
  reg('urn:clef/PlatformAdapter', platformAdapterHandler, makeStorage('platform-adapter'));
  reg('urn:clef/SeedData', seedDataHandler, makeStorage('seed-data'));
  reg('urn:clef/AppInstallation', appInstallationHandler, makeStorage('app-installation'));

  // Domain concepts
  reg('urn:clef/ContentNode', contentNodeHandler, makeStorage('content-node'));
  reg('urn:clef/Schema', schemaHandler, makeStorage('schema'));
  reg('urn:clef/View', viewHandler, makeStorage('view'));
  reg('urn:clef/Workflow', workflowHandler, makeStorage('workflow'));
  reg('urn:clef/AutomationRule', automationRuleHandler, makeStorage('automation-rule'));
  reg('urn:clef/Taxonomy', taxonomyHandler, makeStorage('taxonomy'));
  reg('urn:clef/DisplayMode', displayModeHandler, makeStorage('display-mode'));
  reg('urn:clef/FieldPlacement', fieldPlacementHandler, makeStorage('field-placement'));
  reg('urn:clef/Renderer', rendererHandler, makeStorage('renderer'));
  reg('urn:clef/Component', componentHandler, makeStorage('component'));
  reg('urn:clef/Theme', themeHandler, makeStorage('theme'));
  reg('urn:clef/Query', queryHandler, makeStorage('query'));
  reg('urn:clef/ContentStorage', contentStorageHandler, makeStorage('content-storage'));
  reg('urn:clef/Property', propertyHandler, makeStorage('property'));
  reg('urn:clef/Outline', outlineHandler, makeStorage('outline'));
  reg('urn:clef/Layout', layoutHandler, makeStorage('layout'));
  reg('urn:clef/Authentication', authenticationHandler, getIdentityStorage('authentication'));
  reg('urn:clef/Authorization', authorizationHandler, getIdentityStorage('authorization'));
  reg('urn:clef/AccessControl', accessControlHandler, getIdentityStorage('access-control'));
  reg('urn:clef/AccessCatalog', accessCatalogHandler, getIdentityStorage('access-catalog'));
  reg('urn:clef/ResourceGrantPolicy', resourceGrantPolicyHandler, getIdentityStorage('resource-grant-policy'));
  reg('urn:clef/Session', sessionHandler, getIdentityStorage('session'));

  // Graph analysis concepts
  reg('urn:clef/GraphAnalysis', graphAnalysisHandler, makeStorage('graph-analysis'));
  reg('urn:clef/AnalysisOverlay', analysisOverlayHandler, makeStorage('analysis-overlay'));
  reg('urn:clef/AnalysisReport', analysisReportHandler, makeStorage('analysis-report'));

  registerClefBaseSyncs(kernel);

  // Seed data on first initialization
  _seedPromise = seedData(kernel).then(() => bootstrapIdentity(kernel));

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
    base_path: resolve('seeds'),
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

async function seedData(kernel: Kernel) {
  if (_seeded) return;
  _seeded = true;

  await applyDeclarativeSeeds(kernel);
}

export function getRegisteredConcepts() {
  getKernel(); // ensure initialized
  return _registeredConcepts;
}
