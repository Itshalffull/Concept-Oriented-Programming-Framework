import { HostedPage } from '../components/HostedPage';
import { ViewRenderer } from '../components/ViewRenderer';

export default function ThemesPage() {
  return (
    <HostedPage>
      <ViewRenderer viewId="themes-list" />
    </HostedPage>
  );
}
