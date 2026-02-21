// Token Concept Implementation
// Replace typed placeholders in text using chain-traversal patterns
// like [node:author:mail] for dynamic content substitution.
import type { ConceptHandler } from '@copf/kernel';

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

      // Look up the provider for this token type
      const provider = await storage.get('tokenProvider', tokenType);

      if (provider) {
        // Resolve the token value through the chain-traversal path.
        // In a real system, the provider implementation would resolve
        // the full chain (e.g., user:mail -> look up user, get mail).
        // Here we simulate resolution from stored provider data.
        const providerData = provider.provider as string;
        const resolvedKey = `${tokenType}:${parts.slice(1).join(':')}`;

        // Check for a stored resolution value
        const resolution = await storage.get('tokenValue', resolvedKey);
        const value = resolution
          ? resolution.value as string
          : `${providerData}:${parts.slice(1).join(':')}`;

        result = result.replace(`[${tokenPath}]`, value);
      }
      // Unrecognized tokens are left in place
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
