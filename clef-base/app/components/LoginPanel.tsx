'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { loginAdminAction, type LoginActionState } from '../admin/actions';

export function LoginPanel({ defaultUser }: { defaultUser: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<LoginActionState, FormData>(loginAdminAction, {
    error: '',
    message: '',
  });

  useEffect(() => {
    if (state.message === 'admin') {
      router.push('/admin');
    }
  }, [router, state.message]);

  return (
    <section className="setup-login-card">
      <h2>Administrator sign in</h2>
      <p>Use the seeded administrator account to open the Clef Base console.</p>
      <form className="setup-form" action={formAction}>
        <label>
          <span>Username</span>
          <input name="user" defaultValue={defaultUser} required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" required />
        </label>
        {state.error ? <p className="setup-error">{state.error}</p> : null}
        {state.message && state.message !== 'admin' ? <p className="setup-success">{state.message}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Signing in...' : 'Open admin'}
        </button>
      </form>
    </section>
  );
}
