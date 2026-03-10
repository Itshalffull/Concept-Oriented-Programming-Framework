import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function AutomationsPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="automations-list" />
    </HostedPage>
  );
}
