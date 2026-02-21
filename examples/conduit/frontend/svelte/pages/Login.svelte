<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ConduitAPI } from '../../shared/api-client.js';
  import { saveAuth } from '../../shared/auth.js';
  import type { StoredUser } from '../../shared/auth.js';

  export let api: ConduitAPI;

  const dispatch = createEventDispatcher<{ login: StoredUser }>();

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const res = await api.login(email, password);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      dispatch('login', stored);
    } catch (err: any) {
      error = err.message || 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <h1 style="text-align: center; margin-bottom: 8px">Sign In</h1>
  <p style="text-align: center; margin-bottom: 16px"><a href="#/register">Need an account?</a></p>
  {#if error}
    <div class="error-msg">{error}</div>
  {/if}
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <input type="email" placeholder="Email" bind:value={email} required />
    </div>
    <div class="form-group">
      <input type="password" placeholder="Password" bind:value={password} required />
    </div>
    <button class="btn btn-primary" type="submit" disabled={loading} style="width: 100%">
      {loading ? 'Signing in...' : 'Sign in'}
    </button>
  </form>
</div>
