import type { Metadata } from 'next';
import './styles/globals.css';
import { getActiveThemeId } from '../lib/kernel';

export const metadata: Metadata = {
  title: 'Clef Base',
  description: 'Clef Base setup guide and administration console',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const activeTheme = await getActiveThemeId();

  return (
    <html lang="en" data-theme={activeTheme}>
      <body>{children}</body>
    </html>
  );
}
