// Conduit Example App -- NativeScript API Service
// HTTP client using NativeScript's Http module for the Conduit REST API.

import { Http, HttpResponse } from '@nativescript/core';

const BASE_URL = 'http://localhost:3000';

// Models
export interface User {
  username: string;
  email: string;
  token: string;
  bio?: string;
  image?: string;
}

export interface Profile {
  username: string;
  bio?: string;
  image?: string;
  following: boolean;
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: Profile;
}

export interface UserResponse { user: User }
export interface ProfileResponse { profile: Profile }
export interface ArticleResponse { article: Article }
export interface ArticlesResponse { articles: Article[]; articlesCount: number }
export interface CommentResponse { comment: Comment }
export interface CommentsResponse { comments: Comment[] }
export interface TagsResponse { tags: string[] }
export interface ErrorResponse { errors: { body: string[] } }

// Token management
let authToken: string | null = null;
let currentUser: User | null = null;

export function setToken(token: string | null): void {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return authToken !== null;
}

export function logout(): void {
  authToken = null;
  currentUser = null;
}

// Generic request helper
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Token ${authToken}`;
  }

  const options: any = {
    url: `${BASE_URL}${path}`,
    method,
    headers,
    timeout: 15000,
  };

  if (body) {
    options.content = JSON.stringify(body);
  }

  let response: HttpResponse;
  try {
    response = await Http.request(options);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Network error');
  }

  const data = response.content?.toJSON?.() ?? JSON.parse(response.content?.toString?.() ?? '{}');

  if (response.statusCode >= 400) {
    const errorRes = data as ErrorResponse;
    const msg = errorRes?.errors?.body?.join(', ') || `HTTP ${response.statusCode}`;
    throw new Error(msg);
  }

  return data as T;
}

// Auth
export async function login(email: string, password: string): Promise<User> {
  const res = await request<UserResponse>('POST', '/api/users/login', {
    user: { email, password },
  });
  authToken = res.user.token;
  currentUser = res.user;
  return res.user;
}

export async function register(username: string, email: string, password: string): Promise<User> {
  const res = await request<UserResponse>('POST', '/api/users', {
    user: { username, email, password },
  });
  authToken = res.user.token;
  currentUser = res.user;
  return res.user;
}

// Profile
export async function getProfile(username: string): Promise<Profile> {
  const res = await request<ProfileResponse>('GET', `/api/profiles/${username}`);
  return res.profile;
}

export async function updateProfile(bio?: string, image?: string): Promise<User> {
  const res = await request<UserResponse>('PUT', '/api/user', {
    user: { bio, image },
  });
  currentUser = res.user;
  return res.user;
}

// Articles
export async function getArticles(): Promise<Article[]> {
  const res = await request<ArticlesResponse>('GET', '/api/articles');
  return res.articles;
}

export async function getArticle(slug: string): Promise<Article> {
  const res = await request<ArticleResponse>('GET', `/api/articles/${slug}`);
  return res.article;
}

export async function createArticle(
  title: string, description: string, body: string, tagList?: string[]
): Promise<Article> {
  const res = await request<ArticleResponse>('POST', '/api/articles', {
    article: { title, description, body, tagList },
  });
  return res.article;
}

export async function deleteArticle(slug: string): Promise<void> {
  await request<void>('DELETE', `/api/articles/${slug}`);
}

// Comments
export async function getComments(slug: string): Promise<Comment[]> {
  const res = await request<CommentsResponse>('GET', `/api/articles/${slug}/comments`);
  return res.comments;
}

export async function createComment(slug: string, body: string): Promise<Comment> {
  const res = await request<CommentResponse>('POST', `/api/articles/${slug}/comments`, {
    comment: { body },
  });
  return res.comment;
}

export async function deleteComment(slug: string, commentId: string): Promise<void> {
  await request<void>('DELETE', `/api/articles/${slug}/comments/${commentId}`);
}

// Social
export async function follow(username: string): Promise<Profile> {
  const res = await request<ProfileResponse>('POST', `/api/profiles/${username}/follow`);
  return res.profile;
}

export async function unfollow(username: string): Promise<Profile> {
  const res = await request<ProfileResponse>('DELETE', `/api/profiles/${username}/follow`);
  return res.profile;
}

export async function favorite(slug: string): Promise<Article> {
  const res = await request<ArticleResponse>('POST', `/api/articles/${slug}/favorite`);
  return res.article;
}

export async function unfavorite(slug: string): Promise<Article> {
  const res = await request<ArticleResponse>('DELETE', `/api/articles/${slug}/favorite`);
  return res.article;
}

// Tags
export async function getTags(): Promise<string[]> {
  const res = await request<TagsResponse>('GET', '/api/tags');
  return res.tags;
}
