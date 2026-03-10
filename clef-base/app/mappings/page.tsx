import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function MappingsPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="mappings-list" />
    </HostedPage>
  );
}
