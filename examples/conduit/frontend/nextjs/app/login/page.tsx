'use client';

// Conduit — Login Page
// Client Component using Clef Surface BindingProvider for
// Authentication concept interaction. All functional, no classes.

import { useState, useCallback, type ReactNode, type FormEvent } from 'react';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

interface LoginState {
  readonly email: string;
  readonly password: string;
  readonly error: string | null;
  readonly loading: boolean;
}

const initialState: LoginState = {
  email: '',
  password: '',
  error: null,
  loading: false,
};

const LoginPage = (): ReactNode => {
  const [state, setState] = useState<LoginState>(initialState);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const loginAction = pipe(
        TE.tryCatch(
          () =>
            fetch('/api/authentication', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'login',
                input: { userId: state.email, credentials: state.password },
              }),
            }).then((r) => r.json()),
          (error) => ({
            code: 'NETWORK_ERROR',
            message: error instanceof Error ? error.message : String(error),
          }),
        ),
        TE.chain((result) =>
          result.variant === 'ok'
            ? TE.right(result)
            : TE.left({ code: 'LOGIN_FAILED', message: result.message ?? 'Invalid credentials' }),
        ),
      );

      const result = await loginAction();

      pipe(
        result,
        E.fold(
          (error) => setState((prev) => ({ ...prev, loading: false, error: error.message })),
          (_success) => {
            setState((prev) => ({ ...prev, loading: false }));
            // Navigate on success
            window.location.href = '/';
          },
        ),
      );
    },
    [state.email, state.password],
  );

  const setField = useCallback(
    (field: 'email' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) =>
      setState((prev) => ({ ...prev, [field]: e.target.value })),
    [],
  );

  return (
    <main>
      <h1>Sign In</h1>

      {state.error && (
        <div role="alert" data-surface-part="error">
          {state.error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={state.loading}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={state.email}
            onChange={setField('email')}
            placeholder="Email"
            required
            aria-required="true"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={state.password}
            onChange={setField('password')}
            placeholder="Password"
            required
            aria-required="true"
          />

          <button type="submit" disabled={state.loading}>
            {state.loading ? 'Signing in...' : 'Sign In'}
          </button>
        </fieldset>
      </form>

      <p>
        <a href="/register">Need an account?</a>
      </p>
    </main>
  );
};

export default LoginPage;
