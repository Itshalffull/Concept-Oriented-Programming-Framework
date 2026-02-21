<script lang="ts">
  import { onMount } from 'svelte';
  import type { ConduitAPI } from '../../shared/api-client.js';
  import type { Profile, Article } from '../../shared/types.js';
  import type { StoredUser } from '../../shared/auth.js';

  export let api: ConduitAPI;
  export let username: string;
  export let user: StoredUser | null;

  const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

  let profile: Profile | null = null;
  let articles: Article[] = [];
  let loading = true;
  let error = '';

  $: isOwn = user?.username === username;

  onMount(loadProfile);

  async function loadProfile() {
    loading = true;
    try {
      const [profileRes, articlesRes] = await Promise.all([
        api.getProfile(username),
        api.getArticles(),
      ]);
      profile = profileRes.profile;
      articles = articlesRes.articles.filter(a => a.author.username === username);
    } catch (err: any) {
      error = err.message || 'Failed to load profile';
    } finally {
      loading = false;
    }
  }

  async function toggleFollow() {
    if (!profile || !user) return;
    try {
      const res = profile.following
        ? await api.unfollow(username)
        : await api.follow(username);
      profile = res.profile;
    } catch (err: any) {
      console.error(err);
    }
  }

  async function toggleFavorite(article: Article) {
    if (!user) { window.location.hash = '#/login'; return; }
    try {
      const res = article.favorited
        ? await api.unfavorite(article.slug)
        : await api.favorite(article.slug);
      articles = articles.map(a => a.slug === article.slug ? res.article : a);
    } catch (err: any) {
      console.error(err);
    }
  }
</script>

{#if loading}
  <div class="loading">Loading profile...</div>
{:else if !profile}
  <div class="loading">Profile not found</div>
{:else}
  <div class="profile-header">
    <img src={profile.image || defaultImg} alt={profile.username} />
    <h2>{profile.username}</h2>
    {#if profile.bio}
      <p style="color: #999; margin: 8px 0">{profile.bio}</p>
    {/if}
    {#if isOwn}
      <a href="#/settings" class="btn" style="margin-top: 8px">Edit Profile Settings</a>
    {:else if user}
      <button class="btn" style="margin-top: 8px" on:click={toggleFollow}>
        {profile.following ? 'Unfollow' : 'Follow'} {profile.username}
      </button>
    {/if}
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  <h3 style="margin-bottom: 16px">Articles by {profile.username}</h3>
  {#if articles.length === 0}
    <div class="loading">No articles yet.</div>
  {:else}
    {#each articles as article (article.slug)}
      <div class="card">
        <div class="article-meta">
          <img src={article.author.image || defaultImg} alt="" />
          <div>
            <a href="#/profile/{article.author.username}">{article.author.username}</a>
            <div>{new Date(article.createdAt).toLocaleDateString()}</div>
          </div>
          <button class="btn" style="margin-left: auto" on:click={() => toggleFavorite(article)}>
            {article.favorited ? '\u2764' : '\u2661'} {article.favoritesCount}
          </button>
        </div>
        <a href="#/article/{article.slug}">
          <h2 style="margin: 8px 0 4px; color: #333">{article.title}</h2>
          <p style="color: #999; font-size: 0.9rem">{article.description}</p>
        </a>
        <div style="margin-top: 8px">
          {#each article.tagList as tag}
            <span class="tag">{tag}</span>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
{/if}
