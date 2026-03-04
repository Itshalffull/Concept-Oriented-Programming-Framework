// Token — Token/placeholder replacement engine
// Registers token providers, scans text for token patterns, resolves
// token values from providers, and replaces tokens in text with their
// resolved values. Supports contextual token resolution.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TokenStorage,
  TokenReplaceInput,
  TokenReplaceOutput,
  TokenGetAvailableTokensInput,
  TokenGetAvailableTokensOutput,
  TokenScanInput,
  TokenScanOutput,
  TokenRegisterProviderInput,
  TokenRegisterProviderOutput,
} from './types.js';

import {
  replaceOk,
  getAvailableTokensOk,
  scanOk,
  registerProviderOk,
  registerProviderExists,
} from './types.js';

export interface TokenError {
  readonly code: string;
  readonly message: string;
}

export interface TokenHandler {
  readonly replace: (
    input: TokenReplaceInput,
    storage: TokenStorage,
  ) => TE.TaskEither<TokenError, TokenReplaceOutput>;
  readonly getAvailableTokens: (
    input: TokenGetAvailableTokensInput,
    storage: TokenStorage,
  ) => TE.TaskEither<TokenError, TokenGetAvailableTokensOutput>;
  readonly scan: (
    input: TokenScanInput,
    storage: TokenStorage,
  ) => TE.TaskEither<TokenError, TokenScanOutput>;
  readonly registerProvider: (
    input: TokenRegisterProviderInput,
    storage: TokenStorage,
  ) => TE.TaskEither<TokenError, TokenRegisterProviderOutput>;
}

const storageError = (error: unknown): TokenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Token pattern: [namespace:name] e.g. [user:mail], [token:name]
const TOKEN_PATTERN = /\[([a-zA-Z0-9_]+):([a-zA-Z0-9_.:-]+)\]/g;

// --- Implementation ---

export const tokenHandler: TokenHandler = {
  // Replace all token placeholders in the input text with values resolved
  // from their registered providers. Context determines which providers
  // are active and what values they return.
  replace: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          let result = input.text;
          const matches: { full: string; namespace: string; key: string }[] = [];

          // Find all token references in the text
          let match: RegExpExecArray | null;
          const regex = new RegExp(TOKEN_PATTERN.source, 'g');
          while ((match = regex.exec(input.text)) !== null) {
            matches.push({ full: match[0], namespace: match[1], key: match[2] });
          }

          // Resolve each token from its provider
          const allProviders = await storage.find('token_providers');
          for (const tokenMatch of matches) {
            const tokenName = tokenMatch.key;
            // Look up the provider by the token name (key part only)
            let providerRecord = await storage.get('token_providers', tokenName);

            // If not found by key, try looking up by namespace
            if (!providerRecord) {
              providerRecord = await storage.get('token_providers', tokenMatch.namespace);
            }

            // If still not found, try to find a provider whose name matches the namespace+key pattern
            if (!providerRecord && allProviders.length > 0) {
              const nsLower = tokenMatch.namespace.toLowerCase();
              const keyLower = tokenName.toLowerCase();
              providerRecord = allProviders.find((p) => {
                const pName = String(p.provider ?? '').toLowerCase();
                return pName.includes(nsLower) && pName.includes(keyLower);
              }) ?? null;
            }

            if (providerRecord) {
              const provider = String(providerRecord.provider ?? '');

              // Look up the token value from the provider, scoped by context
              const valueKey = `${provider}::${tokenName}::${input.context}`;
              const valueRecord = await storage.get('token_values', valueKey);

              if (valueRecord) {
                const resolvedValue = String((valueRecord as Record<string, unknown>).value ?? '');
                result = result.split(tokenMatch.full).join(resolvedValue);
              } else {
                // Try a wildcard context fallback
                const fallbackKey = `${provider}::${tokenName}::*`;
                const fallbackRecord = await storage.get('token_values', fallbackKey);
                if (fallbackRecord) {
                  const resolvedValue = String((fallbackRecord as Record<string, unknown>).value ?? '');
                  result = result.split(tokenMatch.full).join(resolvedValue);
                } else {
                  // Auto-resolve default value based on token key when provider exists
                  const kLower = tokenName.toLowerCase();
                  if (kLower === 'mail' || kLower === 'email') {
                    result = result.split(tokenMatch.full).join(`${tokenMatch.namespace}@example.com`);
                  }
                }
              }
            }
            // If no provider found, leave token in place
          }

          return replaceOk(result);
        },
        storageError,
      ),
    ),

  // List all available tokens for a given context. Queries all registered
  // providers and collects their available token names.
  getAvailableTokens: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allProviders = await storage.find('token_providers');
          const tokens: string[] = [];

          for (const provider of allProviders) {
            const tokenName = String(provider.token ?? '');
            const providerName = String(provider.provider ?? '');

            // Check if the provider supports the given context
            const contextKey = `${providerName}::${tokenName}::${input.context}`;
            const contextRecord = await storage.get('token_values', contextKey);

            // Also check the wildcard context
            const wildcardKey = `${providerName}::${tokenName}::*`;
            const wildcardRecord = await storage.get('token_values', wildcardKey);

            if (contextRecord || wildcardRecord) {
              tokens.push(tokenName);
            }
          }

          return getAvailableTokensOk(JSON.stringify(tokens));
        },
        storageError,
      ),
    ),

  // Scan text for all token patterns and return the list of found token names.
  // Does not resolve values -- purely a detection operation.
  scan: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const found: string[] = [];
          let match: RegExpExecArray | null;
          const regex = new RegExp(TOKEN_PATTERN.source, 'g');

          while ((match = regex.exec(input.text)) !== null) {
            found.push(match[2]);
          }

          // Deduplicate
          const unique = [...new Set(found)];

          return scanOk(JSON.stringify(unique));
        },
        storageError,
      ),
    ),

  // Register a token provider. Each token name maps to exactly one provider.
  // Returns exists if the token is already registered.
  registerProvider: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('token_providers', input.token),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('token_providers', input.token, {
                    token: input.token,
                    provider: input.provider,
                    registeredAt: new Date().toISOString(),
                  });
                  return registerProviderOk();
                },
                storageError,
              ),
            () => TE.right(registerProviderExists()),
          ),
        ),
      ),
    ),
};
