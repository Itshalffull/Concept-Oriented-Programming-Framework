import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

export function renderLogin(container: HTMLElement, api: ConduitAPI, onLogin: (user: StoredUser) => void) {
  container.innerHTML = `
    <div class="auth-page">
      <h1 style="text-align:center;margin-bottom:8px">Sign In</h1>
      <p style="text-align:center;margin-bottom:16px"><a href="#/register">Need an account?</a></p>
      <div id="login-error" class="error-msg" style="display:none"></div>
      <form id="login-form">
        <div class="form-group"><input type="email" placeholder="Email" id="login-email" required /></div>
        <div class="form-group"><input type="password" placeholder="Password" id="login-password" required /></div>
        <button class="btn btn-primary" type="submit" id="login-btn" style="width:100%">Sign in</button>
      </form>
    </div>
  `;

  const form = document.getElementById('login-form') as HTMLFormElement;
  const errorEl = document.getElementById('login-error')!;
  const btn = document.getElementById('login-btn') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;

    try {
      const res = await api.login(email, password);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      onLogin(stored);
    } catch (err: any) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}
