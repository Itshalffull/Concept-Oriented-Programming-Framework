import React, { useState } from 'react';
import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  onLogin: (user: StoredUser) => void;
}

export function Login({ api, onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      onLogin(stored);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Sign In</h1>
      <p style={{ textAlign: 'center', marginBottom: 16 }}>
        <a href="#/register">Need an account?</a>
      </p>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
