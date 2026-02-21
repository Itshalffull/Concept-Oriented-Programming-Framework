<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const props = defineProps<{ api: ConduitAPI; user: StoredUser | null }>();

const articles = ref<Article[]>([]);
const tags = ref<string[]>([]);
const loading = ref(true);
const selectedTag = ref<string | null>(null);
const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

const displayed = computed(() =>
  selectedTag.value
    ? articles.value.filter(a => a.tagList.includes(selectedTag.value!))
    : articles.value
);

onMounted(async () => {
  try {
    const [artRes, tagRes] = await Promise.all([
      props.api.getArticles(),
      props.api.getTags(),
    ]);
    articles.value = artRes.articles;
    tags.value = tagRes.tags;
  } catch (err) {
    console.error('Failed to load feed:', err);
  } finally {
    loading.value = false;
  }
});

async function toggleFavorite(article: Article) {
  if (!props.user) { window.location.hash = '#/login'; return; }
  try {
    const res = article.favorited
      ? await props.api.unfavorite(article.slug)
      : await props.api.favorite(article.slug);
    const idx = articles.value.findIndex(a => a.slug === article.slug);
    if (idx >= 0) articles.value[idx] = res.article;
  } catch (err) {
    console.error('Favorite failed:', err);
  }
}
</script>

<template>
  <div class="banner">
    <h1>conduit</h1>
    <p>A place to share your knowledge.</p>
  </div>
  <div class="two-col">
    <div>
      <div v-if="selectedTag" style="margin-bottom: 12px">
        Filtered by tag: <span class="tag">{{ selectedTag }}</span>
        <button @click="selectedTag = null" style="margin-left: 8px; cursor: pointer; background: none; border: none; color: #999">&times; clear</button>
      </div>
      <div v-if="loading" class="loading">Loading articles...</div>
      <div v-else-if="displayed.length === 0" class="loading">No articles yet.</div>
      <div v-else v-for="article in displayed" :key="article.slug" class="card">
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
          <span class="tag" v-for="tag in article.tagList" :key="tag" @click="selectedTag = tag">{{ tag }}</span>
        </div>
      </div>
    </div>
    <div>
      <div class="card">
        <h4 style="margin-bottom: 8px">Popular Tags</h4>
        <p v-if="tags.length === 0" style="color: #999">No tags yet</p>
        <span v-else class="tag" v-for="tag in tags" :key="tag" @click="selectedTag = tag">{{ tag }}</span>
      </div>
    </div>
  </div>
</template>
