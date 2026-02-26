// Conduit Example App — HTTP Distributed Transport
// Each concept runs as a separate HTTP microservice.
// The kernel resolves concepts via HTTP transport adapters.

import { createServer } from 'http';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../../../kernel/src/transport.js';
import { createHttpConceptServer, createHttpLiteAdapter } from '../../../kernel/src/http-transport.js';
import { createSelfHostedKernel } from '../../../kernel/src/self-hosted.js';
import { createSyncEngineHandler } from '../../../handlers/ts/framework/sync-engine.handler.js';
import { parseSyncFile } from '../../../handlers/ts/framework/sync-parser.handler.js';
import type { ConceptHandler } from '../../../kernel/src/types.js';

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

import { createRouter } from '../server/routes.js';

const SYNCS_DIR = resolve(import.meta.dirname || __dirname, '..', '..', '..', 'syncs', 'app');

interface ConceptService {
  uri: string;
  name: string;
  handler: ConceptHandler;
  port: number;
}

const CONCEPT_SERVICES: ConceptService[] = [
  { uri: 'urn:copf/User', name: 'User', handler: userHandler, port: 4001 },
  { uri: 'urn:copf/Password', name: 'Password', handler: passwordHandler, port: 4002 },
  { uri: 'urn:copf/JWT', name: 'JWT', handler: jwtHandler, port: 4003 },
  { uri: 'urn:copf/Profile', name: 'Profile', handler: profileHandler, port: 4004 },
  { uri: 'urn:copf/Article', name: 'Article', handler: articleHandler, port: 4005 },
  { uri: 'urn:copf/Comment', name: 'Comment', handler: commentHandler, port: 4006 },
  { uri: 'urn:copf/Tag', name: 'Tag', handler: tagHandler, port: 4007 },
  { uri: 'urn:copf/Favorite', name: 'Favorite', handler: favoriteHandler, port: 4008 },
  { uri: 'urn:copf/Follow', name: 'Follow', handler: followHandler, port: 4009 },
  { uri: 'urn:copf/Echo', name: 'Echo', handler: echoHandler, port: 4010 },
];

function startConceptServer(service: ConceptService): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve) => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(service.handler, storage);
    const httpHandler = createHttpConceptServer(transport);

    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', async () => {
        const body = chunks.length > 0
          ? JSON.parse(Buffer.concat(chunks).toString())
          : undefined;

        const result = await httpHandler(req.url || '/', req.method || 'GET', body);
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      });
    });

    server.listen(service.port, () => {
      console.log(`  ${service.name} concept running on http://localhost:${service.port}`);
      resolve(server);
    });
  });
}

export async function startDistributed(apiPort = 3000) {
  console.log('Starting distributed Conduit (HTTP transport)...\n');

  // Start individual concept servers
  const servers = await Promise.all(CONCEPT_SERVICES.map(startConceptServer));

  // Create kernel that resolves concepts via HTTP
  const registry = createConceptRegistry();
  const { handler: syncEngineHandler, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngineHandler, log, registry);

  // Register each concept as an HTTP remote
  for (const service of CONCEPT_SERVICES) {
    const httpTransport = createHttpLiteAdapter(`http://localhost:${service.port}`);
    registry.register(service.uri, httpTransport);
  }

  // Load syncs
  const syncFiles = ['echo.sync', 'registration.sync', 'login.sync', 'profile.sync',
    'articles.sync', 'comments.sync', 'social.sync'];
  for (const file of syncFiles) {
    const source = readFileSync(resolve(SYNCS_DIR, file), 'utf-8');
    for (const sync of parseSyncFile(source)) {
      kernel.registerSync(sync);
    }
  }

  // Start API gateway
  const router = createRouter(kernel);
  const apiServer = createServer(router);
  apiServer.listen(apiPort, () => {
    console.log(`\nConduit API gateway on http://localhost:${apiPort}`);
    console.log(`  10 concepts running as separate HTTP services (ports 4001-4010)`);
  });

  return { servers: [...servers, apiServer], kernel };
}

const isDirectRun = process.argv[1]?.endsWith('http-distributed.ts') || process.argv[1]?.endsWith('http-distributed.js');
if (isDirectRun) {
  startDistributed();
}
