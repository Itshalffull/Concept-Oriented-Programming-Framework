import type { Metadata } from 'next';
import './styles/globals.css';
import { ClefProvider } from '../lib/clef-provider';
import { AppShell } from './components/AppShell';

export const metadata: Metadata = {
  title: 'Clef Base',
  description: 'The base application platform for the Clef framework',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ClefProvider>
          <AppShell>{children}</AppShell>
        </ClefProvider>
      </body>
    </html>
  );
}
