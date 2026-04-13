// Tree-sitter Parse provider — a generic adapter that turns any
// web-tree-sitter WASM grammar into a Parse provider id "tree-sitter".
//
// Unlike per-language providers (katex-parse, micromark-parse, ...),
// this provider is grammar-agnostic: callers select the grammar by
// passing a JSON config blob with `{ grammar: "<path-to-wasm>",
// packageName?: "<npm package name>" }`. The provider loads the
// grammar lazily, caches a web-tree-sitter Parser instance per
// grammar path, parses the text, and returns a JSON-encoded AST.
//
// Registration: self-registers in the shared parse-provider-registry
// under the id "tree-sitter". The Parse concept handler dispatches
// here whenever a language is registered with provider "tree-sitter".
//
// Output envelope:
//   Success: { ok: true, language: "<lang>", grammar: "<wasm-path>",
//              tree: { type, text, startIndex, endIndex, children: [...] } }
//   Error:   { ok: false, language: "<lang>", error: { message } }
// Providers MUST NOT throw — all failures are encoded in the envelope.

import {
  registerParseProvider,
  type ParseProviderFn,
} from './parse-provider-registry.ts';

export const PARSE_PROVIDER_ID = 'tree-sitter';

type WebTreeSitter = {
  default?: unknown;
} & Record<string, unknown>;

type ParserCtor = {
  new (): ParserInstance;
  init(options?: object): Promise<void>;
  Language: { load(input: string | Uint8Array): Promise<unknown> };
};

type ParserInstance = {
  setLanguage(language: unknown): void;
  parse(input: string): { rootNode: SyntaxNodeLike };
};

type SyntaxNodeLike = {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  children: SyntaxNodeLike[];
};

type ParseConfig = {
  grammar?: string;
  packageName?: string;
  namedOnly?: boolean;
  maxDepth?: number;
};

function decodeConfig(config?: string): ParseConfig {
  if (!config) return {};
  try {
    const trimmed = config.trim();
    if (trimmed.startsWith('{')) return JSON.parse(trimmed) as ParseConfig;
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    return JSON.parse(decoded) as ParseConfig;
  } catch {
    return {};
  }
}

// Cache web-tree-sitter module import + Parser.init() so we only
// initialize the emscripten runtime once.
let parserModulePromise: Promise<ParserCtor> | null = null;
function loadParserModule(): Promise<ParserCtor> {
  if (!parserModulePromise) {
    parserModulePromise = (async () => {
      const mod = (await import('web-tree-sitter')) as WebTreeSitter;
      const Ctor = ((mod as { default?: unknown }).default ??
        mod) as unknown as ParserCtor;
      await Ctor.init();
      return Ctor;
    })().catch((err) => {
      parserModulePromise = null;
      throw err;
    });
  }
  return parserModulePromise;
}

// Cache one Parser instance per grammar path. Parsers are not
// thread-safe, but in a single-threaded JS runtime this is fine
// and avoids repeated WASM grammar loads.
const parserCache = new Map<string, Promise<ParserInstance>>();

async function getParser(grammarPath: string): Promise<ParserInstance> {
  let cached = parserCache.get(grammarPath);
  if (!cached) {
    cached = (async () => {
      const Ctor = await loadParserModule();
      const language = await Ctor.Language.load(grammarPath);
      const parser = new Ctor();
      parser.setLanguage(language);
      return parser;
    })();
    // If load fails, evict so a retry can recover.
    cached.catch(() => parserCache.delete(grammarPath));
    parserCache.set(grammarPath, cached);
  }
  return cached;
}

function walkNode(
  node: SyntaxNodeLike,
  namedOnly: boolean,
  maxDepth: number,
  depth = 0,
): {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  children: unknown[];
} {
  const children =
    depth >= maxDepth
      ? []
      : (namedOnly
          ? node.children.filter((c) => {
              // web-tree-sitter exposes `isNamed` on SyntaxNode; fall
              // back to "all children" when the flag is not present.
              const named = (c as unknown as { isNamed?: boolean }).isNamed;
              return named !== false;
            })
          : node.children
        ).map((c) => walkNode(c, namedOnly, maxDepth, depth + 1));
  return {
    type: node.type,
    text: node.text,
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    children,
  };
}

/**
 * Parse `text` with a web-tree-sitter grammar selected by `config`.
 * `language` is carried through into the envelope for tracing but is
 * not used for grammar selection — `config.grammar` (a wasm path) is
 * authoritative.
 */
export async function parseWithTreeSitter(
  text: string,
  language: string,
  config?: string,
): Promise<string> {
  const opts = decodeConfig(config);
  const grammar = opts.grammar;
  if (!grammar) {
    return JSON.stringify({
      ok: false,
      language,
      error: {
        message:
          'tree-sitter provider requires options.grammar (path to .wasm file)',
      },
    });
  }
  try {
    const parser = await getParser(grammar);
    const tree = parser.parse(text);
    const root = walkNode(
      tree.rootNode,
      opts.namedOnly !== false,
      typeof opts.maxDepth === 'number' ? opts.maxDepth : 64,
    );
    return JSON.stringify({
      ok: true,
      language,
      grammar,
      packageName: opts.packageName,
      tree: root,
    });
  } catch (err) {
    const message =
      (err as Error)?.message ??
      (typeof err === 'string' ? err : 'unknown tree-sitter parse error');
    return JSON.stringify({
      ok: false,
      language,
      grammar,
      error: { message },
    });
  }
}

// Sync adapter for ParseProviderFn. Because grammar load is async,
// the first call for a given grammar returns a "warming" envelope
// and kicks off the load; subsequent calls (after warm-up) parse
// synchronously against the cached parser. Callers that need a
// guaranteed AST on first call should use `parseWithTreeSitter`
// (async) directly.
const warmParsers = new Map<string, ParserInstance>();
const warmingParsers = new Set<string>();

const parseWithTreeSitterSync: ParseProviderFn = (text, config) => {
  const opts = decodeConfig(config);
  const grammar = opts.grammar;
  if (!grammar) {
    return JSON.stringify({
      ok: false,
      language: 'unknown',
      error: {
        message:
          'tree-sitter provider requires options.grammar (path to .wasm file)',
      },
    });
  }
  const warm = warmParsers.get(grammar);
  if (!warm) {
    if (!warmingParsers.has(grammar)) {
      warmingParsers.add(grammar);
      void getParser(grammar)
        .then((p) => {
          warmParsers.set(grammar, p);
        })
        .catch(() => {
          /* leave unwarmed; structured error envelope on next call */
        })
        .finally(() => {
          warmingParsers.delete(grammar);
        });
    }
    return JSON.stringify({
      ok: false,
      language: 'unknown',
      grammar,
      error: {
        message:
          'tree-sitter grammar not yet loaded — call parseWithTreeSitter (async) to warm, then retry',
      },
    });
  }
  try {
    const tree = warm.parse(text);
    const root = walkNode(
      tree.rootNode,
      opts.namedOnly !== false,
      typeof opts.maxDepth === 'number' ? opts.maxDepth : 64,
    );
    return JSON.stringify({
      ok: true,
      language: 'unknown',
      grammar,
      packageName: opts.packageName,
      tree: root,
    });
  } catch (err) {
    const message =
      (err as Error)?.message ??
      (typeof err === 'string' ? err : 'unknown tree-sitter parse error');
    return JSON.stringify({
      ok: false,
      language: 'unknown',
      grammar,
      error: { message },
    });
  }
};

registerParseProvider(PARSE_PROVIDER_ID, parseWithTreeSitterSync);

export { parseWithTreeSitterSync };
