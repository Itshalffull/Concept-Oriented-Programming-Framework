import { createSignal, Show } from 'solid-js';
import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  user: StoredUser | null;
  onLogout: () => void;
}

export function Settings(props: Props) {
  const [image, setImage] = createSignal('');
  const [bio, setBio] = createSignal('');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await props.api.updateProfile(bio() || undefined, image() || undefined);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      setSuccess('Settings updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Show when={props.user} fallback={<div class="loading">Please sign in to view settings.</div>}>
      {(user) => (
        <div style="max-width: 540px; margin: 0 auto">
          <h1 style="text-align: center; margin-bottom: 16px">Your Settings</h1>
          {error() && <div class="error-msg">{error()}</div>}
          {success() && <div style="color: #5cb85c; margin-bottom: 12px">{success()}</div>}
          <form onSubmit={handleSubmit}>
            <div class="form-group">
              <input type="url" placeholder="URL of profile picture" value={image()} onInput={e => setImage(e.currentTarget.value)} />
            </div>
            <div class="form-group">
              <input type="text" value={user().username} disabled style="background: #eee" />
            </div>
            <div class="form-group">
              <textarea placeholder="Short bio about you" value={bio()} onInput={e => setBio(e.currentTarget.value)} style="min-height: 100px" />
            </div>
            <div class="form-group">
              <input type="email" value={user().email} disabled style="background: #eee" />
            </div>
            <button class="btn btn-primary" type="submit" disabled={loading()} style="width: 100%">
              {loading() ? 'Updating...' : 'Update Settings'}
            </button>
          </form>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0" />
          <button class="btn btn-danger" onClick={props.onLogout} style="width: 100%">
            Or click here to logout
          </button>
        </div>
      )}
    </Show>
  );
}
