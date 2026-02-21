import React, { useState, useEffect, useCallback } from 'react';
import { ConduitAPI } from '../shared/api-client.js';
import { getToken, getUser, clearAuth, isLoggedIn } from '../shared/auth.js';
import type { StoredUser } from '../shared/auth.js';
import { Home } from './pages/Home.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Article } from './pages/Article.js';
import { Editor } from './pages/Editor.js';
import { Settings } from './pages/Settings.js';
import { Profile } from './pages/Profile.js';

const api = new ConduitAPI('http://localhost:3000');

function getHash(): string {
  return window.location.hash.slice(1) || '/';
}

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

function navigate(path: string) {
  window.location.hash = path;
}

export function App() {
  const [hash, setHash] = useState(getHash());
  const [user, setUser] = useState<StoredUser | null>(getUser());

  useEffect(() => {
    const token = getToken();
    if (token) api.setToken(token);
  }, []);

  useEffect(() => {
    const onHashChange = () => setHash(getHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const onLogin = useCallback((u: StoredUser) => {
    setUser(u);
    api.setToken(u.token);
    navigate('/');
  }, []);

  const onLogout = useCallback(() => {
    clearAuth();
    api.setToken(null);
    setUser(null);
    navigate('/');
  }, []);

  const { page, param } = parseRoute(hash);

  const renderPage = () => {
    switch (page) {
      case 'login': return <Login api={api} onLogin={onLogin} />;
      case 'register': return <Register api={api} onLogin={onLogin} />;
      case 'editor': return <Editor api={api} slug={param} />;
      case 'settings': return <Settings api={api} user={user} onLogout={onLogout} />;
      case 'article': return <Article api={api} slug={param!} user={user} />;
      case 'profile': return <Profile api={api} username={param!} user={user} />;
      default: return <Home api={api} user={user} />;
    }
  };

  return (
    <>
      <nav>
        <div className="container">
          <a className="brand" href="#/" onClick={() => navigate('/')}>conduit</a>
          <div className="nav-links">
            <a href="#/" className={page === 'home' ? 'active' : ''}>Home</a>
            {user ? (
              <>
                <a href="#/editor" className={page === 'editor' ? 'active' : ''}>New Article</a>
                <a href="#/settings" className={page === 'settings' ? 'active' : ''}>Settings</a>
                <a href={`#/profile/${user.username}`} className={page === 'profile' ? 'active' : ''}>{user.username}</a>
              </>
            ) : (
              <>
                <a href="#/login" className={page === 'login' ? 'active' : ''}>Sign in</a>
                <a href="#/register" className={page === 'register' ? 'active' : ''}>Sign up</a>
              </>
            )}
          </div>
        </div>
      </nav>
      <div className="container">
        {renderPage()}
      </div>
    </>
  );
}
