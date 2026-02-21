<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { ConduitAPI } from '../shared/api-client.js';
  import { getToken, getUser, clearAuth } from '../shared/auth.js';
  import type { StoredUser } from '../shared/auth.js';
  import Home from './pages/Home.svelte';
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';
  import ArticlePage from './pages/Article.svelte';
  import Editor from './pages/Editor.svelte';
  import Settings from './pages/Settings.svelte';
  import Profile from './pages/Profile.svelte';

  const api = new ConduitAPI('http://localhost:3000');

  let hash = window.location.hash.slice(1) || '/';
  let user: StoredUser | null = getUser();

  function onHashChange() {
    hash = window.location.hash.slice(1) || '/';
  }

  onMount(() => {
    const token = getToken();
    if (token) api.setToken(token);
    window.addEventListener('hashchange', onHashChange);
  });

  onDestroy(() => {
    window.removeEventListener('hashchange', onHashChange);
  });

  function parseRoute(h: string): { page: string; param?: string } {
    const parts = h.split('/').filter(Boolean);
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

  function handleLogin(e: CustomEvent<StoredUser>) {
    user = e.detail;
    api.setToken(e.detail.token);
    window.location.hash = '#/';
  }

  function handleLogout() {
    clearAuth();
    api.setToken(null);
    user = null;
    window.location.hash = '#/';
  }

  $: route = parseRoute(hash);
</script>

<nav>
  <div class="container">
    <a class="brand" href="#/">conduit</a>
    <div class="nav-links">
      <a href="#/" class:active={route.page === 'home'}>Home</a>
      {#if user}
        <a href="#/editor" class:active={route.page === 'editor'}>New Article</a>
        <a href="#/settings" class:active={route.page === 'settings'}>Settings</a>
        <a href="#/profile/{user.username}" class:active={route.page === 'profile'}>{user.username}</a>
      {:else}
        <a href="#/login" class:active={route.page === 'login'}>Sign in</a>
        <a href="#/register" class:active={route.page === 'register'}>Sign up</a>
      {/if}
    </div>
  </div>
</nav>

<div class="container">
  {#if route.page === 'home'}
    <Home {api} {user} />
  {:else if route.page === 'login'}
    <Login {api} on:login={handleLogin} />
  {:else if route.page === 'register'}
    <Register {api} on:login={handleLogin} />
  {:else if route.page === 'article'}
    <ArticlePage {api} slug={route.param || ''} {user} />
  {:else if route.page === 'editor'}
    <Editor {api} slug={route.param} />
  {:else if route.page === 'settings'}
    <Settings {api} {user} on:logout={handleLogout} />
  {:else if route.page === 'profile'}
    <Profile {api} username={route.param || ''} {user} />
  {/if}
</div>
