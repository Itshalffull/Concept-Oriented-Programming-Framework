<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ConduitAPI } from '../../shared/api-client.js';
  import { saveAuth } from '../../shared/auth.js';
  import type { StoredUser } from '../../shared/auth.js';

  export let api: ConduitAPI;
  export let user: StoredUser | null;

  const dispatch = createEventDispatcher<{ logout: void }>();

  let image = '';
  let bio = '';
  let error = '';
  let success = '';
  let loading = false;

  async function handleSubmit() {
    error = '';
    success = '';
    loading = true;
    try {
      const res = await api.updateProfile(bio || undefined, image || undefined);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      success = 'Settings updated successfully!';
    } catch (err: any) {
      error = err.message || 'Failed to update settings';
    } finally {
      loading = false;
    }
  }
</script>

{#if !user}
  <div class="loading">Please sign in to view settings.</div>
{:else}
  <div style="max-width: 540px; margin: 0 auto">
    <h1 style="text-align: center; margin-bottom: 16px">Your Settings</h1>
    {#if error}
      <div class="error-msg">{error}</div>
    {/if}
    {#if success}
      <div style="color: #5cb85c; margin-bottom: 12px">{success}</div>
    {/if}
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <input type="url" placeholder="URL of profile picture" bind:value={image} />
      </div>
      <div class="form-group">
        <input type="text" value={user.username} disabled style="background: #eee" />
      </div>
      <div class="form-group">
        <textarea placeholder="Short bio about you" bind:value={bio} style="min-height: 100px"></textarea>
      </div>
      <div class="form-group">
        <input type="email" value={user.email} disabled style="background: #eee" />
      </div>
      <button class="btn btn-primary" type="submit" disabled={loading} style="width: 100%">
        {loading ? 'Updating...' : 'Update Settings'}
      </button>
    </form>
    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0" />
    <button class="btn btn-danger" on:click={() => dispatch('logout')} style="width: 100%">
      Or click here to logout
    </button>
  </div>
{/if}
