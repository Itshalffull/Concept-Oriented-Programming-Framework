// Conduit — Next.js App Router Home Page
// Server Component (no 'use client') — renders static content
// with concept-driven navigation.

import type { ReactNode } from 'react';

const HomePage = (): ReactNode => (
  <main>
    <header>
      <h1>Conduit</h1>
      <p>A concept-oriented social blogging platform built with Clef and fp-ts.</p>
    </header>

    <nav>
      <ul>
        <li><a href="/articles">Articles</a></li>
        <li><a href="/login">Sign In</a></li>
        <li><a href="/register">Sign Up</a></li>
      </ul>
    </nav>

    <section>
      <h2>Global Feed</h2>
      <p>Articles will be loaded from the Article concept via Server Components.</p>
    </section>
  </main>
);

export default HomePage;
