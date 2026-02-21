<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ConduitAPI } from '../../shared/api-client.js';
  import { saveAuth } from '../../shared/auth.js';
  import type { StoredUser } from '../../shared/auth.js';

  export let api: ConduitAPI;

  const dispatch = createEventDispatcher<{ login: StoredUser }>();

  let username = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const res = await api.register(username, email, password);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      dispatch('login', stored);
    } catch (err: any) {
      error = err.message || 'Registration failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <h1 style="text-align: center; margin-bottom: 8px">Sign Up</h1>
  <p style="text-align: center; margin-bottom: 16px"><a href="#/login">Have an account?</a></p>
  {#if error}
    <div class="error-msg">{error}</div>
  {/if}
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <input type="text" placeholder="Username" bind:value={username} required />
    </div>
    <div class="form-group">
      <input type="email" placeholder="Email" bind:value={email} required />
    </div>
    <div class="form-group">
      <input type="password" placeholder="Password" bind:value={password} required />
    </div>
    <button class="btn btn-primary" type="submit" disabled={loading} style="width: 100%">
      {loading ? 'Signing up...' : 'Sign up'}
    </button>
  </form>
</div>
