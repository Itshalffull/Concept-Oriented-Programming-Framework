<script setup lang="ts">
import { ref } from 'vue';
import type { ConduitAPI } from '../../shared/api-client.js';

const props = defineProps<{ api: ConduitAPI; slug?: string }>();

const title = ref('');
const description = ref('');
const body = ref('');
const tagInput = ref('');
const tagList = ref<string[]>([]);
const error = ref('');
const loading = ref(false);

function addTag(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const tag = tagInput.value.trim();
    if (tag && !tagList.value.includes(tag)) {
      tagList.value.push(tag);
    }
    tagInput.value = '';
  }
}

function removeTag(tag: string) {
  tagList.value = tagList.value.filter(t => t !== tag);
}

async function handleSubmit() {
  error.value = '';
  loading.value = true;
  try {
    const res = await props.api.createArticle(title.value, description.value, body.value, tagList.value);
    window.location.hash = `#/article/${res.article.slug}`;
  } catch (err: any) {
    error.value = err.message || 'Failed to publish article';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div style="max-width: 640px; margin: 0 auto">
    <h1 style="margin-bottom: 16px">{{ slug ? 'Edit Article' : 'New Article' }}</h1>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <input type="text" placeholder="Article Title" v-model="title" required />
      </div>
      <div class="form-group">
        <input type="text" placeholder="What's this article about?" v-model="description" required />
      </div>
      <div class="form-group">
        <textarea placeholder="Write your article (in markdown)" v-model="body" style="min-height: 200px" required></textarea>
      </div>
      <div class="form-group">
        <input type="text" placeholder="Enter tags (press Enter to add)" v-model="tagInput" @keydown="addTag" />
        <div style="margin-top: 8px">
          <span class="tag" v-for="tag in tagList" :key="tag" @click="removeTag(tag)" style="cursor: pointer">
            &times; {{ tag }}
          </span>
        </div>
      </div>
      <button class="btn btn-primary" type="submit" :disabled="loading" style="width: 100%">
        {{ loading ? 'Publishing...' : 'Publish Article' }}
      </button>
    </form>
  </div>
</template>
