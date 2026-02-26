// Conduit Example App — Terminal Platform Adapter
// Wires the TerminalAdapter concept to the Ink frontend.
// Provides a full terminal UI for browsing articles, posting, and social features.

import { createInMemoryStorage } from '../../../../runtime/adapters/storage.js';
import { terminaladapterHandler } from '../../../../generated/surface/typescript/terminaladapter.handler.js';
import { ConduitAPI } from '../../frontend/shared/api-client.js';

const api = new ConduitAPI('http://localhost:3000');

async function initTerminalPlatform() {
  const storage = createInMemoryStorage();

  // Initialize TerminalAdapter
  const initResult = await terminaladapterHandler.initialize(
    {
      platform: 'terminal',
      capabilities: ['stdin', 'stdout', 'ansi-colors', 'unicode'],
      dimensions: { columns: process.stdout.columns || 80, rows: process.stdout.rows || 24 },
    },
    storage,
  );

  console.log('Conduit Terminal Client');
  console.log('======================');
  console.log(`Platform: ${initResult.variant}`);

  // Handle terminal resize
  process.stdout.on('resize', async () => {
    await terminaladapterHandler.onViewportChange(
      { columns: process.stdout.columns, rows: process.stdout.rows },
      storage,
    );
  });

  // Simple interactive loop
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  function prompt(question: string): Promise<string> {
    return new Promise(resolve => rl.question(question, resolve));
  }

  console.log('\nCommands: login, register, articles, post, health, quit\n');

  let running = true;
  while (running) {
    const cmd = await prompt('conduit> ');

    switch (cmd.trim()) {
      case 'health': {
        try {
          const h = await api.health();
          console.log(`Server: ${h.status} | Concepts: ${h.concepts} | Syncs: ${h.syncs}`);
        } catch (e: unknown) {
          console.log(`Server unreachable: ${e instanceof Error ? e.message : e}`);
        }
        break;
      }

      case 'register': {
        const username = await prompt('Username: ');
        const email = await prompt('Email: ');
        const password = await prompt('Password: ');
        try {
          const res = await api.register(username, email, password);
          api.setToken(res.user.token);
          console.log(`Registered and logged in as ${res.user.username}`);
        } catch (e: unknown) {
          console.log(`Registration failed: ${e instanceof Error ? e.message : e}`);
        }
        break;
      }

      case 'login': {
        const email = await prompt('Email: ');
        const password = await prompt('Password: ');
        try {
          const res = await api.login(email, password);
          api.setToken(res.user.token);
          console.log(`Logged in as ${res.user.username}`);
        } catch (e: unknown) {
          console.log(`Login failed: ${e instanceof Error ? e.message : e}`);
        }
        break;
      }

      case 'post': {
        const title = await prompt('Title: ');
        const description = await prompt('Description: ');
        const body = await prompt('Body: ');
        try {
          const res = await api.createArticle(title, description, body);
          console.log(`Article created: ${res.article.title}`);
        } catch (e: unknown) {
          console.log(`Post failed: ${e instanceof Error ? e.message : e}`);
        }
        break;
      }

      case 'articles': {
        try {
          const res = await api.getArticles();
          if (res.articles.length === 0) {
            console.log('No articles yet.');
          } else {
            for (const a of res.articles) {
              console.log(`  [${a.slug}] ${a.title} — by ${a.author.username}`);
            }
          }
        } catch (e: unknown) {
          console.log(`Failed to fetch: ${e instanceof Error ? e.message : e}`);
        }
        break;
      }

      case 'quit':
      case 'exit':
        running = false;
        break;

      default:
        console.log('Unknown command. Try: login, register, articles, post, health, quit');
    }
  }

  rl.close();
  await terminaladapterHandler.onSuspend({}, storage);
  console.log('Goodbye!');
}

initTerminalPlatform().catch(console.error);
