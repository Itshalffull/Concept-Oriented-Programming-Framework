// Conduit Example App — WebSocket Realtime Transport
// Concepts served via WebSocket for real-time push notifications.
// When articles/comments are created, connected clients get notified.

import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../../../kernel/src/transport.js';
import { createWebSocketConceptServer } from '../../../kernel/src/ws-transport.js';
import type { MockWebSocket } from '../../../kernel/src/ws-transport.js';
import type { ConceptHandler, ActionCompletion } from '../../../kernel/src/types.js';

// App concept handlers
import { userHandler } from '../../../implementations/typescript/app/user.impl.js';
import { passwordHandler } from '../../../implementations/typescript/app/password.impl.js';
import { jwtHandler } from '../../../implementations/typescript/app/jwt.impl.js';
import { profileHandler } from '../../../implementations/typescript/app/profile.impl.js';
import { articleHandler } from '../../../implementations/typescript/app/article.impl.js';
import { commentHandler } from '../../../implementations/typescript/app/comment.impl.js';
import { tagHandler } from '../../../implementations/typescript/app/tag.impl.js';
import { favoriteHandler } from '../../../implementations/typescript/app/favorite.impl.js';
import { followHandler } from '../../../implementations/typescript/app/follow.impl.js';
import { echoHandler } from '../../../implementations/typescript/app/echo.impl.js';

interface ConceptDef {
  uri: string;
  name: string;
  handler: ConceptHandler;
}

const CONCEPTS: ConceptDef[] = [
  { uri: 'urn:copf/User', name: 'User', handler: userHandler },
  { uri: 'urn:copf/Password', name: 'Password', handler: passwordHandler },
  { uri: 'urn:copf/JWT', name: 'JWT', handler: jwtHandler },
  { uri: 'urn:copf/Profile', name: 'Profile', handler: profileHandler },
  { uri: 'urn:copf/Article', name: 'Article', handler: articleHandler },
  { uri: 'urn:copf/Comment', name: 'Comment', handler: commentHandler },
  { uri: 'urn:copf/Tag', name: 'Tag', handler: tagHandler },
  { uri: 'urn:copf/Favorite', name: 'Favorite', handler: favoriteHandler },
  { uri: 'urn:copf/Follow', name: 'Follow', handler: followHandler },
  { uri: 'urn:copf/Echo', name: 'Echo', handler: echoHandler },
];

// Push notification types that connected clients receive
const PUSH_ACTIONS = ['create', 'delete', 'favorite', 'unfavorite', 'follow', 'unfollow'];

export interface WebSocketRealtimeServer {
  conceptServers: Map<string, (message: string) => Promise<string | null>>;
  pushSubscribers: Set<(completion: ActionCompletion) => void>;
  subscribe(handler: (completion: ActionCompletion) => void): () => void;
}

export function createWebSocketRealtimeServer(): WebSocketRealtimeServer {
  const conceptServers = new Map<string, (message: string) => Promise<string | null>>();
  const pushSubscribers = new Set<(completion: ActionCompletion) => void>();

  for (const concept of CONCEPTS) {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(concept.handler, storage);
    const wsHandler = createWebSocketConceptServer(transport);
    conceptServers.set(concept.uri, wsHandler);
  }

  return {
    conceptServers,
    pushSubscribers,
    subscribe(handler: (completion: ActionCompletion) => void) {
      pushSubscribers.add(handler);
      return () => pushSubscribers.delete(handler);
    },
  };
}

// Helper to create a mock WebSocket pair for testing
export function createMockWebSocketPair(): { client: MockWebSocket; server: MockWebSocket } {
  const clientHandlers: ((data: string) => void)[] = [];
  const serverHandlers: ((data: string) => void)[] = [];

  const client: MockWebSocket = {
    send(data: string) { serverHandlers.forEach(h => h(data)); },
    onMessage(handler) { clientHandlers.push(handler); },
    close() {},
    readyState: 1,
  };

  const server: MockWebSocket = {
    send(data: string) { clientHandlers.forEach(h => h(data)); },
    onMessage(handler) { serverHandlers.push(handler); },
    close() {},
    readyState: 1,
  };

  return { client, server };
}
