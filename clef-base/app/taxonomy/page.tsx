import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function TaxonomyPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="taxonomy-list" />
    </HostedPage>
  );
}
