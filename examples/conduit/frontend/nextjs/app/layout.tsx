// Conduit — Next.js App Router Root Layout
// Uses Clef Surface with functional React components only.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Conduit — Clef Next.js',
  description: 'Concept-oriented Conduit app built with Clef and fp-ts',
};

const RootLayout = ({ children }: { readonly children: ReactNode }): ReactNode => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
