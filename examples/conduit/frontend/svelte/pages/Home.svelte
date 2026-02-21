<script lang="ts">
  import { onMount } from 'svelte';
  import type { ConduitAPI } from '../../shared/api-client.js';
  import type { Article } from '../../shared/types.js';
  import type { StoredUser } from '../../shared/auth.js';

  export let api: ConduitAPI;
  export let user: StoredUser | null;

  let articles: Article[] = [];
  let tags: string[] = [];
  let loading = true;
  let selectedTag: string | null = null;
  const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

  $: displayed = selectedTag
    ? articles.filter(a => a.tagList.includes(selectedTag!))
    : articles;

  onMount(async () => {
    try {
      const [artRes, tagRes] = await Promise.all([
        api.getArticles(),
        api.getTags(),
      ]);
      articles = artRes.articles;
      tags = tagRes.tags;
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      loading = false;
    }
  });

  async function toggleFavorite(article: Article) {
    if (!user) { window.location.hash = '#/login'; return; }
    try {
      const res = article.favorited
        ? await api.unfavorite(article.slug)
        : await api.favorite(article.slug);
      articles = articles.map(a => a.slug === article.slug ? res.article : a);
    } catch (err) {
      console.error('Favorite failed:', err);
    }
  }
</script>

<div class="banner">
  <h1>conduit</h1>
  <p>A place to share your knowledge.</p>
</div>

<div class="two-col">
  <div>
    {#if selectedTag}
      <div style="margin-bottom: 12px">
        Filtered by tag: <span class="tag">{selectedTag}</span>
        <button on:click={() => selectedTag = null} style="margin-left: 8px; cursor: pointer; background: none; border: none; color: #999">
          &times; clear
        </button>
      </div>
    {/if}

    {#if loading}
      <div class="loading">Loading articles...</div>
    {:else if displayed.length === 0}
      <div class="loading">No articles yet.</div>
    {:else}
      {#each displayed as article (article.slug)}
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
              <span class="tag" on:click={() => selectedTag = tag}>{tag}</span>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div>
    <div class="card">
      <h4 style="margin-bottom: 8px">Popular Tags</h4>
      {#if tags.length === 0}
        <p style="color: #999">No tags yet</p>
      {:else}
        {#each tags as tag}
          <span class="tag" on:click={() => selectedTag = tag}>{tag}</span>
        {/each}
      {/if}
    </div>
  </div>
</div>
