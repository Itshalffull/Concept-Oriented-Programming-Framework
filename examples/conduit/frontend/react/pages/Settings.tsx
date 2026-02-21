import React, { useState } from 'react';
import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  user: StoredUser | null;
  onLogout: () => void;
}

export function Settings({ api, user, onLogout }: Props) {
  const [image, setImage] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.updateProfile(bio || undefined, image || undefined);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      setSuccess('Settings updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <div className="loading">Please sign in to view settings.</div>;
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: 16 }}>Your Settings</h1>
      {error && <div className="error-msg">{error}</div>}
      {success && <div style={{ color: '#5cb85c', marginBottom: 12 }}>{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="url"
            placeholder="URL of profile picture"
            value={image}
            onChange={e => setImage(e.target.value)}
          />
        </div>
        <div className="form-group">
          <input type="text" value={user.username} disabled style={{ background: '#eee' }} />
        </div>
        <div className="form-group">
          <textarea
            placeholder="Short bio about you"
            value={bio}
            onChange={e => setBio(e.target.value)}
            style={{ minHeight: 100 }}
          />
        </div>
        <div className="form-group">
          <input type="email" value={user.email} disabled style={{ background: '#eee' }} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Updating...' : 'Update Settings'}
        </button>
      </form>
      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />
      <button className="btn btn-danger" onClick={onLogout} style={{ width: '100%' }}>
        Or click here to logout
      </button>
    </div>
  );
}
