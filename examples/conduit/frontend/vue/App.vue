<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ConduitAPI } from '../shared/api-client.js';
import { getToken, getUser, clearAuth } from '../shared/auth.js';
import type { StoredUser } from '../shared/auth.js';
import Home from './pages/Home.vue';
import Login from './pages/Login.vue';
import Register from './pages/Register.vue';
import ArticlePage from './pages/Article.vue';
import Editor from './pages/Editor.vue';
import Settings from './pages/Settings.vue';
import Profile from './pages/Profile.vue';

const api = new ConduitAPI('http://localhost:3000');
const hash = ref(window.location.hash.slice(1) || '/');
const user = ref<StoredUser | null>(getUser());

onMounted(() => {
  const token = getToken();
  if (token) api.setToken(token);
  window.addEventListener('hashchange', onHashChange);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange);
});

function onHashChange() {
  hash.value = window.location.hash.slice(1) || '/';
}

const route = computed(() => {
  const parts = hash.value.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home', param: undefined };
  switch (parts[0]) {
    case 'login': return { page: 'login', param: undefined };
    case 'register': return { page: 'register', param: undefined };
    case 'editor': return { page: 'editor', param: parts[1] };
    case 'settings': return { page: 'settings', param: undefined };
    case 'article': return { page: 'article', param: parts[1] };
    case 'profile': return { page: 'profile', param: parts[1] };
    default: return { page: 'home', param: undefined };
  }
});

function onLogin(u: StoredUser) {
  user.value = u;
  api.setToken(u.token);
  window.location.hash = '#/';
}

function onLogout() {
  clearAuth();
  api.setToken(null);
  user.value = null;
  window.location.hash = '#/';
}
</script>

<template>
  <nav>
    <div class="container">
      <a class="brand" href="#/">conduit</a>
      <div class="nav-links">
        <a href="#/" :class="{ active: route.page === 'home' }">Home</a>
        <template v-if="user">
          <a href="#/editor" :class="{ active: route.page === 'editor' }">New Article</a>
          <a href="#/settings" :class="{ active: route.page === 'settings' }">Settings</a>
          <a :href="'#/profile/' + user.username" :class="{ active: route.page === 'profile' }">{{ user.username }}</a>
        </template>
        <template v-else>
          <a href="#/login" :class="{ active: route.page === 'login' }">Sign in</a>
          <a href="#/register" :class="{ active: route.page === 'register' }">Sign up</a>
        </template>
      </div>
    </div>
  </nav>
  <div class="container">
    <Home v-if="route.page === 'home'" :api="api" :user="user" />
    <Login v-else-if="route.page === 'login'" :api="api" @login="onLogin" />
    <Register v-else-if="route.page === 'register'" :api="api" @login="onLogin" />
    <ArticlePage v-else-if="route.page === 'article'" :api="api" :slug="route.param!" :user="user" />
    <Editor v-else-if="route.page === 'editor'" :api="api" :slug="route.param" />
    <Settings v-else-if="route.page === 'settings'" :api="api" :user="user" @logout="onLogout" />
    <Profile v-else-if="route.page === 'profile'" :api="api" :username="route.param!" :user="user" />
  </div>
</template>
