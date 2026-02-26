'use client';

// Conduit — Register Page
// Client Component. Functional only, fp-ts for async flow.

import { useState, useCallback, type ReactNode, type FormEvent } from 'react';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

interface RegisterState {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly error: string | null;
  readonly loading: boolean;
}

const initialState: RegisterState = {
  username: '',
  email: '',
  password: '',
  error: null,
  loading: false,
};

const RegisterPage = (): ReactNode => {
  const [state, setState] = useState<RegisterState>(initialState);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const registerAction = pipe(
        TE.tryCatch(
          () =>
            fetch('/api/authentication', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'register',
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
            : TE.left({
                code: 'REGISTER_FAILED',
                message: result.variant === 'already_exists'
                  ? 'Account already exists'
                  : 'Registration failed',
              }),
        ),
      );

      const result = await registerAction();

      pipe(
        result,
        E.fold(
          (error) => setState((prev) => ({ ...prev, loading: false, error: error.message })),
          (_success) => {
            setState((prev) => ({ ...prev, loading: false }));
            window.location.href = '/login';
          },
        ),
      );
    },
    [state.email, state.password],
  );

  const setField = useCallback(
    (field: 'username' | 'email' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) =>
      setState((prev) => ({ ...prev, [field]: e.target.value })),
    [],
  );

  return (
    <main>
      <h1>Sign Up</h1>

      {state.error && (
        <div role="alert" data-surface-part="error">
          {state.error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={state.loading}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={state.username}
            onChange={setField('username')}
            placeholder="Username"
            required
            aria-required="true"
          />

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
            {state.loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </fieldset>
      </form>

      <p>
        <a href="/login">Have an account?</a>
      </p>
    </main>
  );
};

export default RegisterPage;
