// Conduit Example App -- NativeScript Login Page
// Email and password login form with registration option.

import { EventData, Page, Observable, Frame } from '@nativescript/core';
import * as api from '../services/api-service';

class LoginViewModel extends Observable {
  private _email = '';
  private _password = '';
  private _isLoading = false;
  private _errorMessage: string | null = null;

  get email(): string { return this._email; }
  set email(value: string) {
    this._email = value;
    this.notifyPropertyChange('email', value);
  }

  get password(): string { return this._password; }
  set password(value: string) {
    this._password = value;
    this.notifyPropertyChange('password', value);
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

  async doLogin(): Promise<boolean> {
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Email and password are required.';
      return false;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      await api.login(this.email, this.password);
      return true;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Login failed';
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async doRegister(): Promise<boolean> {
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Email and password are required.';
      return false;
    }

    const username = this.email.split('@')[0];
    this.isLoading = true;
    this.errorMessage = null;

    try {
      await api.register(username, this.email, this.password);
      return true;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Registration failed';
      return false;
    } finally {
      this.isLoading = false;
    }
  }
}

let viewModel: LoginViewModel;

export function onNavigatingTo(args: EventData): void {
  const page = args.object as Page;
  viewModel = new LoginViewModel();
  page.bindingContext = viewModel;
}

export async function onLoginTap(): Promise<void> {
  const success = await viewModel.doLogin();
  if (success) {
    Frame.topmost().goBack();
  }
}

export async function onRegisterTap(): Promise<void> {
  const success = await viewModel.doRegister();
  if (success) {
    Frame.topmost().goBack();
  }
}

export function onBackTap(): void {
  Frame.topmost().goBack();
}
