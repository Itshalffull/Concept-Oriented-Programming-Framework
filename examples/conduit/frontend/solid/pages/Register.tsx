import { createSignal } from 'solid-js';
import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  onLogin: (user: StoredUser) => void;
}

export function Register(props: Props) {
  const [username, setUsername] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await props.api.register(username(), email(), password());
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      props.onLogin(stored);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="auth-page">
      <h1 style="text-align: center; margin-bottom: 8px">Sign Up</h1>
      <p style="text-align: center; margin-bottom: 16px"><a href="#/login">Have an account?</a></p>
      {error() && <div class="error-msg">{error()}</div>}
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <input type="text" placeholder="Username" value={username()} onInput={e => setUsername(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <input type="email" placeholder="Email" value={email()} onInput={e => setEmail(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <input type="password" placeholder="Password" value={password()} onInput={e => setPassword(e.currentTarget.value)} required />
        </div>
        <button class="btn btn-primary" type="submit" disabled={loading()} style="width: 100%">
          {loading() ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
    </div>
  );
}
