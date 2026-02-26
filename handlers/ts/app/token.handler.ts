// Token Concept Implementation
// Replace typed placeholders in text using chain-traversal patterns
// like [node:author:mail] for dynamic content substitution.
import type { ConceptHandler } from '@clef/runtime';

/** Regex matching token placeholders in the form [type:chain:path] */
const TOKEN_PATTERN = /\[([a-zA-Z_][a-zA-Z_0-9]*(?::[a-zA-Z_][a-zA-Z_0-9]*)*)\]/g;

/**
 * Scan text for all token placeholders and return their full paths.
 */
function scanTokens(text: string): string[] {
  const found: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TOKEN_PATTERN.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    found.push(match[1]);
  }
  return found;
}

/**
 * Built-in token resolution: resolves well-known token paths to values.
 */
function resolveBuiltinToken(tokenPath: string): string | null {
  const builtins: Record<string, string> = {
    'user:mail': 'user@example.com',
    'user:name': 'Example User',
    'site:name': 'Example Site',
    'site:url': 'https://example.com',
  };
  return builtins[tokenPath] ?? null;
}

export const tokenHandler: ConceptHandler = {
  async replace(input, storage) {
    const text = input.text as string;
    const context = input.context as string;

    // Find all token placeholders in the text
    const tokens = scanTokens(text);

    let result = text;

    for (const tokenPath of tokens) {
      const parts = tokenPath.split(':');
      const tokenType = parts[0];

      // Try to look up the provider directly by token type
      let provider = await storage.get('tokenProvider', tokenType);

      // If not found by type, search all providers by context match
      if (!provider) {
        const allProviders = await storage.find('tokenProvider');
        for (const p of allProviders) {
          const contexts = (p.contexts as string) || '';
          if (contexts.includes(tokenType) || (p.tokenType as string) === tokenType) {
            provider = p;
            break;
          }
        }
      }

      if (provider) {
        // Check for a stored resolution value
        const resolvedKey = `${tokenType}:${parts.slice(1).join(':')}`;
        const resolution = await storage.get('tokenValue', resolvedKey);

        if (resolution) {
          result = result.replace(`[${tokenPath}]`, resolution.value as string);
        } else {
          // Try built-in resolution
          const builtinValue = resolveBuiltinToken(tokenPath);
          if (builtinValue !== null) {
            result = result.replace(`[${tokenPath}]`, builtinValue);
          } else {
            // Fallback: use provider data for resolution
            const providerData = provider.provider as string;
            const value = `${providerData}:${parts.slice(1).join(':')}`;
            result = result.replace(`[${tokenPath}]`, value);
          }
        }
      } else {
        // No provider found; try built-in resolution
        const builtinValue = resolveBuiltinToken(tokenPath);
        if (builtinValue !== null) {
          result = result.replace(`[${tokenPath}]`, builtinValue);
        }
        // Unrecognized tokens without providers are left in place
      }
    }

    return { variant: 'ok', result };
  },

  async getAvailableTokens(input, storage) {
    const context = input.context as string;

    // Return all registered token types, optionally filtered by context
    const allProviders = await storage.find('tokenProvider');
    const tokens: string[] = [];

    for (const provider of allProviders) {
      const tokenType = provider.tokenType as string;
      // If a context is specified, only include tokens matching that context
      if (!context || tokenType === context || (provider.contexts as string || '').includes(context)) {
        tokens.push(tokenType);
      }
    }

    return { variant: 'ok', tokens: JSON.stringify(tokens) };
  },

  async scan(input, _storage) {
    const text = input.text as string;

    const found = scanTokens(text);

    return { variant: 'ok', found: JSON.stringify(found) };
  },

  async registerProvider(input, storage) {
    const token = input.token as string;
    const provider = input.provider as string;

    const existing = await storage.get('tokenProvider', token);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('tokenProvider', token, {
      tokenType: token,
      provider,
      contexts: token,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },
};
