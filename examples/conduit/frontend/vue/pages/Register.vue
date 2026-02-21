<script setup lang="ts">
import { ref } from 'vue';
import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

const props = defineProps<{ api: ConduitAPI }>();
const emit = defineEmits<{ login: [user: StoredUser] }>();

const username = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  loading.value = true;
  try {
    const res = await props.api.register(username.value, email.value, password.value);
    const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
    saveAuth(stored);
    emit('login', stored);
  } catch (err: any) {
    error.value = err.message || 'Registration failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <h1 style="text-align: center; margin-bottom: 8px">Sign Up</h1>
    <p style="text-align: center; margin-bottom: 16px"><a href="#/login">Have an account?</a></p>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <input type="text" placeholder="Username" v-model="username" required />
      </div>
      <div class="form-group">
        <input type="email" placeholder="Email" v-model="email" required />
      </div>
      <div class="form-group">
        <input type="password" placeholder="Password" v-model="password" required />
      </div>
      <button class="btn btn-primary" type="submit" :disabled="loading" style="width: 100%">
        {{ loading ? 'Signing up...' : 'Sign up' }}
      </button>
    </form>
  </div>
</template>
