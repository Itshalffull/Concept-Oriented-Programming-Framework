<script lang="ts">
  import { onMount } from 'svelte';
  import type { ConduitAPI } from '../../shared/api-client.js';
  import type { Article, Comment } from '../../shared/types.js';
  import type { StoredUser } from '../../shared/auth.js';

  export let api: ConduitAPI;
  export let slug: string;
  export let user: StoredUser | null;

  const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

  let article: Article | null = null;
  let comments: Comment[] = [];
  let commentBody = '';
  let loading = true;
  let error = '';

  onMount(loadArticle);

  async function loadArticle() {
    loading = true;
    try {
      const [artRes, comRes] = await Promise.all([
        api.getArticles().then(r => r.articles.find(a => a.slug === slug)),
        api.getComments(slug),
      ]);
      if (artRes) article = artRes;
      comments = comRes.comments;
    } catch (err: any) {
      error = err.message || 'Failed to load article';
    } finally {
      loading = false;
    }
  }

  async function submitComment() {
    if (!commentBody.trim()) return;
    try {
      const res = await api.createComment(slug, commentBody);
      comments = [res.comment, ...comments];
      commentBody = '';
    } catch (err: any) {
      error = err.message || 'Failed to post comment';
    }
  }

  async function deleteComment(id: string) {
    try {
      await api.deleteComment(slug, id);
      comments = comments.filter(c => c.id !== id);
    } catch (err: any) {
      error = err.message || 'Failed to delete comment';
    }
  }

  async function deleteArticle() {
    try {
      await api.deleteArticle(slug);
      window.location.hash = '#/';
    } catch (err: any) {
      error = err.message || 'Failed to delete article';
    }
  }

  async function toggleFavorite() {
    if (!article || !user) return;
    try {
      const res = article.favorited
        ? await api.unfavorite(slug)
        : await api.favorite(slug);
      article = res.article;
    } catch (err: any) {
      console.error(err);
    }
  }

  async function toggleFollow() {
    if (!article || !user) return;
    try {
      const res = article.author.following
        ? await api.unfollow(article.author.username)
        : await api.follow(article.author.username);
      article = { ...article, author: res.profile };
    } catch (err: any) {
      console.error(err);
    }
  }

  $: isAuthor = user?.username === article?.author?.username;
</script>

{#if loading}
  <div class="loading">Loading article...</div>
{:else if !article}
  <div class="loading">Article not found</div>
{:else}
  <div style="background: #333; color: #fff; padding: 32px 16px; margin: 0 -16px 24px">
    <h1 style="font-size: 2rem; margin-bottom: 12px">{article.title}</h1>
    <div class="article-meta">
      <img src={article.author.image || defaultImg} alt="" />
      <div>
        <a href="#/profile/{article.author.username}" style="color: #fff">{article.author.username}</a>
        <div style="color: #bbb">{new Date(article.createdAt).toLocaleDateString()}</div>
      </div>
      {#if isAuthor}
        <a href="#/editor/{article.slug}" class="btn" style="border-color: #ccc; color: #ccc">Edit</a>
        <button class="btn btn-danger" on:click={deleteArticle}>Delete</button>
      {:else}
        <button class="btn" style="border-color: #ccc; color: #ccc" on:click={toggleFollow}>
          {article.author.following ? 'Unfollow' : 'Follow'} {article.author.username}
        </button>
        <button class="btn" on:click={toggleFavorite}>
          {article.favorited ? '\u2764' : '\u2661'} {article.favoritesCount}
        </button>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  <div style="line-height: 1.8; margin-bottom: 32px; white-space: pre-wrap">{article.body}</div>

  <div style="margin-bottom: 16px">
    {#each article.tagList as tag}
      <span class="tag">{tag}</span>
    {/each}
  </div>

  <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0" />

  <div style="max-width: 640px; margin: 0 auto">
    {#if user}
      <form on:submit|preventDefault={submitComment} style="margin-bottom: 24px">
        <textarea
          placeholder="Write a comment..."
          bind:value={commentBody}
          style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; min-height: 80px; margin-bottom: 8px"
        ></textarea>
        <button class="btn btn-primary" type="submit">Post Comment</button>
      </form>
    {:else}
      <p style="text-align: center; margin-bottom: 24px; color: #999">
        <a href="#/login">Sign in</a> or <a href="#/register">sign up</a> to add comments.
      </p>
    {/if}

    {#each comments as comment (comment.id)}
      <div class="comment card">
        <p style="margin-bottom: 8px">{comment.body}</p>
        <div class="article-meta">
          <img src={comment.author.image || defaultImg} alt="" />
          <a href="#/profile/{comment.author.username}">{comment.author.username}</a>
          <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
          {#if user?.username === comment.author.username}
            <button class="btn btn-danger" style="margin-left: auto; padding: 2px 8px; font-size: 0.8rem" on:click={() => deleteComment(comment.id)}>
              &times;
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}
