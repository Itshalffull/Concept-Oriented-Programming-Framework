import { createConceptRegistry } from '../../runtime/adapters/transport';
import { createSelfHostedKernel } from '../../runtime/self-hosted';
import { createSyncEngineHandler } from '../../handlers/ts/framework/sync-engine.handler';
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

// Domain concepts
import { contentNodeHandler } from '../../handlers/ts/app/content-node.handler';
import { schemaHandler } from '../../handlers/ts/app/schema.handler';
import { viewHandler } from '../../handlers/ts/app/view.handler';
import { workflowHandler } from '../../handlers/ts/app/workflow.handler';
import { automationRuleHandler } from '../../handlers/ts/app/automation-rule.handler';
import { taxonomyHandler } from '../../handlers/ts/app/taxonomy.handler';
import { displayModeHandler } from '../../handlers/ts/app/display-mode.handler';
import { themeHandler } from '../../handlers/ts/app/theme.handler';
import { queryHandler } from '../../handlers/ts/app/query.handler';
import { contentStorageHandler } from '../../handlers/ts/app/content-storage.handler';
import { propertyHandler } from '../../handlers/ts/app/property.handler';
import { outlineHandler } from '../../handlers/ts/app/outline.handler';
import { layoutHandler } from '../../handlers/ts/app/layout.handler';

let _kernel: Kernel | null = null;
let _seedPromise: Promise<void> | null = null;
const _registeredConcepts: { uri: string; hasStorage: boolean }[] = [];

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-base:${conceptName}`) ?? createInMemoryStorage();
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
  reg('urn:clef/Host', hostHandler, makeStorage('host'));
  reg('urn:clef/Shell', shellHandler, makeStorage('shell'));
  reg('urn:clef/Transport', transportHandler, makeStorage('transport'));
  reg('urn:clef/NextjsAdapter', nextjsAdapterHandler, makeStorage('nextjs-adapter'));
  reg('urn:clef/PlatformAdapter', platformAdapterHandler, makeStorage('platform-adapter'));

  // Domain concepts
  reg('urn:clef/ContentNode', contentNodeHandler, makeStorage('content-node'));
  reg('urn:clef/Schema', schemaHandler, makeStorage('schema'));
  reg('urn:clef/View', viewHandler, makeStorage('view'));
  reg('urn:clef/Workflow', workflowHandler, makeStorage('workflow'));
  reg('urn:clef/AutomationRule', automationRuleHandler, makeStorage('automation-rule'));
  reg('urn:clef/Taxonomy', taxonomyHandler, makeStorage('taxonomy'));
  reg('urn:clef/DisplayMode', displayModeHandler, makeStorage('display-mode'));
  reg('urn:clef/Theme', themeHandler, makeStorage('theme'));
  reg('urn:clef/Query', queryHandler, makeStorage('query'));
  reg('urn:clef/ContentStorage', contentStorageHandler, makeStorage('content-storage'));
  reg('urn:clef/Property', propertyHandler, makeStorage('property'));
  reg('urn:clef/Outline', outlineHandler, makeStorage('outline'));
  reg('urn:clef/Layout', layoutHandler, makeStorage('layout'));

  // Seed data on first initialization
  _seedPromise = seedData(kernel);

  _kernel = kernel;
  return kernel;
}

/** Await this before querying seeded data */
export function ensureSeeded(): Promise<void> {
  getKernel(); // ensure initialized
  return _seedPromise ?? Promise.resolve();
}

let _seeded = false;

async function seedData(kernel: Kernel) {
  if (_seeded) return;
  _seeded = true;

  const inv = (concept: string, action: string, input: Record<string, unknown>) =>
    kernel.invokeConcept(`urn:clef/${concept}`, action, input).catch(() => {});

  // Seed schemas
  const schemas = [
    { schema: 'ContentNode', fields: 'node,type,content,metadata,createdBy,createdAt,updatedAt' },
    { schema: 'Article', fields: 'title,body,author,publishedAt,status' },
    { schema: 'Page', fields: 'title,slug,body,template,publishedAt' },
    { schema: 'Media', fields: 'url,alt,mimeType,size,dimensions' },
    { schema: 'View', fields: 'view,dataSource,layout,filters,sorts,groups,visibleFields' },
    { schema: 'Workflow', fields: 'workflow,states,transitions,entities' },
    { schema: 'AutomationRule', fields: 'rule,trigger,conditions,actions,enabled' },
    { schema: 'TaxonomyTerm', fields: 'term,vocab,parent' },
    { schema: 'Vocabulary', fields: 'vocab,name,terms' },
    { schema: 'Schema', fields: 'schema,fields,extends,associations' },
    { schema: 'DisplayMode', fields: 'mode,name,fieldDisplayConfigs,fieldFormConfigs' },
    { schema: 'Theme', fields: 'name,base,overrides,active,priority' },
    { schema: 'ComponentMapping', fields: 'mapping,widget,concept,action' },
    { schema: 'Comment', fields: 'comment,author,body,target,createdAt' },
    { schema: 'File', fields: 'file,path,mimeType,size,hash' },
  ];

  for (const s of schemas) {
    await inv('Schema', 'defineSchema', s);
  }

  // Seed display modes
  const modes = [
    { mode: 'entity-page', name: 'Entity Page' },
    { mode: 'table-row', name: 'Table Row' },
    { mode: 'card', name: 'Card' },
    { mode: 'compact', name: 'Compact' },
    { mode: 'score-graph', name: 'Score Graph' },
  ];

  for (const m of modes) {
    await inv('DisplayMode', 'defineMode', m);
  }

  // Seed themes
  const themes = [
    { theme: 'light', name: 'Light', overrides: JSON.stringify({ mode: 'light' }) },
    { theme: 'dark', name: 'Dark', overrides: JSON.stringify({ mode: 'dark' }) },
    { theme: 'high-contrast', name: 'High Contrast', overrides: JSON.stringify({ mode: 'high-contrast' }) },
  ];

  for (const t of themes) {
    await inv('Theme', 'create', t);
  }

  // Seed taxonomies
  await inv('Taxonomy', 'createVocabulary', { vocab: 'concept-suites', name: 'Concept Suites' });
  await inv('Taxonomy', 'createVocabulary', { vocab: 'schema-categories', name: 'Schema Categories' });
  await inv('Taxonomy', 'createVocabulary', { vocab: 'content-types', name: 'Content Types' });

  // Seed content nodes for each registered concept
  const conceptNames = [
    'ContentNode', 'Schema', 'View', 'Workflow', 'AutomationRule',
    'Taxonomy', 'DisplayMode', 'Theme', 'Query', 'ContentStorage',
    'Property', 'Outline', 'ComponentMapping', 'ConceptBrowser',
    'Navigator', 'Host', 'Shell', 'Transport', 'Layout',
  ];

  for (const name of conceptNames) {
    await inv('ContentNode', 'create', {
      node: `concept:${name}`,
      type: 'concept',
      content: JSON.stringify({ name, uri: `urn:clef/${name}` }),
      createdBy: 'system',
    });
  }

  // Seed content nodes for schemas
  for (const s of schemas) {
    await inv('ContentNode', 'create', {
      node: `schema:${s.schema}`,
      type: 'schema',
      content: JSON.stringify({ schema: s.schema, fields: s.fields.split(',') }),
      createdBy: 'system',
    });
  }

  // Seed View configs — each page route is driven by a View config entity
  const views: Array<{
    view: string; title: string; description: string;
    dataSource: string; layout: string;
    visibleFields: string; controls: string;
    filters?: string;
  }> = [
    {
      view: 'content-list',
      title: 'Content',
      description: 'Browse all content entities in the system.',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Name' },
        { key: 'type', label: 'Type', formatter: 'badge' },
        { key: 'createdBy', label: 'Created By' },
        { key: 'createdAt', label: 'Created', formatter: 'date' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'ContentNode', action: 'create', fields: [
          { name: 'node', label: 'Node ID', required: true },
          { name: 'type', label: 'Type', type: 'select', options: ['article','page','media','concept','schema','workflow','view','theme'], required: true },
          { name: 'content', label: 'Content', type: 'textarea' },
          { name: 'createdBy', label: 'Created By' },
        ]},
        rowClick: { navigateTo: '/content/{node}' },
      }),
      filters: JSON.stringify([
        { field: 'type', label: 'Type', type: 'toggle-group' },
      ]),
    },
    {
      view: 'schemas-list',
      title: 'Schemas',
      description: 'Composable data shapes applied to ContentNodes.',
      dataSource: JSON.stringify({ concept: 'Schema', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'schema', label: 'Schema Name' },
        { key: 'fields', label: 'Fields', formatter: 'json-count' },
        { key: 'extends', label: 'Extends', formatter: 'badge' },
        { key: 'associations', label: 'Associations', formatter: 'json-count' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'Schema', action: 'defineSchema', fields: [
          { name: 'schema', label: 'Schema Name', required: true },
          { name: 'fields', label: 'Fields (comma-separated)', required: true },
        ]},
        rowClick: { navigateTo: '/content/schema:{schema}' },
      }),
    },
    {
      view: 'workflows-list',
      title: 'Workflows',
      description: 'Content moderation state machines with states and transitions.',
      dataSource: JSON.stringify({ concept: 'Workflow', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'workflow', label: 'Workflow' },
        { key: 'states', label: 'States', formatter: 'json-count' },
        { key: 'transitions', label: 'Transitions', formatter: 'json-count' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'Workflow', action: 'defineState', fields: [
          { name: 'workflow', label: 'Workflow Name', required: true },
          { name: 'name', label: 'Initial State Name', required: true },
          { name: 'flags', label: 'Flags', placeholder: 'initial' },
        ]},
      }),
    },
    {
      view: 'automations-list',
      title: 'Automations',
      description: 'Event-condition-action rules that fire automatically.',
      dataSource: JSON.stringify({ concept: 'AutomationRule', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'rule', label: 'Rule' },
        { key: 'trigger', label: 'Trigger' },
        { key: 'conditions', label: 'Conditions' },
        { key: 'enabled', label: 'Enabled', formatter: 'boolean-badge' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'AutomationRule', action: 'define', fields: [
          { name: 'rule', label: 'Rule ID', required: true },
          { name: 'trigger', label: 'Trigger Event', required: true },
          { name: 'conditions', label: 'Conditions' },
          { name: 'actions', label: 'Actions', required: true },
        ]},
      }),
    },
    {
      view: 'taxonomy-list',
      title: 'Taxonomy',
      description: 'Hierarchical classification using Vocabularies and Terms.',
      dataSource: JSON.stringify({ concept: 'Taxonomy', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'vocab', label: 'Vocabulary ID' },
        { key: 'name', label: 'Name' },
        { key: 'terms', label: 'Terms', formatter: 'json-count' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'Taxonomy', action: 'createVocabulary', fields: [
          { name: 'vocab', label: 'Vocabulary ID', required: true },
          { name: 'name', label: 'Display Name', required: true },
        ]},
      }),
    },
    {
      view: 'themes-list',
      title: 'Themes',
      description: 'Design system themes with token inheritance.',
      dataSource: JSON.stringify({ concept: 'Theme', action: 'list' }),
      layout: 'card-grid',
      visibleFields: JSON.stringify([
        { key: 'name', label: 'Name' },
        { key: 'base', label: 'Extends', formatter: 'badge' },
        { key: 'active', label: 'Active', formatter: 'boolean-badge' },
        { key: 'overrides', label: 'Overrides', formatter: 'json-count' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'Theme', action: 'create', fields: [
          { name: 'theme', label: 'Theme ID', required: true },
          { name: 'name', label: 'Display Name', required: true },
          { name: 'overrides', label: 'Token Overrides (JSON)', type: 'textarea' },
        ]},
      }),
    },
    {
      view: 'display-modes-list',
      title: 'Display Modes',
      description: 'Named presentation profiles controlling per-field rendering.',
      dataSource: JSON.stringify({ concept: 'DisplayMode', action: 'list' }),
      layout: 'card-grid',
      visibleFields: JSON.stringify([
        { key: 'mode', label: 'Mode ID' },
        { key: 'name', label: 'Name' },
        { key: 'fieldDisplayConfigs', label: 'Display Configs', formatter: 'json-count' },
        { key: 'fieldFormConfigs', label: 'Form Configs', formatter: 'json-count' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'DisplayMode', action: 'defineMode', fields: [
          { name: 'mode', label: 'Mode ID', required: true },
          { name: 'name', label: 'Display Name', required: true },
        ]},
      }),
    },
    {
      view: 'views-list',
      title: 'Views',
      description: 'Saved queries with display configuration.',
      dataSource: JSON.stringify({ concept: 'View', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'view', label: 'View ID' },
        { key: 'title', label: 'Title' },
        { key: 'layout', label: 'Display Type', formatter: 'badge' },
        { key: 'dataSource', label: 'Data Source' },
      ]),
      controls: JSON.stringify({
        create: { concept: 'View', action: 'create', fields: [
          { name: 'view', label: 'View ID', required: true },
          { name: 'dataSource', label: 'Data Source (JSON)', required: true, type: 'textarea' },
          { name: 'layout', label: 'Display Type', type: 'select', options: ['table','card-grid','tree','board','calendar','timeline','graph'] },
          { name: 'title', label: 'Title' },
          { name: 'description', label: 'Description' },
        ]},
      }),
    },
    {
      view: 'mappings-list',
      title: 'Component Mappings',
      description: 'Widget-to-Schema-to-DisplayMode bindings.',
      dataSource: JSON.stringify({ concept: 'ComponentMapping', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'schema', label: 'Schema' },
        { key: 'displayMode', label: 'Display Mode', formatter: 'badge' },
        { key: 'widget', label: 'Widget' },
        { key: 'slots', label: 'Slots' },
      ]),
      controls: JSON.stringify({}),
    },
  ];

  // Views for layout-composed pages (embedded in Layouts below)
  const embeddedViews: typeof views = [
    // Dashboard embedded views
    {
      view: 'dashboard-stats',
      title: 'System Stats',
      description: '',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'stats' }),
      layout: 'stat-cards',
      visibleFields: JSON.stringify([
        { key: 'label', label: 'Label' },
        { key: 'value', label: 'Value' },
        { key: 'description', label: 'Description' },
      ]),
      controls: JSON.stringify({}),
    },
    {
      view: 'dashboard-concepts',
      title: 'Registered Concepts',
      description: '',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list', params: { type: 'concept' } }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Concept' },
        { key: 'type', label: 'Type', formatter: 'badge' },
        { key: 'createdBy', label: 'Source' },
      ]),
      controls: JSON.stringify({
        rowClick: { navigateTo: '/content/{node}' },
      }),
    },
    // Score — concept graph view (full system topology)
    {
      view: 'concept-graph',
      title: 'Score Graph',
      description: 'Full system topology — concepts, schemas, syncs, suites, and their relationships. Toggle filters to focus.',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list' }),
      layout: 'graph',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Node' },
        { key: 'type', label: 'Type' },
        { key: 'content', label: 'Content' },
      ]),
      controls: JSON.stringify({
        rowClick: { navigateTo: '/content/{node}' },
      }),
      filters: JSON.stringify([
        { field: 'type', label: 'Type', type: 'toggle-group' },
      ]),
    },
    {
      view: 'score-schemas',
      title: 'Schema Browser',
      description: 'Browse all schema definitions.',
      dataSource: JSON.stringify({ concept: 'Schema', action: 'list' }),
      layout: 'card-grid',
      visibleFields: JSON.stringify([
        { key: 'schema', label: 'Schema' },
        { key: 'fields', label: 'Fields', formatter: 'json-count' },
      ]),
      controls: JSON.stringify({
        rowClick: { navigateTo: '/content/schema:{schema}' },
      }),
    },
    // Syncs list view
    {
      view: 'syncs-list',
      title: 'Sync Rules',
      description: 'Synchronization rules wiring concepts together through pattern matching.',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list', params: { type: 'sync' } }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Sync Name' },
        { key: 'type', label: 'Type', formatter: 'badge' },
        { key: 'content', label: 'Pattern' },
      ]),
      controls: JSON.stringify({}),
    },
    // Concept browser views
    {
      view: 'installed-suites',
      title: 'Installed Suites',
      description: 'Concept suite packages installed in this kernel.',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list', params: { type: 'suite' } }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Suite' },
        { key: 'type', label: 'Type', formatter: 'badge' },
        { key: 'content', label: 'Details' },
      ]),
      controls: JSON.stringify({}),
    },
    // Entity detail — structured zone (property grid for single entity)
    {
      view: 'entity-properties',
      title: 'Properties',
      description: '',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'get', params: { node: '{{entityId}}' } }),
      layout: 'detail',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'ID', formatter: 'code' },
        { key: 'type', label: 'Type', formatter: 'badge' },
        { key: 'createdBy', label: 'Source' },
        { key: 'metadata', label: 'Metadata' },
      ]),
      controls: JSON.stringify({}),
    },
    // Entity detail — unstructured zone (content body / block editor)
    {
      view: 'entity-content',
      title: 'Content',
      description: '',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'get', params: { node: '{{entityId}}' } }),
      layout: 'content-body',
      visibleFields: JSON.stringify([
        { key: 'content', label: 'Content' },
      ]),
      controls: JSON.stringify({}),
    },
    // Entity detail — related zone: same-type entities
    {
      view: 'entity-same-type',
      title: 'Same Type',
      description: 'Other entities of the same type.',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list', params: { type: '{{entityType}}' } }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Entity' },
        { key: 'type', label: 'Type', formatter: 'badge' },
        { key: 'createdBy', label: 'Source' },
      ]),
      controls: JSON.stringify({
        rowClick: { navigateTo: '/content/{node}' },
      }),
    },
    // Entity detail — related zone: all content (cross-reference)
    {
      view: 'entity-all-content',
      title: 'All Content',
      description: 'Browse all entities in the system.',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list' }),
      layout: 'table',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Entity' },
        { key: 'type', label: 'Type', formatter: 'badge' },
      ]),
      controls: JSON.stringify({
        rowClick: { navigateTo: '/content/{node}' },
      }),
      filters: JSON.stringify([
        { field: 'type', label: 'Type', type: 'toggle-group' },
      ]),
    },
    // Multiverse (version spaces)
    {
      view: 'version-spaces-list',
      title: 'Version Spaces',
      description: 'Named content variations — like git branches for content.',
      dataSource: JSON.stringify({ concept: 'ContentNode', action: 'list', params: { type: 'version-space' } }),
      layout: 'card-grid',
      visibleFields: JSON.stringify([
        { key: 'node', label: 'Space' },
        { key: 'type', label: 'Type', formatter: 'badge' },
        { key: 'createdBy', label: 'Created By' },
      ]),
      controls: JSON.stringify({}),
    },
  ];

  const allViews = [...views, ...embeddedViews];

  for (const v of allViews) {
    await inv('View', 'create', {
      view: v.view,
      dataSource: v.dataSource,
      layout: v.layout,
      visibleFields: v.visibleFields,
      controls: v.controls,
      title: v.title,
      description: v.description,
      filters: (v as Record<string, unknown>).filters ?? '',
    });
  }

  // Seed Layout configs — pages composed of multiple Views
  const layouts = [
    {
      layout: 'dashboard',
      name: 'Dashboard',
      kind: 'stack',
      title: 'Dashboard',
      description: 'System overview with live stats and registered concepts.',
      children: JSON.stringify([
        { type: 'view', id: 'dashboard-stats' },
        { type: 'view', id: 'dashboard-concepts' },
        { type: 'view', id: 'content-list' },
      ]),
    },
    {
      layout: 'score',
      name: 'Score',
      kind: 'stack',
      title: 'Score',
      description: 'Code-as-data analysis: concept dependencies, sync chains, and schema browsing.',
      children: JSON.stringify([
        { type: 'view', id: 'concept-graph' },
        { type: 'view', id: 'score-schemas' },
      ]),
    },
    {
      layout: 'syncs',
      name: 'Syncs',
      kind: 'stack',
      title: 'Syncs',
      description: 'Sync rules wire concepts together through pattern matching on completions.',
      children: JSON.stringify([
        { type: 'view', id: 'syncs-list' },
      ]),
    },
    {
      layout: 'concept-browser',
      name: 'Concept Browser',
      kind: 'stack',
      title: 'Concept Browser',
      description: 'Browse and manage concept suite packages.',
      children: JSON.stringify([
        { type: 'view', id: 'installed-suites' },
        { type: 'view', id: 'concept-graph' },
      ]),
    },
    {
      layout: 'entity-detail',
      name: 'Entity Detail',
      kind: 'stack',
      title: '',
      description: '',
      children: JSON.stringify([
        { type: 'view', id: 'entity-properties' },
        { type: 'view', id: 'entity-content' },
        { type: 'view', id: 'entity-same-type' },
        { type: 'view', id: 'entity-all-content' },
      ]),
    },
    {
      layout: 'multiverse',
      name: 'Version Spaces',
      kind: 'stack',
      title: 'Version Spaces',
      description: 'Named content variations — like git branches for content. Each space can override any ContentNode.',
      children: JSON.stringify([
        { type: 'view', id: 'version-spaces-list' },
      ]),
    },
  ];

  for (const l of layouts) {
    await inv('Layout', 'create', l);
  }

  // Seed sync content nodes so syncs-list has data
  const syncSeeds = [
    { name: 'save-invalidates-cache', suite: 'entity-lifecycle', pattern: 'ContentStorage/save -> Cache/invalidateByTags' },
    { name: 'save-indexes-search', suite: 'entity-lifecycle', pattern: 'ContentStorage/save -> Queue/enqueue' },
    { name: 'save-generates-alias', suite: 'entity-lifecycle', pattern: 'ContentStorage/save -> Pathauto/generateAlias' },
    { name: 'save-tracks-provenance', suite: 'entity-lifecycle', pattern: 'ContentStorage/save -> Provenance/record' },
    { name: 'save-reindexes-backlinks', suite: 'entity-lifecycle', pattern: 'ContentStorage/save -> Backlink/reindex' },
    { name: 'delete-cascades', suite: 'entity-lifecycle', pattern: 'ContentStorage/delete -> Comment,Reference,...' },
    { name: 'slot-source-dispatches', suite: 'component-mapping', pattern: 'SlotSource/resolve -> [provider]/resolve' },
    { name: 'resolver-uses-mapping', suite: 'component-mapping', pattern: 'WidgetResolver/resolve -> ComponentMapping/lookup' },
    { name: 'entity-page-triple-zone', suite: 'surface-integration', pattern: 'Renderer/render -> TripleZoneLayout' },
    { name: 'block-zone-renders-canvas', suite: 'surface-integration', pattern: 'TripleZoneLayout/renderZone -> Canvas/render' },
    { name: 'version-aware-load', suite: 'version-space', pattern: 'ContentStorage/load -> VersionSpace/resolve' },
    { name: 'version-aware-save', suite: 'version-space', pattern: 'ContentStorage/save -> VersionSpace/write' },
    { name: 'view-creates-content-node', suite: 'view-content', pattern: 'View/create -> ContentNode/create' },
    { name: 'schema-creates-content-node', suite: 'view-content', pattern: 'Schema/defineSchema -> ContentNode/create' },
    { name: 'theme-creates-content-node', suite: 'view-content', pattern: 'Theme/create -> ContentNode/create' },
  ];

  for (const s of syncSeeds) {
    await inv('ContentNode', 'create', {
      node: `sync:${s.name}`,
      type: 'sync',
      content: JSON.stringify({ suite: s.suite, pattern: s.pattern }),
      createdBy: 'system',
    });
  }

  // Seed suite content nodes so concept-browser has data
  const suiteSeeds = [
    { name: 'app-shell', concepts: 3, syncs: 0 },
    { name: 'component-mapping', concepts: 10, syncs: 10 },
    { name: 'concept-browser', concepts: 1, syncs: 10 },
    { name: 'entity-lifecycle', concepts: 0, syncs: 7 },
    { name: 'surface-integration', concepts: 0, syncs: 6 },
    { name: 'version-space-integration', concepts: 0, syncs: 11 },
    { name: 'identity-integration', concepts: 0, syncs: 3 },
    { name: 'storage', concepts: 2, syncs: 2 },
  ];

  for (const s of suiteSeeds) {
    await inv('ContentNode', 'create', {
      node: `suite:${s.name}`,
      type: 'suite',
      content: JSON.stringify({ name: s.name, concepts: s.concepts, syncs: s.syncs, version: '0.1.0' }),
      createdBy: 'system',
    });
  }

  // Seed theme content nodes
  for (const t of themes) {
    await inv('ContentNode', 'create', {
      node: `theme:${t.theme}`,
      type: 'theme',
      content: JSON.stringify({ name: t.name, overrides: t.overrides }),
      createdBy: 'system',
    });
  }

  // Seed display mode content nodes
  for (const m of modes) {
    await inv('ContentNode', 'create', {
      node: `display-mode:${m.mode}`,
      type: 'display-mode',
      content: JSON.stringify({ name: m.name }),
      createdBy: 'system',
    });
  }

  // Seed view content nodes (views are also browseable entities)
  for (const v of allViews) {
    await inv('ContentNode', 'create', {
      node: `view:${v.view}`,
      type: 'view',
      content: JSON.stringify({ title: v.title, layout: v.layout }),
      createdBy: 'system',
    });
  }

  // Seed widget content nodes (from Surface widget library)
  const widgetSeeds = [
    'Card', 'Badge', 'Sidebar', 'DataTable', 'EmptyState', 'CreateForm',
    'TableDisplay', 'CardGridDisplay', 'GraphDisplay', 'StatCardsDisplay',
    'ViewRenderer', 'LayoutRenderer', 'HostedPage', 'AppShell',
  ];

  for (const w of widgetSeeds) {
    await inv('ContentNode', 'create', {
      node: `widget:${w}`,
      type: 'widget',
      content: JSON.stringify({ name: w, framework: 'react' }),
      createdBy: 'system',
    });
  }

  // Seed workflow content nodes
  const workflowSeeds = [
    { name: 'content-lifecycle', states: 'draft,review,published,archived' },
    { name: 'schema-evolution', states: 'draft,active,deprecated' },
  ];

  for (const w of workflowSeeds) {
    await inv('ContentNode', 'create', {
      node: `workflow:${w.name}`,
      type: 'workflow',
      content: JSON.stringify({ name: w.name, states: w.states.split(',') }),
      createdBy: 'system',
    });
    // Also seed the actual workflow states
    for (const state of w.states.split(',')) {
      await inv('Workflow', 'defineState', {
        workflow: w.name,
        name: state,
        flags: state === w.states.split(',')[0] ? 'initial' : '',
      });
    }
  }

  // Seed automation rule content nodes
  const automationSeeds = [
    { name: 'auto-tag-on-create', trigger: 'ContentNode/create', description: 'Auto-apply taxonomy tags based on content type' },
    { name: 'notify-on-publish', trigger: 'Workflow/transition', description: 'Send notification when content moves to published state' },
    { name: 'cache-invalidate-on-save', trigger: 'ContentStorage/save', description: 'Invalidate cache entries when content is saved' },
  ];

  for (const a of automationSeeds) {
    await inv('ContentNode', 'create', {
      node: `automation-rule:${a.name}`,
      type: 'automation-rule',
      content: JSON.stringify({ trigger: a.trigger, description: a.description }),
      createdBy: 'system',
    });
    await inv('AutomationRule', 'define', {
      rule: a.name,
      trigger: a.trigger,
      conditions: '[]',
      actions: JSON.stringify([{ type: 'log', message: a.description }]),
    });
  }

  // Seed taxonomy term content nodes
  await inv('ContentNode', 'create', {
    node: 'taxonomy:concept-suites',
    type: 'taxonomy',
    content: JSON.stringify({ name: 'Concept Suites', kind: 'vocabulary' }),
    createdBy: 'system',
  });
  await inv('ContentNode', 'create', {
    node: 'taxonomy:schema-categories',
    type: 'taxonomy',
    content: JSON.stringify({ name: 'Schema Categories', kind: 'vocabulary' }),
    createdBy: 'system',
  });
}

export function getRegisteredConcepts() {
  getKernel(); // ensure initialized
  return _registeredConcepts;
}
