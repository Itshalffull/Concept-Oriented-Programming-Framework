// Conduit Example App — IPFS Article Storage
// Store article content on IPFS using the Web3 kit's Content concept
// and content-pinning sync.

import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import { contentHandler } from '../../../kits/web3/implementations/typescript/content.impl.js';
import type { ConceptStorage } from '../../../kernel/src/types.js';

export interface IPFSArticle {
  cid: string;
  title: string;
  body: string;
  pinned: boolean;
}

/**
 * Store an article body on IPFS and return the content identifier (CID).
 */
export async function storeArticleOnIPFS(
  title: string,
  body: string,
  description: string,
): Promise<{ variant: string; cid?: string; message?: string }> {
  const storage = createInMemoryStorage();

  const content = JSON.stringify({ title, body, description, version: 1 });

  const result = await contentHandler.pin(
    { content, contentType: 'application/json', name: title },
    storage,
  );

  if (result.variant !== 'ok') {
    return { variant: 'error', message: 'Failed to pin content to IPFS' };
  }

  return {
    variant: 'ok',
    cid: result.cid as string,
  };
}

/**
 * Retrieve an article from IPFS by its CID.
 */
export async function getArticleFromIPFS(
  cid: string,
): Promise<{ variant: string; article?: { title: string; body: string; description: string }; message?: string }> {
  const storage = createInMemoryStorage();

  const result = await contentHandler.get(
    { cid },
    storage,
  );

  if (result.variant !== 'ok') {
    return { variant: 'error', message: 'Failed to retrieve content from IPFS' };
  }

  try {
    const article = JSON.parse(result.content as string);
    return { variant: 'ok', article };
  } catch {
    return { variant: 'error', message: 'Invalid article content format' };
  }
}

/**
 * Unpin an article from IPFS (for deletion).
 */
export async function unpinArticle(cid: string): Promise<{ variant: string }> {
  const storage = createInMemoryStorage();

  const result = await contentHandler.unpin({ cid }, storage);
  return { variant: result.variant as string };
}
