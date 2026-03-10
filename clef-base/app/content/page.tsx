import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function ContentPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="content-list" />
    </HostedPage>
  );
}
