import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function WorkflowsPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="workflows-list" />
    </HostedPage>
  );
}
