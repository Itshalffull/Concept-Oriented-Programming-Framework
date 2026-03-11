import { notFound } from 'next/navigation';
import { HostedPage } from '../../components/HostedPage';
import { LayoutRenderer } from '../../components/LayoutRenderer';
import { ViewRenderer } from '../../components/ViewRenderer';
import { ViewEditor } from '../../components/ViewEditor';
import { ConceptBrowserView } from '../../views/ConceptBrowserView';
import { EntityDetailView } from '../../views/EntityDetailView';
import { MultiverseView } from '../../views/MultiverseView';
import { AccessAdmin } from '../../components/AccessAdmin';
import { getAccessSnapshot } from '../../../lib/auth';

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
        <LayoutRenderer layoutId="canvas-browser" />
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

  notFound();
}
