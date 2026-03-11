import React from 'react';
import { AppShell } from '../components/AppShell';
import { ClefProvider } from '../../lib/clef-provider';
import { requireAdminSession } from '../../lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  return (
    <ClefProvider>
      <AppShell sessionUser={session.user}>{children}</AppShell>
    </ClefProvider>
  );
}
