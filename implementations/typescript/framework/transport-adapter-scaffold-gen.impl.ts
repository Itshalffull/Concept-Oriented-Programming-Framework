// ============================================================
// TransportAdapterScaffoldGen — Transport adapter scaffold generator
//
// Generates ConceptTransport adapter implementations for various
// communication protocols: HTTP, WebSocket, Worker, SQS, etc.
//
// See architecture doc:
//   - Section 9: Transport adapters
//   - Section 9.2: ConceptTransport interface
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function buildTransportAdapter(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MyTransport';
  const protocol = (input.protocol as string) || 'http';
  const baseUrl = (input.baseUrl as string) || 'http://localhost:3000';

  const lines: string[] = [
    '// ============================================================',
    `// ${name} — ${protocol} transport adapter`,
    '//',
    `// ConceptTransport implementation over ${protocol}.`,
    '// ============================================================',
    '',
  ];

  switch (protocol) {
    case 'http':
      lines.push(...[
        `export class ${name} {`,
        '  private baseUrl: string;',
        '',
        `  constructor(baseUrl: string = '${baseUrl}') {`,
        '    this.baseUrl = baseUrl;',
        '  }',
        '',
        '  async invoke(concept: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {',
        '    const url = `${this.baseUrl}/concepts/${concept}/${action}`;',
        '    const response = await fetch(url, {',
        "      method: 'POST',",
        "      headers: { 'Content-Type': 'application/json' },",
        '      body: JSON.stringify(input),',
        '    });',
        '    if (!response.ok) {',
        "      return { variant: 'error', message: `HTTP ${response.status}: ${response.statusText}` };",
        '    }',
        '    return response.json();',
        '  }',
        '',
        '  async query(concept: string, relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        '    const params = criteria ? `?${new URLSearchParams(criteria as Record<string, string>)}` : \'\';',
        '    const url = `${this.baseUrl}/concepts/${concept}/${relation}${params}`;',
        '    const response = await fetch(url);',
        '    if (!response.ok) return [];',
        '    return response.json();',
        '  }',
        '',
        '  async health(): Promise<{ ok: boolean; latencyMs: number }> {',
        '    const start = Date.now();',
        '    try {',
        '      const response = await fetch(`${this.baseUrl}/health`);',
        '      return { ok: response.ok, latencyMs: Date.now() - start };',
        '    } catch {',
        '      return { ok: false, latencyMs: Date.now() - start };',
        '    }',
        '  }',
        '}',
      ]);
      break;

    case 'websocket':
      lines.push(...[
        `export class ${name} {`,
        '  private ws: WebSocket | null = null;',
        '  private pending: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();',
        '  private counter = 0;',
        '',
        `  constructor(private url: string = '${baseUrl.replace('http', 'ws')}') {}`,
        '',
        '  async connect(): Promise<void> {',
        '    return new Promise((resolve, reject) => {',
        '      this.ws = new WebSocket(this.url);',
        '      this.ws.onopen = () => resolve();',
        '      this.ws.onerror = (e) => reject(new Error(String(e)));',
        "      this.ws.onmessage = (e) => {",
        '        const msg = JSON.parse(e.data as string);',
        '        const handler = this.pending.get(msg.id);',
        '        if (handler) {',
        '          this.pending.delete(msg.id);',
        '          handler.resolve(msg.result);',
        '        }',
        '      };',
        '    });',
        '  }',
        '',
        '  async invoke(concept: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {',
        "    if (!this.ws) throw new Error('Not connected');",
        '    const id = String(++this.counter);',
        '    return new Promise((resolve, reject) => {',
        '      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });',
        '      this.ws!.send(JSON.stringify({ id, concept, action, input }));',
        '    });',
        '  }',
        '',
        '  async query(concept: string, relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        "    const result = await this.invoke(concept, '__query', { relation, criteria });",
        '    return (result as { items?: Record<string, unknown>[] }).items ?? [];',
        '  }',
        '',
        '  async health(): Promise<{ ok: boolean; latencyMs: number }> {',
        '    const start = Date.now();',
        '    try {',
        "      await this.invoke('__system', 'ping', {});",
        '      return { ok: true, latencyMs: Date.now() - start };',
        '    } catch {',
        '      return { ok: false, latencyMs: Date.now() - start };',
        '    }',
        '  }',
        '',
        '  disconnect(): void {',
        '    this.ws?.close();',
        '    this.ws = null;',
        '  }',
        '}',
      ]);
      break;

    case 'worker':
      lines.push(...[
        '/// <reference lib="webworker" />',
        '',
        `export class ${name} {`,
        '  private worker: Worker;',
        '  private pending: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();',
        '  private counter = 0;',
        '',
        '  constructor(workerUrl: string | URL) {',
        '    this.worker = new Worker(workerUrl);',
        '    this.worker.onmessage = (e) => {',
        '      const { id, result, error } = e.data;',
        '      const handler = this.pending.get(id);',
        '      if (handler) {',
        '        this.pending.delete(id);',
        '        if (error) handler.reject(new Error(error));',
        '        else handler.resolve(result);',
        '      }',
        '    };',
        '  }',
        '',
        '  async invoke(concept: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {',
        '    const id = String(++this.counter);',
        '    return new Promise((resolve, reject) => {',
        '      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });',
        '      this.worker.postMessage({ id, concept, action, input });',
        '    });',
        '  }',
        '',
        '  async query(concept: string, relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        "    const result = await this.invoke(concept, '__query', { relation, criteria });",
        '    return (result as { items?: Record<string, unknown>[] }).items ?? [];',
        '  }',
        '',
        '  async health(): Promise<{ ok: boolean; latencyMs: number }> {',
        '    const start = Date.now();',
        '    try {',
        "      await this.invoke('__system', 'ping', {});",
        '      return { ok: true, latencyMs: Date.now() - start };',
        '    } catch {',
        '      return { ok: false, latencyMs: Date.now() - start };',
        '    }',
        '  }',
        '',
        '  terminate(): void {',
        '    this.worker.terminate();',
        '  }',
        '}',
      ]);
      break;

    case 'in-process':
      lines.push(...[
        "import type { ConceptHandler } from '../../../kernel/src/types.js';",
        '',
        `export class ${name} {`,
        '  private handlers: Map<string, ConceptHandler> = new Map();',
        '',
        '  registerHandler(concept: string, handler: ConceptHandler): void {',
        '    this.handlers.set(concept, handler);',
        '  }',
        '',
        '  async invoke(concept: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {',
        '    const handler = this.handlers.get(concept);',
        "    if (!handler) return { variant: 'error', message: `Unknown concept: ${concept}` };",
        '    const actionFn = handler[action];',
        "    if (!actionFn) return { variant: 'error', message: `Unknown action: ${concept}/${action}` };",
        '    return actionFn(input, null as never);',
        '  }',
        '',
        '  async query(_concept: string, _relation: string, _criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        '    return [];',
        '  }',
        '',
        '  async health(): Promise<{ ok: boolean; latencyMs: number }> {',
        '    return { ok: true, latencyMs: 0 };',
        '  }',
        '}',
      ]);
      break;

    default:
      lines.push(...[
        `export class ${name} {`,
        `  // TODO: Implement ${protocol} transport adapter`,
        '',
        '  async invoke(concept: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {',
        `    throw new Error('${protocol} transport not implemented');`,
        '  }',
        '',
        '  async query(concept: string, relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        `    throw new Error('${protocol} transport not implemented');`,
        '  }',
        '',
        '  async health(): Promise<{ ok: boolean; latencyMs: number }> {',
        '    return { ok: false, latencyMs: 0 };',
        '  }',
        '}',
      ]);
  }

  lines.push('');
  return lines.join('\n');
}

export const transportAdapterScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'TransportAdapterScaffoldGen',
      inputKind: 'TransportConfig',
      outputKind: 'TransportAdapter',
      capabilities: JSON.stringify(['http', 'websocket', 'worker', 'in-process']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'MyTransport';
    const protocol = (input.protocol as string) || 'http';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Adapter name is required' };
    }

    try {
      const kebab = toKebab(name);
      const adapterCode = buildTransportAdapter(input);

      const files: { path: string; content: string }[] = [
        { path: `${kebab}-transport.ts`, content: adapterCode },
      ];

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await transportAdapterScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = result.files as Array<{ path: string; content: string }>;
    return {
      variant: 'ok',
      files,
      wouldWrite: files.length,
      wouldSkip: 0,
    };
  },
};
