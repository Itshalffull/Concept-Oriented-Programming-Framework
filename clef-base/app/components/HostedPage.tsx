'use client';

/**
 * HostedPage — Wraps a page view with Host lifecycle management.
 *
 * On mount: marks the current host as "ready" (Host/ready)
 * On unmount: cleanup is handled by the provider via pathname change.
 *
 * This component bridges the Host concept lifecycle to React
 * component lifecycle, following the navigator-go-mounts-host sync.
 */

import React, { useEffect } from 'react';
import { useHost } from '../../lib/clef-provider';

interface HostedPageProps {
  children: React.ReactNode;
}

export const HostedPage: React.FC<HostedPageProps> = ({ children }) => {
  const { host, setHostReady } = useHost();

  useEffect(() => {
    if (host && host.status === 'mounted') {
      setHostReady(host.id);
    }
  }, [host, setHostReady]);

  return <>{children}</>;
};

export default HostedPage;
