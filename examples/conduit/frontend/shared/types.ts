// Conduit Example App — Shared Frontend Types
// Response types matching the Conduit/RealWorld API spec.

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

export interface Tag {
  name: string;
}

// API response wrappers
export interface UserResponse { user: User }
export interface ProfileResponse { profile: Profile }
export interface ArticleResponse { article: Article }
export interface ArticlesResponse { articles: Article[]; articlesCount: number }
export interface CommentResponse { comment: Comment }
export interface CommentsResponse { comments: Comment[] }
export interface TagsResponse { tags: string[] }

// API error response
export interface ErrorResponse { errors: { body: string[] } }
