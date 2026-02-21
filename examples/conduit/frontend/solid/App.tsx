import { createSignal, onMount, onCleanup, Show, Switch, Match } from 'solid-js';
import { ConduitAPI } from '../shared/api-client.js';
import { getToken, getUser, clearAuth } from '../shared/auth.js';
import type { StoredUser } from '../shared/auth.js';
import { Home } from './pages/Home.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Article } from './pages/Article.js';
import { Editor } from './pages/Editor.js';
import { Settings } from './pages/Settings.js';
import { Profile } from './pages/Profile.js';

const api = new ConduitAPI('http://localhost:3000');

function parseRoute(hash: string): { page: string; param?: string } {
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  switch (parts[0]) {
    case 'login': return { page: 'login' };
    case 'register': return { page: 'register' };
    case 'editor': return { page: 'editor', param: parts[1] };
    case 'settings': return { page: 'settings' };
    case 'article': return { page: 'article', param: parts[1] };
    case 'profile': return { page: 'profile', param: parts[1] };
    default: return { page: 'home' };
  }
}

export function App() {
  const [hash, setHash] = createSignal(window.location.hash.slice(1) || '/');
  const [user, setUser] = createSignal<StoredUser | null>(getUser());

  onMount(() => {
    const token = getToken();
    if (token) api.setToken(token);
  });

  const onHashChange = () => setHash(window.location.hash.slice(1) || '/');
  onMount(() => window.addEventListener('hashchange', onHashChange));
  onCleanup(() => window.removeEventListener('hashchange', onHashChange));

  const route = () => parseRoute(hash());

  function onLogin(u: StoredUser) {
    setUser(u);
    api.setToken(u.token);
    window.location.hash = '#/';
  }

  function onLogout() {
    clearAuth();
    api.setToken(null);
    setUser(null);
    window.location.hash = '#/';
  }

  return (
    <>
      <nav>
        <div class="container">
          <a class="brand" href="#/">conduit</a>
          <div class="nav-links">
            <a href="#/" classList={{ active: route().page === 'home' }}>Home</a>
            <Show when={user()} fallback={
              <>
                <a href="#/login" classList={{ active: route().page === 'login' }}>Sign in</a>
                <a href="#/register" classList={{ active: route().page === 'register' }}>Sign up</a>
              </>
            }>
              {(u) => (
                <>
                  <a href="#/editor" classList={{ active: route().page === 'editor' }}>New Article</a>
                  <a href="#/settings" classList={{ active: route().page === 'settings' }}>Settings</a>
                  <a href={`#/profile/${u().username}`} classList={{ active: route().page === 'profile' }}>{u().username}</a>
                </>
              )}
            </Show>
          </div>
        </div>
      </nav>
      <div class="container">
        <Switch fallback={<Home api={api} user={user()} />}>
          <Match when={route().page === 'login'}>
            <Login api={api} onLogin={onLogin} />
          </Match>
          <Match when={route().page === 'register'}>
            <Register api={api} onLogin={onLogin} />
          </Match>
          <Match when={route().page === 'article'}>
            <Article api={api} slug={route().param!} user={user()} />
          </Match>
          <Match when={route().page === 'editor'}>
            <Editor api={api} slug={route().param} />
          </Match>
          <Match when={route().page === 'settings'}>
            <Settings api={api} user={user()} onLogout={onLogout} />
          </Match>
          <Match when={route().page === 'profile'}>
            <Profile api={api} username={route().param!} user={user()} />
          </Match>
        </Switch>
      </div>
    </>
  );
}
