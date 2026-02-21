<script lang="ts">
  import type { ConduitAPI } from '../../shared/api-client.js';

  export let api: ConduitAPI;
  export let slug: string | undefined = undefined;

  let title = '';
  let description = '';
  let body = '';
  let tagInput = '';
  let tagList: string[] = [];
  let error = '';
  let loading = false;

  function addTag(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !tagList.includes(tag)) {
        tagList = [...tagList, tag];
      }
      tagInput = '';
    }
  }

  function removeTag(tag: string) {
    tagList = tagList.filter(t => t !== tag);
  }

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const res = await api.createArticle(title, description, body, tagList);
      window.location.hash = `#/article/${res.article.slug}`;
    } catch (err: any) {
      error = err.message || 'Failed to publish article';
    } finally {
      loading = false;
    }
  }
</script>

<div style="max-width: 640px; margin: 0 auto">
  <h1 style="margin-bottom: 16px">{slug ? 'Edit Article' : 'New Article'}</h1>
  {#if error}
    <div class="error-msg">{error}</div>
  {/if}
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <input type="text" placeholder="Article Title" bind:value={title} required />
    </div>
    <div class="form-group">
      <input type="text" placeholder="What's this article about?" bind:value={description} required />
    </div>
    <div class="form-group">
      <textarea placeholder="Write your article (in markdown)" bind:value={body} style="min-height: 200px" required></textarea>
    </div>
    <div class="form-group">
      <input type="text" placeholder="Enter tags (press Enter to add)" bind:value={tagInput} on:keydown={addTag} />
      <div style="margin-top: 8px">
        {#each tagList as tag}
          <span class="tag" on:click={() => removeTag(tag)} style="cursor: pointer">
            &times; {tag}
          </span>
        {/each}
      </div>
    </div>
    <button class="btn btn-primary" type="submit" disabled={loading} style="width: 100%">
      {loading ? 'Publishing...' : 'Publish Article'}
    </button>
  </form>
</div>
