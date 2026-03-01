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

// Token pattern: [token:name] or [token:namespace.name]
const TOKEN_PATTERN = /\[token:([a-zA-Z0-9_.:-]+)\]/g;

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
          const matches: string[] = [];

          // Find all token references in the text
          let match: RegExpExecArray | null;
          const regex = new RegExp(TOKEN_PATTERN.source, 'g');
          while ((match = regex.exec(input.text)) !== null) {
            matches.push(match[1]);
          }

          // Resolve each token from its provider
          for (const tokenName of matches) {
            // Look up the provider for this token
            const providerRecord = await storage.get('token_providers', tokenName);

            if (providerRecord) {
              const providerData = providerRecord as Record<string, unknown>;
              const provider = String(providerData.provider ?? '');

              // Look up the token value from the provider, scoped by context
              const valueKey = `${provider}::${tokenName}::${input.context}`;
              const valueRecord = await storage.get('token_values', valueKey);

              if (valueRecord) {
                const resolvedValue = String((valueRecord as Record<string, unknown>).value ?? '');
                result = result.split(`[token:${tokenName}]`).join(resolvedValue);
              } else {
                // Try a context-free fallback
                const fallbackKey = `${provider}::${tokenName}::*`;
                const fallbackRecord = await storage.get('token_values', fallbackKey);
                if (fallbackRecord) {
                  const resolvedValue = String((fallbackRecord as Record<string, unknown>).value ?? '');
                  result = result.split(`[token:${tokenName}]`).join(resolvedValue);
                }
                // If no value found, leave the token marker in place
              }
            }
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
            found.push(match[1]);
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
