// Conduit Example App -- React Native API Client
// Wraps the Conduit REST API with typed fetch calls.

const BASE_URL = 'http://localhost:3000';

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

let authToken: string | null = null;

export function setToken(token: string | null): void {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Token ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
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
export async function register(username: string, email: string, password: string): Promise<UserResponse> {
  return request('POST', '/api/users', { user: { username, email, password } });
}

export async function login(email: string, password: string): Promise<UserResponse> {
  return request('POST', '/api/users/login', { user: { email, password } });
}

// Profile
export async function updateProfile(bio?: string, image?: string): Promise<UserResponse> {
  return request('PUT', '/api/user', { user: { bio, image } });
}

export async function getProfile(username: string): Promise<ProfileResponse> {
  return request('GET', `/api/profiles/${username}`);
}

// Articles
export async function getArticles(): Promise<ArticlesResponse> {
  return request('GET', '/api/articles');
}

export async function getArticle(slug: string): Promise<ArticleResponse> {
  return request('GET', `/api/articles/${slug}`);
}

export async function createArticle(
  title: string, description: string, body: string, tagList?: string[]
): Promise<ArticleResponse> {
  return request('POST', '/api/articles', { article: { title, description, body, tagList } });
}

export async function deleteArticle(slug: string): Promise<void> {
  return request('DELETE', `/api/articles/${slug}`);
}

// Comments
export async function getComments(slug: string): Promise<CommentsResponse> {
  return request('GET', `/api/articles/${slug}/comments`);
}

export async function createComment(slug: string, body: string): Promise<CommentResponse> {
  return request('POST', `/api/articles/${slug}/comments`, { comment: { body } });
}

export async function deleteComment(slug: string, commentId: string): Promise<void> {
  return request('DELETE', `/api/articles/${slug}/comments/${commentId}`);
}

// Social
export async function follow(username: string): Promise<ProfileResponse> {
  return request('POST', `/api/profiles/${username}/follow`);
}

export async function unfollow(username: string): Promise<ProfileResponse> {
  return request('DELETE', `/api/profiles/${username}/follow`);
}

export async function favorite(slug: string): Promise<ArticleResponse> {
  return request('POST', `/api/articles/${slug}/favorite`);
}

export async function unfavorite(slug: string): Promise<ArticleResponse> {
  return request('DELETE', `/api/articles/${slug}/favorite`);
}

// Tags
export async function getTags(): Promise<TagsResponse> {
  return request('GET', '/api/tags');
}
