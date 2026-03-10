import { HostedPage } from './components/HostedPage';
import { LayoutRenderer } from './components/LayoutRenderer';

export default function DashboardPage() {
  return (
    <HostedPage>
      <LayoutRenderer layoutId="dashboard" />
    </HostedPage>
  );
}
