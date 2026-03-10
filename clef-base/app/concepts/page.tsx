import { HostedPage } from '../components/HostedPage';
import { LayoutRenderer } from '../components/LayoutRenderer';

export default function ConceptsPage() {
  return (
    <HostedPage>
      <LayoutRenderer layoutId="concept-browser" />
    </HostedPage>
  );
}
