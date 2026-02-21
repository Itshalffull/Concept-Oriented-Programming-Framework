import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

export function renderRegister(container: HTMLElement, api: ConduitAPI, onLogin: (user: StoredUser) => void) {
  container.innerHTML = `
    <div class="auth-page">
      <h1 style="text-align:center;margin-bottom:8px">Sign Up</h1>
      <p style="text-align:center;margin-bottom:16px"><a href="#/login">Have an account?</a></p>
      <div id="reg-error" class="error-msg" style="display:none"></div>
      <form id="reg-form">
        <div class="form-group"><input type="text" placeholder="Username" id="reg-username" required /></div>
        <div class="form-group"><input type="email" placeholder="Email" id="reg-email" required /></div>
        <div class="form-group"><input type="password" placeholder="Password" id="reg-password" required /></div>
        <button class="btn btn-primary" type="submit" id="reg-btn" style="width:100%">Sign up</button>
      </form>
    </div>
  `;

  const form = document.getElementById('reg-form') as HTMLFormElement;
  const errorEl = document.getElementById('reg-error')!;
  const btn = document.getElementById('reg-btn') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing up...';

    const username = (document.getElementById('reg-username') as HTMLInputElement).value;
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;

    try {
      const res = await api.register(username, email, password);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      onLogin(stored);
    } catch (err: any) {
      errorEl.textContent = err.message || 'Registration failed';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign up';
    }
  });
}
