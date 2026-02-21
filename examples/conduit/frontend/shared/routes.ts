// Conduit Example App — Route Definitions
// Shared across all framework frontends.

export interface Route {
  path: string;
  name: string;
  requiresAuth: boolean;
}

export const ROUTES: Record<string, Route> = {
  home:     { path: '/',               name: 'Home',     requiresAuth: false },
  login:    { path: '/login',          name: 'Login',    requiresAuth: false },
  register: { path: '/register',       name: 'Register', requiresAuth: false },
  editor:   { path: '/editor',         name: 'Editor',   requiresAuth: true },
  settings: { path: '/settings',       name: 'Settings', requiresAuth: true },
  article:  { path: '/article/:slug',  name: 'Article',  requiresAuth: false },
  profile:  { path: '/profile/:username', name: 'Profile', requiresAuth: false },
};

export function matchRoute(url: string): { route: Route; params: Record<string, string> } | null {
  for (const route of Object.values(ROUTES)) {
    const routeParts = route.path.split('/');
    const urlParts = url.split('?')[0].split('/');

    if (routeParts.length !== urlParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = urlParts[i];
      } else if (routeParts[i] !== urlParts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { route, params };
  }
  return null;
}
