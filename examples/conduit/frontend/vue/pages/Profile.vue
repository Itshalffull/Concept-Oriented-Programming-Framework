<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Profile, Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const props = defineProps<{ api: ConduitAPI; username: string; user: StoredUser | null }>();
const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

const profile = ref<Profile | null>(null);
const articles = ref<Article[]>([]);
const loading = ref(true);
const error = ref('');

async function loadProfile() {
  loading.value = true;
  try {
    const [profileRes, articlesRes] = await Promise.all([
      props.api.getProfile(props.username),
      props.api.getArticles(),
    ]);
    profile.value = profileRes.profile;
    articles.value = articlesRes.articles.filter(a => a.author.username === props.username);
  } catch (err: any) {
    error.value = err.message || 'Failed to load profile';
  } finally {
    loading.value = false;
  }
}

onMounted(loadProfile);
watch(() => props.username, loadProfile);

async function toggleFollow() {
  if (!profile.value || !props.user) return;
  try {
    const res = profile.value.following
      ? await props.api.unfollow(props.username)
      : await props.api.follow(props.username);
    profile.value = res.profile;
  } catch (err: any) {
    console.error(err);
  }
}

async function toggleFavorite(article: Article) {
  if (!props.user) { window.location.hash = '#/login'; return; }
  try {
    const res = article.favorited
      ? await props.api.unfavorite(article.slug)
      : await props.api.favorite(article.slug);
    const idx = articles.value.findIndex(a => a.slug === article.slug);
    if (idx >= 0) articles.value[idx] = res.article;
  } catch (err: any) {
    console.error(err);
  }
}
</script>

<template>
  <div v-if="loading" class="loading">Loading profile...</div>
  <div v-else-if="!profile" class="loading">Profile not found</div>
  <div v-else>
    <div class="profile-header">
      <img :src="profile.image || defaultImg" :alt="profile.username" />
      <h2>{{ profile.username }}</h2>
      <p v-if="profile.bio" style="color: #999; margin: 8px 0">{{ profile.bio }}</p>
      <a v-if="user?.username === username" href="#/settings" class="btn" style="margin-top: 8px">Edit Profile Settings</a>
      <button v-else-if="user" class="btn" style="margin-top: 8px" @click="toggleFollow">
        {{ profile.following ? 'Unfollow' : 'Follow' }} {{ profile.username }}
      </button>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>

    <h3 style="margin-bottom: 16px">Articles by {{ profile.username }}</h3>
    <div v-if="articles.length === 0" class="loading">No articles yet.</div>
    <div v-else v-for="article in articles" :key="article.slug" class="card">
      <div class="article-meta">
        <img :src="article.author.image || defaultImg" alt="" />
        <div>
          <a :href="'#/profile/' + article.author.username">{{ article.author.username }}</a>
          <div>{{ new Date(article.createdAt).toLocaleDateString() }}</div>
        </div>
        <button class="btn" style="margin-left: auto" @click="toggleFavorite(article)">
          {{ article.favorited ? '\u2764' : '\u2661' }} {{ article.favoritesCount }}
        </button>
      </div>
      <a :href="'#/article/' + article.slug">
        <h2 style="margin: 8px 0 4px; color: #333">{{ article.title }}</h2>
        <p style="color: #999; font-size: 0.9rem">{{ article.description }}</p>
      </a>
      <div style="margin-top: 8px">
        <span class="tag" v-for="tag in article.tagList" :key="tag">{{ tag }}</span>
      </div>
    </div>
  </div>
</template>
