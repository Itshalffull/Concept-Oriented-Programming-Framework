// Conduit Example App — Shared API Client
// HTTP fetch wrapper for the Conduit REST API.

import type {
  UserResponse, ProfileResponse, ArticleResponse,
  ArticlesResponse, CommentResponse, CommentsResponse,
  TagsResponse, ErrorResponse,
} from './types.js';

export class ConduitAPI {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const err = data as ErrorResponse;
      throw new Error(err.errors?.body?.join(', ') || `HTTP ${response.status}`);
    }

    return data as T;
  }

  // Auth
  async register(username: string, email: string, password: string): Promise<UserResponse> {
    return this.request('POST', '/api/users', { user: { username, email, password } });
  }

  async login(email: string, password: string): Promise<UserResponse> {
    return this.request('POST', '/api/users/login', { user: { email, password } });
  }

  // Profile
  async updateProfile(bio?: string, image?: string): Promise<UserResponse> {
    return this.request('PUT', '/api/user', { user: { bio, image } });
  }

  async getProfile(username: string): Promise<ProfileResponse> {
    return this.request('GET', `/api/profiles/${username}`);
  }

  // Articles
  async createArticle(title: string, description: string, body: string, tagList?: string[]): Promise<ArticleResponse> {
    return this.request('POST', '/api/articles', { article: { title, description, body, tagList } });
  }

  async deleteArticle(slug: string): Promise<void> {
    return this.request('DELETE', `/api/articles/${slug}`);
  }

  async getArticles(): Promise<ArticlesResponse> {
    return this.request('GET', '/api/articles');
  }

  // Comments
  async createComment(slug: string, body: string): Promise<CommentResponse> {
    return this.request('POST', `/api/articles/${slug}/comments`, { comment: { body } });
  }

  async deleteComment(slug: string, commentId: string): Promise<void> {
    return this.request('DELETE', `/api/articles/${slug}/comments/${commentId}`);
  }

  async getComments(slug: string): Promise<CommentsResponse> {
    return this.request('GET', `/api/articles/${slug}/comments`);
  }

  // Social
  async follow(username: string): Promise<ProfileResponse> {
    return this.request('POST', `/api/profiles/${username}/follow`);
  }

  async unfollow(username: string): Promise<ProfileResponse> {
    return this.request('DELETE', `/api/profiles/${username}/follow`);
  }

  async favorite(slug: string): Promise<ArticleResponse> {
    return this.request('POST', `/api/articles/${slug}/favorite`);
  }

  async unfavorite(slug: string): Promise<ArticleResponse> {
    return this.request('DELETE', `/api/articles/${slug}/favorite`);
  }

  // Tags
  async getTags(): Promise<TagsResponse> {
    return this.request('GET', '/api/tags');
  }

  // Health
  async health(): Promise<{ status: string; concepts: number; syncs: number }> {
    return this.request('GET', '/api/health');
  }
}
