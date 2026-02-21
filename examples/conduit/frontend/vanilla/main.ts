import { ConduitAPI } from '../shared/api-client.js';
import { getToken, getUser, clearAuth, isLoggedIn } from '../shared/auth.js';
import type { StoredUser } from '../shared/auth.js';
import { onRouteChange, navigate } from './router.js';
import { renderHome } from './pages/home.js';
import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderArticle } from './pages/article.js';
import { renderEditor } from './pages/editor.js';
import { renderSettings } from './pages/settings.js';
import { renderProfile } from './pages/profile.js';

const api = new ConduitAPI('http://localhost:3000');
const app = document.getElementById('app')!;
const navLinks = document.getElementById('nav-links')!;

// Initialize token
const token = getToken();
if (token) api.setToken(token);

function updateNav(page: string) {
  const user = getUser();
  if (user) {
    navLinks.innerHTML = `
      <a href="#/" class="${page === 'home' ? 'active' : ''}">Home</a>
      <a href="#/editor" class="${page === 'editor' ? 'active' : ''}">New Article</a>
      <a href="#/settings" class="${page === 'settings' ? 'active' : ''}">Settings</a>
      <a href="#/profile/${user.username}" class="${page === 'profile' ? 'active' : ''}">${user.username}</a>
    `;
  } else {
    navLinks.innerHTML = `
      <a href="#/" class="${page === 'home' ? 'active' : ''}">Home</a>
      <a href="#/login" class="${page === 'login' ? 'active' : ''}">Sign in</a>
      <a href="#/register" class="${page === 'register' ? 'active' : ''}">Sign up</a>
    `;
  }
}

function onLogin(user: StoredUser) {
  api.setToken(user.token);
  navigate('/');
}

function onLogout() {
  clearAuth();
  api.setToken(null);
  navigate('/');
}

onRouteChange((route) => {
  app.innerHTML = '';
  updateNav(route.page);

  switch (route.page) {
    case 'login':
      renderLogin(app, api, onLogin);
      break;
    case 'register':
      renderRegister(app, api, onLogin);
      break;
    case 'editor':
      renderEditor(app, api, route.param);
      break;
    case 'settings':
      renderSettings(app, api, getUser(), onLogout);
      break;
    case 'article':
      if (route.param) renderArticle(app, api, route.param, getUser());
      break;
    case 'profile':
      if (route.param) renderProfile(app, api, route.param, getUser());
      break;
    default:
      renderHome(app, api, getUser());
      break;
  }
});
