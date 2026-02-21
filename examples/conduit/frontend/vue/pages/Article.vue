<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article, Comment } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const props = defineProps<{ api: ConduitAPI; slug: string; user: StoredUser | null }>();
const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

const article = ref<Article | null>(null);
const comments = ref<Comment[]>([]);
const commentBody = ref('');
const loading = ref(true);
const error = ref('');

async function loadArticle() {
  loading.value = true;
  try {
    const [artRes, comRes] = await Promise.all([
      props.api.getArticles().then(r => r.articles.find(a => a.slug === props.slug)),
      props.api.getComments(props.slug),
    ]);
    if (artRes) article.value = artRes;
    comments.value = comRes.comments;
  } catch (err: any) {
    error.value = err.message || 'Failed to load article';
  } finally {
    loading.value = false;
  }
}

onMounted(loadArticle);
watch(() => props.slug, loadArticle);

async function submitComment() {
  if (!commentBody.value.trim()) return;
  try {
    const res = await props.api.createComment(props.slug, commentBody.value);
    comments.value.unshift(res.comment);
    commentBody.value = '';
  } catch (err: any) {
    error.value = err.message || 'Failed to post comment';
  }
}

async function deleteComment(id: string) {
  try {
    await props.api.deleteComment(props.slug, id);
    comments.value = comments.value.filter(c => c.id !== id);
  } catch (err: any) {
    error.value = err.message || 'Failed to delete comment';
  }
}

async function deleteArticle() {
  try {
    await props.api.deleteArticle(props.slug);
    window.location.hash = '#/';
  } catch (err: any) {
    error.value = err.message || 'Failed to delete article';
  }
}

async function toggleFavorite() {
  if (!article.value || !props.user) return;
  try {
    const res = article.value.favorited
      ? await props.api.unfavorite(props.slug)
      : await props.api.favorite(props.slug);
    article.value = res.article;
  } catch (err: any) {
    console.error(err);
  }
}

async function toggleFollow() {
  if (!article.value || !props.user) return;
  try {
    const res = article.value.author.following
      ? await props.api.unfollow(article.value.author.username)
      : await props.api.follow(article.value.author.username);
    article.value = { ...article.value, author: res.profile };
  } catch (err: any) {
    console.error(err);
  }
}
</script>

<template>
  <div v-if="loading" class="loading">Loading article...</div>
  <div v-else-if="!article" class="loading">Article not found</div>
  <div v-else>
    <div style="background: #333; color: #fff; padding: 32px 16px; margin: 0 -16px 24px">
      <h1 style="font-size: 2rem; margin-bottom: 12px">{{ article.title }}</h1>
      <div class="article-meta">
        <img :src="article.author.image || defaultImg" alt="" />
        <div>
          <a :href="'#/profile/' + article.author.username" style="color: #fff">{{ article.author.username }}</a>
          <div style="color: #bbb">{{ new Date(article.createdAt).toLocaleDateString() }}</div>
        </div>
        <template v-if="user?.username === article.author.username">
          <a :href="'#/editor/' + article.slug" class="btn" style="border-color: #ccc; color: #ccc">Edit</a>
          <button class="btn btn-danger" @click="deleteArticle">Delete</button>
        </template>
        <template v-else>
          <button class="btn" style="border-color: #ccc; color: #ccc" @click="toggleFollow">
            {{ article.author.following ? 'Unfollow' : 'Follow' }} {{ article.author.username }}
          </button>
          <button class="btn" @click="toggleFavorite">
            {{ article.favorited ? '\u2764' : '\u2661' }} {{ article.favoritesCount }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>

    <div style="line-height: 1.8; margin-bottom: 32px; white-space: pre-wrap">{{ article.body }}</div>

    <div style="margin-bottom: 16px">
      <span class="tag" v-for="tag in article.tagList" :key="tag">{{ tag }}</span>
    </div>

    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0" />

    <div style="max-width: 640px; margin: 0 auto">
      <form v-if="user" @submit.prevent="submitComment" style="margin-bottom: 24px">
        <textarea
          placeholder="Write a comment..."
          v-model="commentBody"
          style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; min-height: 80px; margin-bottom: 8px"
        ></textarea>
        <button class="btn btn-primary" type="submit">Post Comment</button>
      </form>
      <p v-else style="text-align: center; margin-bottom: 24px; color: #999">
        <a href="#/login">Sign in</a> or <a href="#/register">sign up</a> to add comments.
      </p>

      <div v-for="comment in comments" :key="comment.id" class="comment card">
        <p style="margin-bottom: 8px">{{ comment.body }}</p>
        <div class="article-meta">
          <img :src="comment.author.image || defaultImg" alt="" />
          <a :href="'#/profile/' + comment.author.username">{{ comment.author.username }}</a>
          <span>{{ new Date(comment.createdAt).toLocaleDateString() }}</span>
          <button
            v-if="user?.username === comment.author.username"
            class="btn btn-danger"
            style="margin-left: auto; padding: 2px 8px; font-size: 0.8rem"
            @click="deleteComment(comment.id)"
          >&times;</button>
        </div>
      </div>
    </div>
  </div>
</template>
