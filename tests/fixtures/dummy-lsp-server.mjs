#!/usr/bin/env node
// Dummy LSP server for smoke-testing the generic LSP provider.
//
// Reads JSON-RPC messages framed with Content-Length headers from stdin,
// and responds to:
//   - initialize              -> capabilities advertising formatting + semantic tokens
//   - initialized             -> (no-op notification)
//   - textDocument/didOpen    -> (no-op notification)
//   - textDocument/didClose   -> (no-op notification)
//   - textDocument/formatting -> a single TextEdit that replaces line 0 with "FORMATTED"
//   - textDocument/semanticTokens/full -> a fixed 2-token response
//   - shutdown                -> null
//   - exit                    -> process.exit(0)

let buffer = Buffer.alloc(0);

function send(msg) {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii');
  process.stdout.write(Buffer.concat([header, body]));
}

function handle(msg) {
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        capabilities: {
          documentFormattingProvider: true,
          semanticTokensProvider: {
            legend: {
              tokenTypes: ['keyword', 'variable'],
              tokenModifiers: [],
            },
            full: true,
          },
        },
      },
    });
    return;
  }
  if (msg.method === 'textDocument/formatting') {
    // Replace line 0, chars 0..3 with "FORMATTED"
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 3 },
          },
          newText: 'FORMATTED',
        },
      ],
    });
    return;
  }
  if (msg.method === 'textDocument/semanticTokens/full') {
    // Two tokens: (line 0, char 0, len 3, type 0 keyword) + (line 0, char 4, len 3, type 1 variable)
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: { data: [0, 0, 3, 0, 0, 0, 4, 3, 1, 0] },
    });
    return;
  }
  if (msg.method === 'shutdown') {
    send({ jsonrpc: '2.0', id: msg.id, result: null });
    return;
  }
  if (msg.method === 'exit') {
    process.exit(0);
  }
  // Unknown request: reply with method-not-found if it has an id.
  if (msg.id !== undefined) {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: 'method not found' },
    });
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;
    const header = buffer.slice(0, headerEnd).toString('ascii');
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) {
      buffer = buffer.slice(1);
      continue;
    }
    const len = Number(m[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) return;
    const body = buffer.slice(bodyStart, bodyStart + len).toString('utf8');
    buffer = buffer.slice(bodyStart + len);
    try {
      handle(JSON.parse(body));
    } catch {
      /* ignore malformed */
    }
  }
});

process.stdin.on('end', () => process.exit(0));
