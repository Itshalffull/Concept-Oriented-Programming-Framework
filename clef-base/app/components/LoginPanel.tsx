'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export function LoginPanel({ defaultUser }: { defaultUser: string }) {
  const router = useRouter();
  const [user, setUser] = useState(defaultUser);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, password }),
    });

    const result = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(String(result.message ?? 'Login failed.'));
      return;
    }

    if (result.admin) {
      router.push('/admin');
      router.refresh();
      return;
    }

    setMessage('Signed in. This deployment only exposes the admin console to users with admin access.');
    router.refresh();
  }

  return (
    <section className="setup-login-card">
      <h2>Administrator sign in</h2>
      <p>Use the seeded administrator account to open the Clef Base console.</p>
      <form className="setup-form" onSubmit={onSubmit}>
        <label>
          <span>Username</span>
          <input value={user} onChange={(event) => setUser(event.target.value)} required />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="setup-error">{error}</p> : null}
        {message ? <p className="setup-success">{message}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Open admin'}
        </button>
      </form>
    </section>
  );
}
