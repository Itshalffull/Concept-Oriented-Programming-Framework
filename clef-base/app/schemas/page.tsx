import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function SchemasPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="schemas-list" />
    </HostedPage>
  );
}
