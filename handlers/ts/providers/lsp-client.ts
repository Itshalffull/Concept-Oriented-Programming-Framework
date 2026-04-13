// Minimal LSP JSON-RPC client for the generic LSP provider.
//
// Spawns and manages a language server process over stdio, sending
// JSON-RPC 2.0 messages framed with the LSP "Content-Length: N\r\n\r\n"
// header convention. Keeps one connection per (command, args, rootUri)
// tuple so repeated format/highlight calls reuse the same initialized
// server.
//
// This file intentionally avoids depending on vscode-jsonrpc or
// vscode-languageserver-protocol at runtime — the wire format is small
// enough that a hand-rolled implementation keeps startup cost down and
// avoids optional-dep footguns during testing. The companion
// lsp.provider.ts file pulls types from vscode-languageserver-protocol
// only at type-checking time when the package is installed.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface LspClientOptions {
  serverCommand: string;
  args?: string[];
  rootUri?: string;
  initOptions?: unknown;
  /** How long to wait for any single RPC response (default 5s). */
  requestTimeoutMs?: number;
  /** How long to wait for `initialize` to return (default 10s). */
  initTimeoutMs?: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * A single live JSON-RPC session with an LSP server. Construct with `start()`;
 * always `dispose()` when done. One client corresponds to one spawned process.
 */
export class LspClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private buffer = Buffer.alloc(0);
  private initialized = false;
  private readonly opts: Required<Omit<LspClientOptions, 'initOptions' | 'rootUri' | 'args'>> &
    Pick<LspClientOptions, 'initOptions' | 'rootUri' | 'args'>;
  private exitError: Error | null = null;

  constructor(opts: LspClientOptions) {
    this.opts = {
      serverCommand: opts.serverCommand,
      args: opts.args,
      rootUri: opts.rootUri,
      initOptions: opts.initOptions,
      requestTimeoutMs: opts.requestTimeoutMs ?? 5000,
      initTimeoutMs: opts.initTimeoutMs ?? 10000,
    };
  }

  /** Spawn the server and send `initialize` + `initialized`. Resolves when ready. */
  async start(): Promise<void> {
    if (this.initialized) return;
    try {
      this.proc = spawn(this.opts.serverCommand, this.opts.args ?? [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      throw new Error(`lsp_unavailable: spawn failed: ${(err as Error).message}`);
    }
    this.proc.on('error', (err) => {
      this.exitError = err;
      this.failAllPending(err);
    });
    this.proc.on('exit', (code) => {
      const err = new Error(`lsp server exited with code ${code}`);
      this.exitError = err;
      this.failAllPending(err);
    });
    this.proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk));
    // Drain stderr; capture first chunks so a helpful message can surface if
    // the process dies during startup.
    this.proc.stderr.on('data', () => { /* ignore */ });

    const initParams = {
      processId: process.pid,
      clientInfo: { name: 'clef-lsp-adapter', version: '0.1.0' },
      rootUri: this.opts.rootUri ?? null,
      capabilities: {
        textDocument: {
          formatting: { dynamicRegistration: false },
          semanticTokens: {
            dynamicRegistration: false,
            requests: { full: true, range: false },
            tokenTypes: [],
            tokenModifiers: [],
            formats: ['relative'],
          },
          synchronization: { dynamicRegistration: false },
        },
      },
      initializationOptions: this.opts.initOptions,
    };
    await this.request('initialize', initParams, this.opts.initTimeoutMs);
    this.notify('initialized', {});
    this.initialized = true;
  }

  /** Send an LSP notification (no response expected). */
  notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  /** Send an LSP request and await its response. */
  async request<T = unknown>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    if (this.exitError) throw this.exitError;
    const id = this.nextId++;
    const tmo = timeoutMs ?? this.opts.requestTimeoutMs;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`lsp_unavailable: request '${method}' timed out after ${tmo}ms`));
      }, tmo);
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timeout,
      });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  /** Tear down the session: send shutdown/exit and kill the process. */
  async dispose(): Promise<void> {
    if (!this.proc) return;
    try {
      if (this.initialized) {
        await this.request('shutdown', null, 2000).catch(() => { /* ignore */ });
        this.notify('exit', null);
      }
    } finally {
      try { this.proc.kill(); } catch { /* ignore */ }
      this.proc = null;
      this.failAllPending(new Error('lsp client disposed'));
      this.initialized = false;
    }
  }

  private send(msg: unknown): void {
    if (!this.proc || !this.proc.stdin.writable) {
      throw new Error('lsp_unavailable: stdin not writable');
    }
    const body = Buffer.from(JSON.stringify(msg), 'utf8');
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii');
    this.proc.stdin.write(Buffer.concat([header, body]));
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    // Parse out as many complete messages as possible.
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = this.buffer.slice(0, headerEnd).toString('ascii');
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        // Malformed header — drop one byte and try again.
        this.buffer = this.buffer.slice(1);
        continue;
      }
      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + len) return;
      const body = this.buffer.slice(bodyStart, bodyStart + len).toString('utf8');
      this.buffer = this.buffer.slice(bodyStart + len);
      try {
        this.dispatch(JSON.parse(body));
      } catch {
        // Swallow parse failures; the server sent malformed JSON.
      }
    }
  }

  private dispatch(msg: any): void {
    if (msg && typeof msg === 'object' && 'id' in msg && ('result' in msg || 'error' in msg)) {
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      clearTimeout(entry.timeout);
      this.pending.delete(msg.id);
      if (msg.error) {
        entry.reject(new Error(`lsp error: ${msg.error.message ?? 'unknown'}`));
      } else {
        entry.resolve(msg.result);
      }
    }
    // Server-initiated requests/notifications are ignored — we are a minimal
    // client that only drives formatting + semantic tokens.
  }

  private failAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timeout);
      entry.reject(err);
      this.pending.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Connection pool keyed by (command, args, rootUri) so multiple format or
// highlight calls against the same server reuse a single initialized process.

function poolKey(opts: LspClientOptions): string {
  return JSON.stringify([opts.serverCommand, opts.args ?? [], opts.rootUri ?? '']);
}

const pool = new Map<string, Promise<LspClient>>();

/** Get or create a pooled LSP client. */
export function getLspClient(opts: LspClientOptions): Promise<LspClient> {
  const key = poolKey(opts);
  let entry = pool.get(key);
  if (!entry) {
    const client = new LspClient(opts);
    entry = client.start().then(() => client).catch((err) => {
      pool.delete(key);
      throw err;
    });
    pool.set(key, entry);
  }
  return entry;
}

/** Dispose all pooled clients. Intended for tests and shutdown. */
export async function disposeAllLspClients(): Promise<void> {
  const entries = [...pool.values()];
  pool.clear();
  await Promise.allSettled(
    entries.map(async (p) => {
      try {
        const c = await p;
        await c.dispose();
      } catch { /* ignore */ }
    }),
  );
}
