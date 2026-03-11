import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import './styles/globals.css';
import { getActiveThemeDocumentState } from '../lib/kernel';

export const metadata: Metadata = {
  title: 'Clef Base',
  description: 'Clef Base setup guide and administration console',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const activeTheme = await getActiveThemeDocumentState();

  return (
    <html
      lang="en"
      data-theme={activeTheme.id}
      data-mode={activeTheme.mode ?? undefined}
      data-density={activeTheme.density ?? undefined}
      data-motif={activeTheme.motif ?? undefined}
      data-style-profile={activeTheme.styleProfile ?? undefined}
      data-source-type={activeTheme.sourceType ?? undefined}
      style={activeTheme.cssVariables as CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
