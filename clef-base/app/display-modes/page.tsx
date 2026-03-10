import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function DisplayModesPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="display-modes-list" />
    </HostedPage>
  );
}
