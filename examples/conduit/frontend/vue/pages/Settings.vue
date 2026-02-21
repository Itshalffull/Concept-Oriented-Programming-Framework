<script setup lang="ts">
import { ref } from 'vue';
import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

const props = defineProps<{ api: ConduitAPI; user: StoredUser | null }>();
const emit = defineEmits<{ logout: [] }>();

const image = ref('');
const bio = ref('');
const error = ref('');
const success = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  success.value = '';
  loading.value = true;
  try {
    const res = await props.api.updateProfile(bio.value || undefined, image.value || undefined);
    const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
    saveAuth(stored);
    success.value = 'Settings updated successfully!';
  } catch (err: any) {
    error.value = err.message || 'Failed to update settings';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="!user" class="loading">Please sign in to view settings.</div>
  <div v-else style="max-width: 540px; margin: 0 auto">
    <h1 style="text-align: center; margin-bottom: 16px">Your Settings</h1>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <div v-if="success" style="color: #5cb85c; margin-bottom: 12px">{{ success }}</div>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <input type="url" placeholder="URL of profile picture" v-model="image" />
      </div>
      <div class="form-group">
        <input type="text" :value="user.username" disabled style="background: #eee" />
      </div>
      <div class="form-group">
        <textarea placeholder="Short bio about you" v-model="bio" style="min-height: 100px"></textarea>
      </div>
      <div class="form-group">
        <input type="email" :value="user.email" disabled style="background: #eee" />
      </div>
      <button class="btn btn-primary" type="submit" :disabled="loading" style="width: 100%">
        {{ loading ? 'Updating...' : 'Update Settings' }}
      </button>
    </form>
    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0" />
    <button class="btn btn-danger" @click="emit('logout')" style="width: 100%">
      Or click here to logout
    </button>
  </div>
</template>
