import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

export function renderSettings(container: HTMLElement, api: ConduitAPI, user: StoredUser | null, onLogout: () => void) {
  if (!user) {
    container.innerHTML = '<div class="loading">Please sign in to view settings.</div>';
    return;
  }

  container.innerHTML = `
    <div style="max-width:540px;margin:0 auto">
      <h1 style="text-align:center;margin-bottom:16px">Your Settings</h1>
      <div id="settings-error" class="error-msg" style="display:none"></div>
      <div id="settings-success" style="color:#5cb85c;margin-bottom:12px;display:none"></div>
      <form id="settings-form">
        <div class="form-group"><input type="url" placeholder="URL of profile picture" id="set-image" /></div>
        <div class="form-group"><input type="text" value="${user.username}" disabled style="background:#eee" /></div>
        <div class="form-group"><textarea placeholder="Short bio about you" id="set-bio" style="min-height:100px"></textarea></div>
        <div class="form-group"><input type="email" value="${user.email}" disabled style="background:#eee" /></div>
        <button class="btn btn-primary" type="submit" id="set-btn" style="width:100%">Update Settings</button>
      </form>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e0e0e0" />
      <button class="btn btn-danger" id="logout-btn" style="width:100%">Or click here to logout</button>
    </div>
  `;

  const form = document.getElementById('settings-form') as HTMLFormElement;
  const errorEl = document.getElementById('settings-error')!;
  const successEl = document.getElementById('settings-success')!;
  const btn = document.getElementById('set-btn') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Updating...';

    const bio = (document.getElementById('set-bio') as HTMLTextAreaElement).value;
    const image = (document.getElementById('set-image') as HTMLInputElement).value;

    try {
      const res = await api.updateProfile(bio || undefined, image || undefined);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      successEl.textContent = 'Settings updated successfully!';
      successEl.style.display = 'block';
    } catch (err: any) {
      errorEl.textContent = err.message || 'Failed to update settings';
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update Settings';
    }
  });

  document.getElementById('logout-btn')!.addEventListener('click', onLogout);
}
