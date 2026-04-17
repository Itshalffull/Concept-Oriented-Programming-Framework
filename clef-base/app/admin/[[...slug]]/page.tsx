import { notFound, redirect } from 'next/navigation';
import { HostedPage } from '../../components/HostedPage';
import { DailyNotePage } from '../../components/DailyNotePage';
import { LayoutRenderer } from '../../components/LayoutRenderer';
import { ViewRenderer } from '../../components/ViewRenderer';
import { ViewEditor } from '../../components/ViewEditor';
import { ConceptBrowserView } from '../../views/ConceptBrowserView';
import { EntityDetailView } from '../../views/EntityDetailView';
import { MultiverseView } from '../../views/MultiverseView';
import { AccessAdmin } from '../../components/AccessAdmin';
import { MappingsView } from '../../views/MappingsView';
import { DisplayModesView } from '../../views/DisplayModesView';
import { DynamicPage } from '../../components/DynamicPage';
import { getAccessSnapshot } from '../../../lib/auth';
import { FormBuilder } from '../../components/widgets/FormBuilder';
import { FlowBuilder } from '../../components/widgets/FlowBuilder';
import { AutomationRuleBuilder } from '../../components/widgets/AutomationRuleBuilder';
import { WorkflowBuilder } from '../../components/widgets/WorkflowBuilder';
import { SchemaFieldsEditor } from '../../components/widgets/SchemaFieldsEditor';
import { UserSyncEditor } from '../../components/widgets/UserSyncEditor';
import { KeybindingEditor } from '../../components/widgets/KeybindingEditor';
import { CanvasBrowserView } from '../../views/CanvasBrowserView';
import { FlowBuilderView } from '../../views/FlowBuilderView';
import { UserSyncListView } from '../../views/UserSyncListView';
import { UserSyncEditorView } from '../../views/UserSyncEditorView';
import { RecursiveEditorView } from '../../views/RecursiveEditorView';
import { PersonaEditorView } from '../../views/PersonaEditorView';
import { MediaLibraryView } from '../../views/MediaLibraryView';
import { TaxonomyView } from '../../views/TaxonomyView';

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug = [] } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const path = slug.join('/');

  if (path === '') {
    const today = new Date().toISOString().slice(0, 10);
    redirect(`/admin/daily/${today}`);
  }

  // DN-8: /admin/daily/:date — daily notes workspace.
  // Renders DailyNotePage (left rail + center editor + right rail) for the given date.
  // /admin/daily without a date redirects to today.
  if (slug[0] === 'daily') {
    const date = slug[1] ?? new Date().toISOString().slice(0, 10);
    return (
      <HostedPage>
        <DailyNotePage date={date} />
      </HostedPage>
    );
  }

  if (slug[0] === 'content' && slug[1]) {
    return (
      <HostedPage>
        <EntityDetailView id={decodeURIComponent(slug.slice(1).join('/'))} />
      </HostedPage>
    );
  }

  if (path === 'content') {
    return (
      <HostedPage>
        <ViewRenderer viewId="content-list" />
      </HostedPage>
    );
  }

  if (slug[0] === 'schemas' && slug[1]) {
    return (
      <HostedPage>
        <SchemaFieldsEditor schemaId={decodeURIComponent(slug[1])} />
      </HostedPage>
    );
  }

  if (path === 'schemas') {
    return (
      <HostedPage>
        <ViewRenderer viewId="schemas-list" />
      </HostedPage>
    );
  }

  if (path === 'workflows') {
    return (
      <HostedPage>
        <ViewRenderer viewId="workflows-list" />
      </HostedPage>
    );
  }

  if (slug[0] === 'workflows' && slug[1]) {
    return (
      <HostedPage>
        <WorkflowBuilder mode="edit" context={{ workflow: decodeURIComponent(slug[1]) }} />
      </HostedPage>
    );
  }

  if (path === 'automations') {
    return (
      <HostedPage>
        <ViewRenderer viewId="automations-list" />
      </HostedPage>
    );
  }

  if (path === 'automations/catalog') {
    return (
      <HostedPage>
        <ViewRenderer viewId="process-catalog" />
      </HostedPage>
    );
  }

  if (path === 'automations/rules') {
    return (
      <HostedPage>
        <ViewRenderer viewId="automations-rules-list" />
      </HostedPage>
    );
  }

  if (slug[0] === 'automations' && slug[1] && slug[1] !== 'catalog' && slug[1] !== 'rules') {
    return (
      <HostedPage>
        <EntityDetailView id={decodeURIComponent(slug[1])} />
      </HostedPage>
    );
  }

  // User Sync list: /admin/automation/user-syncs
  if (path === 'automation/user-syncs') {
    return (
      <HostedPage>
        <UserSyncListView />
      </HostedPage>
    );
  }

  // User Sync editor: /admin/automation/user-syncs/new or /admin/automation/user-syncs/:id
  if (slug[0] === 'automation' && slug[1] === 'user-syncs' && slug[2]) {
    return (
      <HostedPage>
        <UserSyncEditorView syncId={decodeURIComponent(slug[2])} />
      </HostedPage>
    );
  }

  // Flow Builder: /admin/processes/:processSpecId/edit
  if (slug[0] === 'processes' && slug[1] && slug[2] === 'edit') {
    return (
      <HostedPage>
        <FlowBuilderView processSpecId={decodeURIComponent(slug[1])} />
      </HostedPage>
    );
  }

  if (path === 'taxonomy') {
    return (
      <HostedPage>
        <ViewRenderer viewId="taxonomy-list" />
      </HostedPage>
    );
  }

  // Bug #94: /admin/taxonomy/:vocab — vocabulary detail / term editor.
  // Stub: renders TaxonomyView (full list); initialVocab pre-selection is a follow-up.
  // TODO: add initialVocab prop to TaxonomyView and pre-select the vocab from the URL.
  if (slug[0] === 'taxonomy' && slug[1]) {
    return (
      <HostedPage>
        <TaxonomyView />
      </HostedPage>
    );
  }

  if (path === 'themes') {
    return (
      <HostedPage>
        <ViewRenderer viewId="themes-list" />
      </HostedPage>
    );
  }

  // Bug #92: /admin/themes/:id — theme detail / token editor.
  // Stub: renders theme entity via EntityDetailView; a dedicated ThemeEditor widget is a follow-up.
  // TODO: build a ThemeEditor widget that shows token overrides, extends graph, and activate/deactivate actions.
  if (slug[0] === 'themes' && slug[1]) {
    return (
      <HostedPage>
        <EntityDetailView id={`theme:${decodeURIComponent(slug[1])}`} />
      </HostedPage>
    );
  }

  if (slug[0] === 'display-modes' && slug[1]) {
    return (
      <HostedPage>
        <DisplayModesView modeKey={decodeURIComponent(slug[1])} />
      </HostedPage>
    );
  }

  if (path === 'display-modes') {
    return (
      <HostedPage>
        <ViewRenderer viewId="display-modes-list" />
      </HostedPage>
    );
  }

  if (slug[0] === 'view-builder' && slug[1]) {
    return (
      <HostedPage>
        <ViewEditor viewId={decodeURIComponent(slug.slice(1).join('/'))} />
      </HostedPage>
    );
  }

  if (path === 'view-builder') {
    return (
      <HostedPage>
        <ViewRenderer viewId="views-list" />
      </HostedPage>
    );
  }

  // CUX-03: page-mode create routes — mounted by CreateForm when create_mode_hint="page".
  // Each route mounts the corresponding editor widget with mode="create" and context={null}.
  // Convention: /admin/<surface-id>/new → <WidgetComponent mode="create" context={null} />

  if (slug[0] === 'view-editor' && slug[1] === 'new') {
    return (
      <HostedPage>
        <ViewEditor mode="create" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'schema-editor' && slug[1] === 'new') {
    return (
      <HostedPage>
        <SchemaFieldsEditor mode="create" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'flow-builder' && slug[1] === 'new') {
    return (
      <HostedPage>
        <FlowBuilder mode="create" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'user-sync-editor' && slug[1] === 'new') {
    return (
      <HostedPage>
        <UserSyncEditor mode="create" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'automation-rule-builder' && slug[1] === 'new') {
    return (
      <HostedPage>
        <AutomationRuleBuilder mode="create" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'automation-rule-builder' && slug[1] && slug[1] !== 'new') {
    return (
      <HostedPage>
        <AutomationRuleBuilder mode="edit" context={{ rule: decodeURIComponent(slug[1]) }} />
      </HostedPage>
    );
  }

  if (slug[0] === 'workflow-builder' && slug[1] === 'new') {
    return (
      <HostedPage>
        <WorkflowBuilder mode="create" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'form-builder' && slug[1] === 'new') {
    // Accept ?schema=<id> so deep links from schema-editor work.
    // FormBuilder renders a full-screen schema picker when schemaId is absent.
    const schemaParam = resolvedSearch['schema'];
    const schemaId = typeof schemaParam === 'string' ? schemaParam : undefined;
    return (
      <HostedPage>
        <FormBuilder mode="create" context={null} schemaId={schemaId} />
      </HostedPage>
    );
  }

  // /admin/form-builder/:formId — edit an existing FormSpec by its primary key.
  // The URL slug is the form's primary key (e.g. "form-contentnode-create").
  // FormBuilder loads it via FormSpec/get({ form: formId }) — not FormSpec/resolve.
  if (slug[0] === 'form-builder' && slug[1] && slug[1] !== 'new') {
    const formId = decodeURIComponent(slug.slice(1).join('/'));
    return (
      <HostedPage>
        <FormBuilder formId={formId} mode="edit" />
      </HostedPage>
    );
  }

  // KB-12: Settings → Keybindings routes.
  // /admin/keybinding-editor        → read-only browse (default landing)
  // /admin/keybinding-editor/edit   → edit mode (from "Customize" button)
  if (slug[0] === 'keybinding-editor' && !slug[1]) {
    return (
      <HostedPage>
        <KeybindingEditor mode="view" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'keybinding-editor' && slug[1] === 'edit') {
    return (
      <HostedPage>
        <KeybindingEditor mode="edit" context={null} />
      </HostedPage>
    );
  }

  if (slug[0] === 'mappings' && slug[1]) {
    return (
      <HostedPage>
        <MappingsView mappingId={decodeURIComponent(slug[1])} />
      </HostedPage>
    );
  }

  if (path === 'mappings') {
    return (
      <HostedPage>
        <ViewRenderer viewId="mappings-list" />
      </HostedPage>
    );
  }

  if (path === 'system') {
    return (
      <HostedPage>
        <LayoutRenderer layoutId="dashboard" />
      </HostedPage>
    );
  }

  if (path === 'score') {
    return (
      <HostedPage>
        <LayoutRenderer layoutId="score" />
      </HostedPage>
    );
  }

  if (path === 'syncs') {
    return (
      <HostedPage>
        <LayoutRenderer layoutId="syncs" />
      </HostedPage>
    );
  }

  if (path === 'concepts') {
    return (
      <HostedPage>
        <ConceptBrowserView />
      </HostedPage>
    );
  }

  if (path === 'canvas') {
    return (
      <HostedPage>
        <CanvasBrowserView />
      </HostedPage>
    );
  }

  if (path === 'multiverse') {
    return (
      <HostedPage>
        <MultiverseView />
      </HostedPage>
    );
  }

  if (slug[0] === 'branches' && slug[1]) {
    return (
      <HostedPage>
        <EntityDetailView id={decodeURIComponent(slug[1])} />
      </HostedPage>
    );
  }

  if (path === 'access') {
    return <AccessAdmin initial={await getAccessSnapshot()} />;
  }

  if (slug[0] === 'forms' && slug[1]) {
    return (
      <HostedPage>
        <FormBuilder schemaId={decodeURIComponent(slug[1])} />
      </HostedPage>
    );
  }

  if (path === 'forms') {
    return (
      <HostedPage>
        <ViewRenderer viewId="form-list" />
      </HostedPage>
    );
  }

  // Recursive block editor routes (MAG-724)
  // /editors/markdown/:nodeId — RecursiveEditorView flavor resolved from schema
  if (slug[0] === 'editors' && slug[1] === 'markdown' && slug[2]) {
    return (
      <HostedPage>
        <RecursiveEditorView rootNodeId={decodeURIComponent(slug[2])} />
      </HostedPage>
    );
  }

  // /editors/persona/:nodeId — PersonaEditorView (flavor locked to "persona")
  if (slug[0] === 'editors' && slug[1] === 'persona' && slug[2]) {
    return (
      <HostedPage>
        <PersonaEditorView nodeId={decodeURIComponent(slug[2])} />
      </HostedPage>
    );
  }

  // Media Library — ViewShell over all media-asset ContentNodes (MAG-754).
  // Mounts media-library-view (blocks default) with switchable card-grid / table / timeline.
  if (path === 'media') {
    return (
      <HostedPage>
        <MediaLibraryView />
      </HostedPage>
    );
  }

  // Dynamic page resolution: look up the path in DestinationCatalog at runtime.
  // Pages created from the frontend register here and render without redeployment.
  return <DynamicPage slug={slug} />;
}
