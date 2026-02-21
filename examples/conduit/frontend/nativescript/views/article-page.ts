// Conduit Example App -- NativeScript Article Detail Page
// Loads and displays full article content with author info and social actions.

import { EventData, Page, Observable, Frame, NavigatedData } from '@nativescript/core';
import * as api from '../services/api-service';

class ArticleViewModel extends Observable {
  private _article: api.Article | null = null;
  private _isLoading = true;
  private _errorMessage: string | null = null;
  private _displayDate = '';

  get article(): api.Article | null { return this._article; }
  set article(value: api.Article | null) {
    this._article = value;
    this.notifyPropertyChange('article', value);
  }

  get isLoading(): boolean { return this._isLoading; }
  set isLoading(value: boolean) {
    this._isLoading = value;
    this.notifyPropertyChange('isLoading', value);
  }

  get errorMessage(): string | null { return this._errorMessage; }
  set errorMessage(value: string | null) {
    this._errorMessage = value;
    this.notifyPropertyChange('errorMessage', value);
  }

  get displayDate(): string { return this._displayDate; }
  set displayDate(value: string) {
    this._displayDate = value;
    this.notifyPropertyChange('displayDate', value);
  }

  async loadArticle(slug: string): Promise<void> {
    try {
      this.isLoading = true;
      this.errorMessage = null;
      const article = await api.getArticle(slug);
      this.article = article;
      this.displayDate = article.createdAt.substring(0, 10);
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load article';
    } finally {
      this.isLoading = false;
    }
  }

  async toggleFavorite(): Promise<void> {
    if (!this.article) return;
    try {
      const updated = this.article.favorited
        ? await api.unfavorite(this.article.slug)
        : await api.favorite(this.article.slug);
      this.article = updated;
    } catch {
      // Silently fail
    }
  }

  async toggleFollow(): Promise<void> {
    if (!this.article) return;
    try {
      const profile = this.article.author.following
        ? await api.unfollow(this.article.author.username)
        : await api.follow(this.article.author.username);
      this.article = {
        ...this.article,
        author: profile,
      };
    } catch {
      // Silently fail
    }
  }
}

let viewModel: ArticleViewModel;

export function onNavigatingTo(args: NavigatedData): void {
  const page = args.object as Page;
  const context = page.navigationContext as { slug: string } | undefined;

  viewModel = new ArticleViewModel();
  page.bindingContext = viewModel;

  if (context?.slug) {
    viewModel.loadArticle(context.slug);
  } else {
    viewModel.errorMessage = 'No article slug provided.';
    viewModel.isLoading = false;
  }
}

export function onFavoriteTap(): void {
  viewModel.toggleFavorite();
}

export function onFollowTap(): void {
  viewModel.toggleFollow();
}

export function onBackTap(): void {
  Frame.topmost().goBack();
}
