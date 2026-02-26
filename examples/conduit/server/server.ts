// Conduit Example App — Standalone HTTP Server
// Boots the COPF kernel with all 10 concepts and 7 syncs,
// then serves a REST API on the configured port.

import { createServer } from 'http';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createKernel } from '../../../handlers/ts/framework/kernel-factory.js';
import { parseSyncFile } from '../../../handlers/ts/framework/sync-parser.handler.js';

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

import { createRouter } from './routes.js';
import { loadConfig } from './config.js';

const SYNCS_DIR = resolve(import.meta.dirname || __dirname, '..', '..', '..', 'syncs', 'app');

const SYNC_FILES = [
  'echo.sync',
  'registration.sync',
  'login.sync',
  'profile.sync',
  'articles.sync',
  'comments.sync',
  'social.sync',
  'reads.sync',
];

export function createConduitKernel() {
  const kernel = createKernel();

  // Register all 10 app concepts
  kernel.registerConcept('urn:copf/User', userHandler);
  kernel.registerConcept('urn:copf/Password', passwordHandler);
  kernel.registerConcept('urn:copf/JWT', jwtHandler);
  kernel.registerConcept('urn:copf/Profile', profileHandler);
  kernel.registerConcept('urn:copf/Article', articleHandler);
  kernel.registerConcept('urn:copf/Comment', commentHandler);
  kernel.registerConcept('urn:copf/Tag', tagHandler);
  kernel.registerConcept('urn:copf/Favorite', favoriteHandler);
  kernel.registerConcept('urn:copf/Follow', followHandler);
  kernel.registerConcept('urn:copf/Echo', echoHandler);

  // Load and register all 8 sync files
  for (const file of SYNC_FILES) {
    const source = readFileSync(resolve(SYNCS_DIR, file), 'utf-8');
    const syncs = parseSyncFile(source);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }
  }

  return kernel;
}

export function startServer(port?: number) {
  const config = loadConfig();
  const effectivePort = port ?? config.port;
  const kernel = createConduitKernel();
  const router = createRouter(kernel);

  const server = createServer(router);

  server.listen(effectivePort, () => {
    console.log(`Conduit COPF server running on http://localhost:${effectivePort}`);
    console.log(`  Concepts: 10 (User, Password, JWT, Profile, Article, Comment, Tag, Favorite, Follow, Echo)`);
    console.log(`  Syncs:    8 (echo, registration, login, profile, articles, comments, social, reads)`);
    console.log(`  Storage:  ${config.storageBackend}`);
    console.log(`  Transport: ${config.transportMode}`);
  });

  return { server, kernel };
}

// Run directly if this is the entry point
const isDirectRun = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  startServer();
}
