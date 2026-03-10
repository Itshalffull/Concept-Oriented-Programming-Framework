import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function ViewBuilderPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="views-list" />
    </HostedPage>
  );
}
