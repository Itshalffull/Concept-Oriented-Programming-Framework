// Vanilla DOM hash-based router

export interface RouteMatch {
  page: string;
  param?: string;
}

export function parseHash(): RouteMatch {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  switch (parts[0]) {
    case 'login': return { page: 'login' };
    case 'register': return { page: 'register' };
    case 'editor': return { page: 'editor', param: parts[1] };
    case 'settings': return { page: 'settings' };
    case 'article': return { page: 'article', param: parts[1] };
    case 'profile': return { page: 'profile', param: parts[1] };
    default: return { page: 'home' };
  }
}

export function navigate(path: string) {
  window.location.hash = path;
}

export type PageRenderer = (container: HTMLElement) => void | Promise<void>;

export function onRouteChange(callback: (route: RouteMatch) => void) {
  const handler = () => callback(parseHash());
  window.addEventListener('hashchange', handler);
  // Initial call
  handler();
  return () => window.removeEventListener('hashchange', handler);
}
