// Conduit Example App — WebSocket Realtime Transport
// Concepts served via WebSocket for real-time push notifications.
// When articles/comments are created, connected clients get notified.

import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../../../runtime/adapters/transport.js';
import { createWebSocketConceptServer } from '../../../runtime/adapters/ws-transport.js';
import type { MockWebSocket } from '../../../runtime/adapters/ws-transport.js';
import type { ConceptHandler, ActionCompletion } from '../../../runtime/types.js';

// App concept handlers
import { userHandler } from '../../../handlers/ts/app/user.handler.js';
import { passwordHandler } from '../../../handlers/ts/app/password.handler.js';
import { jwtHandler } from '../../../handlers/ts/app/jwt.handler.js';
import { profileHandler } from '../../../handlers/ts/app/profile.handler.js';
import { articleHandler } from '../../../handlers/ts/app/article.handler.js';
import { commentHandler } from '../../../handlers/ts/app/comment.handler.js';
import { tagHandler } from '../../../handlers/ts/app/tag.handler.js';
import { favoriteHandler } from '../../../handlers/ts/app/favorite.handler.js';
import { followHandler } from '../../../handlers/ts/app/follow.handler.js';
import { echoHandler } from '../../../handlers/ts/app/echo.handler.js';

interface ConceptDef {
  uri: string;
  name: string;
  handler: ConceptHandler;
}

const CONCEPTS: ConceptDef[] = [
  { uri: 'urn:clef/User', name: 'User', handler: userHandler },
  { uri: 'urn:clef/Password', name: 'Password', handler: passwordHandler },
  { uri: 'urn:clef/JWT', name: 'JWT', handler: jwtHandler },
  { uri: 'urn:clef/Profile', name: 'Profile', handler: profileHandler },
  { uri: 'urn:clef/Article', name: 'Article', handler: articleHandler },
  { uri: 'urn:clef/Comment', name: 'Comment', handler: commentHandler },
  { uri: 'urn:clef/Tag', name: 'Tag', handler: tagHandler },
  { uri: 'urn:clef/Favorite', name: 'Favorite', handler: favoriteHandler },
  { uri: 'urn:clef/Follow', name: 'Follow', handler: followHandler },
  { uri: 'urn:clef/Echo', name: 'Echo', handler: echoHandler },
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
