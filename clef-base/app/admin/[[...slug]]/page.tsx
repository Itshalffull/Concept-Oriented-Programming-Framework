import { notFound } from 'next/navigation';
import { HostedPage } from '../../components/HostedPage';
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
import { SchemaFieldsEditor } from '../../components/widgets/SchemaFieldsEditor';
import { CanvasBrowserView } from '../../views/CanvasBrowserView';
import { FlowBuilderView } from '../../views/FlowBuilderView';
import { UserSyncListView } from '../../views/UserSyncListView';
import { UserSyncEditorView } from '../../views/UserSyncEditorView';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const path = slug.join('/');

  if (path === '') {
    return (
      <HostedPage>
        <LayoutRenderer layoutId="dashboard" />
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

  if (path === 'themes') {
    return (
      <HostedPage>
        <ViewRenderer viewId="themes-list" />
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

  // Dynamic page resolution: look up the path in DestinationCatalog at runtime.
  // Pages created from the frontend register here and render without redeployment.
  return <DynamicPage slug={slug} />;
}
