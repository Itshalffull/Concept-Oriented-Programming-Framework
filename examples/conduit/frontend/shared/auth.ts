// Conduit Example App — Auth Token Store
// Manages JWT token persistence across page refreshes.

const TOKEN_KEY = 'conduit_token';
const USER_KEY = 'conduit_user';

export interface StoredUser {
  username: string;
  email: string;
  token: string;
}

// Browser-compatible storage (falls back to in-memory for Node.js/Terminal)
const memoryStore = new Map<string, string>();

function getStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }
  return {
    getItem: (key: string) => memoryStore.get(key) || null,
    setItem: (key: string, value: string) => memoryStore.set(key, value),
    removeItem: (key: string) => memoryStore.delete(key),
  };
}

export function saveAuth(user: StoredUser): void {
  const storage = getStorage();
  storage.setItem(TOKEN_KEY, user.token);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  return getStorage().getItem(TOKEN_KEY);
}

export function getUser(): StoredUser | null {
  const raw = getStorage().getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearAuth(): void {
  const storage = getStorage();
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}
