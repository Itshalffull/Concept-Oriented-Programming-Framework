// Conduit Example App -- NativeScript Home Page
// Loads and displays the article feed, handles navigation.

import { EventData, Page, Observable, ItemEventData, Frame } from '@nativescript/core';
import * as api from '../services/api-service';

class HomeViewModel extends Observable {
  private _articles: api.Article[] = [];
  private _isLoading = true;
  private _errorMessage: string | null = null;

  get articles(): api.Article[] { return this._articles; }
  set articles(value: api.Article[]) {
    this._articles = value;
    this.notifyPropertyChange('articles', value);
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

  async loadArticles(): Promise<void> {
    try {
      this.isLoading = true;
      this.errorMessage = null;
      const articles = await api.getArticles();
      this.articles = articles.map(a => ({
        ...a,
        createdAt: a.createdAt.substring(0, 10),
      }));
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load articles';
    } finally {
      this.isLoading = false;
    }
  }
}

let viewModel: HomeViewModel;
let page: Page;

export function onNavigatingTo(args: EventData): void {
  page = args.object as Page;
  viewModel = new HomeViewModel();
  page.bindingContext = viewModel;
  viewModel.loadArticles();
}

export function onArticleTap(args: ItemEventData): void {
  const article = viewModel.articles[args.index];
  if (article) {
    Frame.topmost().navigate({
      moduleName: 'views/article-page',
      context: { slug: article.slug },
    });
  }
}

export function onLoginTap(): void {
  if (api.isAuthenticated()) {
    api.logout();
    // Refresh to update UI
    viewModel.loadArticles();
  } else {
    Frame.topmost().navigate({
      moduleName: 'views/login-page',
    });
  }
}

export function onRefreshTap(): void {
  viewModel.loadArticles();
}
