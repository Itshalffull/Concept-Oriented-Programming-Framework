/**
 * Entity Detail — Triple-zone layout for ContentNode entities
 * Navigator destination: content/[id] → ContentNode/get
 * Display mode: entity-page (structured + unstructured + related)
 */

import { HostedPage } from '../../components/HostedPage';
import { EntityDetailView } from '../../views/EntityDetailView';

export default async function EntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <HostedPage>
      <EntityDetailView id={decodeURIComponent(id)} />
    </HostedPage>
  );
}
