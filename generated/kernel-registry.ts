// Auto-generated from deploy.yaml — do not edit
import type { ConceptHandler } from '../runtime/types';

import { runtimeRegistryHandler } from '../handlers/ts/app/runtime-registry.handler';
import { fileCatalogHandler } from '../handlers/ts/app/file-catalog.handler';
import { entityReflectorHandler } from '../handlers/ts/app/entity-reflector.handler';
import { componentMappingHandler } from '../handlers/ts/component-mapping.handler';
import { conceptBrowserHandler } from '../handlers/ts/concept-browser.handler';
import { slotSourceHandler } from '../handlers/ts/slot-source.handler';
import { blockEmbedSourceHandler } from '../handlers/ts/block-embed-source.handler';
import { entityFieldSourceHandler } from '../handlers/ts/entity-field-source.handler';
import { entityReferenceDisplaySourceHandler } from '../handlers/ts/entity-reference-display-source.handler';
import { formulaSourceHandler } from '../handlers/ts/formula-source.handler';
import { menuSourceHandler } from '../handlers/ts/menu-source.handler';
import { staticValueSourceHandler } from '../handlers/ts/static-value-source.handler';
import { viewEmbedSourceHandler } from '../handlers/ts/view-embed-source.handler';
import { widgetEmbedSourceHandler } from '../handlers/ts/widget-embed-source.handler';
import { hubProxyHandler } from '../clef-base/handlers/ts/hub-proxy.handler';
import { navigatorHandler } from '../handlers/ts/app/navigator.handler';
import { destinationCatalogHandler } from '../handlers/ts/app/destination-catalog.handler';
import { runtimeProfileHandler } from '../handlers/ts/app/runtime-profile.handler';
import { platformBindingCatalogHandler } from '../handlers/ts/app/platform-binding-catalog.handler';
import { hostHandler } from '../handlers/ts/app/host.handler';
import { shellHandler } from '../handlers/ts/app/shell.handler';
import { transportHandler } from '../handlers/ts/app/transport.handler';
import { nextjsAdapterHandler } from '../handlers/ts/app/nextjs-adapter.handler';
import { platformAdapterHandler } from '../handlers/ts/app/platform-adapter.handler';
import { seedDataHandler } from '../handlers/ts/seed-data.handler';
import { appInstallationHandler } from '../handlers/ts/app/app-installation.handler';
import { interactorHandler } from '../handlers/ts/app/interactor.handler';
import { affordanceHandler } from '../handlers/ts/app/affordance.handler';
import { widgetResolverHandler } from '../handlers/ts/app/widget-resolver.handler';
import { contractCheckerHandler } from '../handlers/ts/app/contract-checker.handler';
import { widgetRegistryHandler } from '../handlers/ts/app/widget-registry.handler';
import { uiSchemaHandler } from '../handlers/ts/app/ui-schema.handler';
import { contentNodeHandler } from '../handlers/ts/app/content-node.handler';
import { schemaHandler } from '../handlers/ts/app/schema.handler';
import { viewHandler } from '../handlers/ts/app/view.handler';
import { workflowHandler } from '../handlers/ts/app/workflow.handler';
import { automationRuleHandler } from '../handlers/ts/app/automation-rule.handler';
import { taxonomyHandler } from '../handlers/ts/app/taxonomy.handler';
import { displayModeHandler } from '../handlers/ts/app/display-mode.handler';
import { fieldPlacementHandler } from '../handlers/ts/app/field-placement.handler';
import { rendererHandler } from '../handlers/ts/app/renderer.handler';
import { componentHandler } from '../handlers/ts/app/component.handler';
import { themeHandler } from '../handlers/ts/app/theme.handler';
import { queryHandler } from '../handlers/ts/app/query.handler';
import { contentStorageHandler } from '../handlers/ts/app/content-storage.handler';
import { propertyHandler } from '../handlers/ts/app/property.handler';
import { outlineHandler } from '../handlers/ts/app/outline.handler';
import { layoutHandler } from '../handlers/ts/app/layout.handler';
import { authenticationHandler } from '../handlers/ts/app/authentication.handler';
import { authorizationHandler } from '../handlers/ts/app/authorization.handler';
import { accessControlHandler } from '../handlers/ts/app/access-control.handler';
import { accessCatalogHandler } from '../handlers/ts/app/access-catalog.handler';
import { resourceGrantPolicyHandler } from '../handlers/ts/app/resource-grant-policy.handler';
import { sessionHandler } from '../handlers/ts/app/session.handler';
import { graphAnalysisHandler } from '../handlers/ts/app/graph-analysis.handler';
import { analysisOverlayHandler } from '../handlers/ts/app/analysis-overlay.handler';
import { analysisReportHandler } from '../handlers/ts/app/analysis-report.handler';
import { relationHandler } from '../handlers/ts/app/relation.handler';
import { referenceHandler } from '../handlers/ts/app/reference.handler';
import { backlinkHandler } from '../handlers/ts/app/backlink.handler';
import { pluginRegistryHandler } from '../handlers/ts/app/plugin-registry.handler';
import { viewResolverHandler } from '../handlers/ts/view-resolver.handler';
import { kernelViewResolverHandler } from '../handlers/ts/kernel-view-resolver.handler';
import { reactViewResolverHandler } from '../handlers/ts/react-view-resolver.handler';

export interface RegistryEntry {
  uri: string;
  handler: ConceptHandler;
  storageName: string;
  storageType: 'standard' | 'identity' | 'none';
}

export const REGISTRY_ENTRIES: RegistryEntry[] = [
  { uri: 'urn:clef/RuntimeRegistry', handler: runtimeRegistryHandler, storageName: 'runtime-registry', storageType: 'standard' },
  { uri: 'urn:clef/FileCatalog', handler: fileCatalogHandler, storageName: 'file-catalog', storageType: 'standard' },
  { uri: 'urn:clef/EntityReflector', handler: entityReflectorHandler, storageName: 'entity-reflector', storageType: 'standard' },
  { uri: 'urn:clef/ComponentMapping', handler: componentMappingHandler, storageName: 'mapping', storageType: 'standard' },
  { uri: 'urn:clef/ConceptBrowser', handler: conceptBrowserHandler, storageName: 'browser', storageType: 'standard' },
  { uri: 'urn:clef/SlotSource', handler: slotSourceHandler, storageName: 'slot-source', storageType: 'none' },
  { uri: 'urn:clef/BlockEmbedSource', handler: blockEmbedSourceHandler, storageName: 'block-embed-source', storageType: 'none' },
  { uri: 'urn:clef/EntityFieldSource', handler: entityFieldSourceHandler, storageName: 'entity-field-source', storageType: 'none' },
  { uri: 'urn:clef/EntityReferenceDisplaySource', handler: entityReferenceDisplaySourceHandler, storageName: 'entity-reference-display-source', storageType: 'none' },
  { uri: 'urn:clef/FormulaSource', handler: formulaSourceHandler, storageName: 'formula-source', storageType: 'none' },
  { uri: 'urn:clef/MenuSource', handler: menuSourceHandler, storageName: 'menu-source', storageType: 'none' },
  { uri: 'urn:clef/StaticValueSource', handler: staticValueSourceHandler, storageName: 'static-value-source', storageType: 'none' },
  { uri: 'urn:clef/ViewEmbedSource', handler: viewEmbedSourceHandler, storageName: 'view-embed-source', storageType: 'none' },
  { uri: 'urn:clef/WidgetEmbedSource', handler: widgetEmbedSourceHandler, storageName: 'widget-embed-source', storageType: 'none' },
  { uri: 'urn:clef/HubProxy', handler: hubProxyHandler, storageName: 'hub-proxy', storageType: 'none' },
  { uri: 'urn:clef/Navigator', handler: navigatorHandler, storageName: 'navigator', storageType: 'standard' },
  { uri: 'urn:clef/DestinationCatalog', handler: destinationCatalogHandler, storageName: 'destination-catalog', storageType: 'standard' },
  { uri: 'urn:clef/RuntimeProfile', handler: runtimeProfileHandler, storageName: 'runtime-profile', storageType: 'standard' },
  { uri: 'urn:clef/PlatformBindingCatalog', handler: platformBindingCatalogHandler, storageName: 'platform-binding-catalog', storageType: 'standard' },
  { uri: 'urn:clef/Host', handler: hostHandler, storageName: 'host', storageType: 'standard' },
  { uri: 'urn:clef/Shell', handler: shellHandler, storageName: 'shell', storageType: 'standard' },
  { uri: 'urn:clef/Transport', handler: transportHandler, storageName: 'transport', storageType: 'standard' },
  { uri: 'urn:clef/NextjsAdapter', handler: nextjsAdapterHandler, storageName: 'nextjs-adapter', storageType: 'standard' },
  { uri: 'urn:clef/PlatformAdapter', handler: platformAdapterHandler, storageName: 'platform-adapter', storageType: 'standard' },
  { uri: 'urn:clef/SeedData', handler: seedDataHandler, storageName: 'seed-data', storageType: 'standard' },
  { uri: 'urn:clef/AppInstallation', handler: appInstallationHandler, storageName: 'app-installation', storageType: 'standard' },
  { uri: 'urn:clef/Interactor', handler: interactorHandler, storageName: 'interactor', storageType: 'standard' },
  { uri: 'urn:clef/Affordance', handler: affordanceHandler, storageName: 'affordance', storageType: 'standard' },
  { uri: 'urn:clef/WidgetResolver', handler: widgetResolverHandler, storageName: 'widget-resolver', storageType: 'standard' },
  { uri: 'urn:clef/ContractChecker', handler: contractCheckerHandler, storageName: 'contract-checker', storageType: 'standard' },
  { uri: 'urn:clef/WidgetRegistry', handler: widgetRegistryHandler, storageName: 'widget-registry', storageType: 'standard' },
  { uri: 'urn:clef/UISchema', handler: uiSchemaHandler, storageName: 'ui-schema', storageType: 'standard' },
  { uri: 'urn:clef/ContentNode', handler: contentNodeHandler, storageName: 'content-node', storageType: 'standard' },
  { uri: 'urn:clef/Schema', handler: schemaHandler, storageName: 'schema', storageType: 'standard' },
  { uri: 'urn:clef/View', handler: viewHandler, storageName: 'view', storageType: 'standard' },
  { uri: 'urn:clef/Workflow', handler: workflowHandler, storageName: 'workflow', storageType: 'standard' },
  { uri: 'urn:clef/AutomationRule', handler: automationRuleHandler, storageName: 'automation-rule', storageType: 'standard' },
  { uri: 'urn:clef/Taxonomy', handler: taxonomyHandler, storageName: 'taxonomy', storageType: 'standard' },
  { uri: 'urn:clef/DisplayMode', handler: displayModeHandler, storageName: 'display-mode', storageType: 'standard' },
  { uri: 'urn:clef/FieldPlacement', handler: fieldPlacementHandler, storageName: 'field-placement', storageType: 'standard' },
  { uri: 'urn:clef/Renderer', handler: rendererHandler, storageName: 'renderer', storageType: 'standard' },
  { uri: 'urn:clef/Component', handler: componentHandler, storageName: 'component', storageType: 'standard' },
  { uri: 'urn:clef/Theme', handler: themeHandler, storageName: 'theme', storageType: 'standard' },
  { uri: 'urn:clef/Query', handler: queryHandler, storageName: 'query', storageType: 'standard' },
  { uri: 'urn:clef/ContentStorage', handler: contentStorageHandler, storageName: 'content-storage', storageType: 'standard' },
  { uri: 'urn:clef/Property', handler: propertyHandler, storageName: 'property', storageType: 'standard' },
  { uri: 'urn:clef/Outline', handler: outlineHandler, storageName: 'outline', storageType: 'standard' },
  { uri: 'urn:clef/Layout', handler: layoutHandler, storageName: 'layout', storageType: 'standard' },
  { uri: 'urn:clef/Authentication', handler: authenticationHandler, storageName: 'authentication', storageType: 'identity' },
  { uri: 'urn:clef/Authorization', handler: authorizationHandler, storageName: 'authorization', storageType: 'identity' },
  { uri: 'urn:clef/AccessControl', handler: accessControlHandler, storageName: 'access-control', storageType: 'identity' },
  { uri: 'urn:clef/AccessCatalog', handler: accessCatalogHandler, storageName: 'access-catalog', storageType: 'identity' },
  { uri: 'urn:clef/ResourceGrantPolicy', handler: resourceGrantPolicyHandler, storageName: 'resource-grant-policy', storageType: 'identity' },
  { uri: 'urn:clef/Session', handler: sessionHandler, storageName: 'session', storageType: 'identity' },
  { uri: 'urn:clef/GraphAnalysis', handler: graphAnalysisHandler, storageName: 'graph-analysis', storageType: 'standard' },
  { uri: 'urn:clef/AnalysisOverlay', handler: analysisOverlayHandler, storageName: 'analysis-overlay', storageType: 'standard' },
  { uri: 'urn:clef/AnalysisReport', handler: analysisReportHandler, storageName: 'analysis-report', storageType: 'standard' },
  { uri: 'urn:clef/Relation', handler: relationHandler, storageName: 'relation', storageType: 'standard' },
  { uri: 'urn:clef/Reference', handler: referenceHandler, storageName: 'reference', storageType: 'standard' },
  { uri: 'urn:clef/Backlink', handler: backlinkHandler, storageName: 'backlink', storageType: 'standard' },
  { uri: 'urn:clef/PluginRegistry', handler: pluginRegistryHandler, storageName: 'plugin-registry', storageType: 'standard' },
  { uri: 'urn:clef/ViewResolver', handler: viewResolverHandler, storageName: 'view-resolver', storageType: 'standard' },
  { uri: 'urn:clef/KernelViewResolver', handler: kernelViewResolverHandler, storageName: 'kernel-view-resolver', storageType: 'standard' },
  { uri: 'urn:clef/ReactViewResolver', handler: reactViewResolverHandler, storageName: 'react-view-resolver', storageType: 'standard' },
];

export const SYNC_FILES: string[] = [
  'clef-base/suites/app-shell/syncs/destination-catalog-registers-navigator.sync',
  'clef-base/suites/identity-integration/syncs/access-control-on-content-load.sync',
  'clef-base/suites/identity-integration/syncs/access-control-on-content-save.sync',
  'clef-base/suites/identity-integration/syncs/access-control-on-schema-apply.sync',
  'clef-base/suites/identity-integration/syncs/session-create-sets-ui-transport-auth.sync',
  'clef-base/suites/identity-integration/syncs/session-refresh-sets-ui-transport-auth.sync',
  'clef-base/suites/identity-integration/syncs/session-destroy-clears-ui-transport-auth.sync',
  'clef-base/suites/identity-integration/syncs/session-destroy-all-clears-ui-transport-auth.sync',
  'repertoire/concepts/presentation/syncs/display-mode-resolve-strategy.sync',
  'repertoire/concepts/presentation/syncs/display-mode-uses-layout.sync',
  'repertoire/concepts/presentation/syncs/display-mode-uses-mapping.sync',
  'repertoire/concepts/presentation/syncs/view-resolves-contextual-filters.sync',
  'repertoire/concepts/presentation/syncs/area-renders-field-placement.sync',
  'repertoire/concepts/presentation/syncs/field-placement-uses-mapping.sync',
  'clef-base/suites/view-resolver/syncs/kernel-view-resolver-registration.sync',
  'clef-base/suites/view-resolver/syncs/react-view-resolver-registration.sync',
  'clef-base/suites/view-resolver/syncs/view-resolver-dispatches-to-provider.sync',
  'clef-base/suites/view-resolver/syncs/kernel-resolver-fetches-data.sync',
  'clef-base/suites/view-resolver/syncs/view-resolve-tracks-items.sync',
  'repertoire/concepts/linking/syncs/bidirectional-links.sync',
  'repertoire/concepts/linking/syncs/relation-reference-bridge.sync',
];
