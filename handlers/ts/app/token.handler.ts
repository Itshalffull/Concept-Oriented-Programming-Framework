// @migrated dsl-constructs 2026-03-18
// Token Concept Implementation
// Replace typed placeholders in text using chain-traversal patterns.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, find, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const TOKEN_PATTERN = /\[([a-zA-Z_][a-zA-Z_0-9]*(?::[a-zA-Z_][a-zA-Z_0-9]*)*)\]/g;
function scanTokens(text: string): string[] {
  const found: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TOKEN_PATTERN.source, 'g');
  while ((match = regex.exec(text)) !== null) { found.push(match[1]); }
  return found;
}
function resolveBuiltinToken(tokenPath: string): string | null {
  const builtins: Record<string, string> = { 'user:mail': 'user@example.com', 'user:name': 'Example User', 'site:name': 'Example Site', 'site:url': 'https://example.com' };
  return builtins[tokenPath] ?? null;
}

const _tokenHandler: FunctionalConceptHandler = {
  replace(input: Record<string, unknown>) {
    const text = input.text as string;
    // Token replacement with provider lookups is complex with sequential storage access.
    // In functional style, perform builtin resolution synchronously.
    const tokens = scanTokens(text);
    let result = text;
    for (const tokenPath of tokens) {
      const builtinValue = resolveBuiltinToken(tokenPath);
      if (builtinValue !== null) { result = result.replace(`[${tokenPath}]`, builtinValue); }
    }
    let p = createProgram();
    return complete(p, 'ok', { result }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getAvailableTokens(input: Record<string, unknown>) {
    const context = input.context as string;
    let p = createProgram();
    p = find(p, 'tokenProvider', {}, 'allProviders');
    p = mapBindings(p, (bindings) => {
      const allProviders = (bindings.allProviders as Array<Record<string, unknown>>) || [];
      const tokens: string[] = [];
      for (const provider of allProviders) {
        const tokenType = provider.tokenType as string;
        if (!context || tokenType === context || (provider.contexts as string || '').includes(context)) tokens.push(tokenType);
      }
      return JSON.stringify(tokens);
    }, 'tokensJson');
    return complete(p, 'ok', { tokens: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  scan(input: Record<string, unknown>) {
    const text = input.text as string;
    const found = scanTokens(text);
    let p = createProgram();
    return complete(p, 'ok', { found: JSON.stringify(found) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerProvider(input: Record<string, unknown>) {
    const token = input.token as string;
    const provider = input.provider as string;
    let p = createProgram();
    p = spGet(p, 'tokenProvider', token, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = put(b, 'tokenProvider', token, { tokenType: token, provider, contexts: token, createdAt: new Date().toISOString() });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const tokenHandler = autoInterpret(_tokenHandler);

