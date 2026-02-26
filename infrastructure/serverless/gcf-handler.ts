// ============================================================
// Google Cloud Function Concept Handler Scaffold
//
// Wraps a Clef concept handler as a Google Cloud Function.
// Receives ActionInvocations via HTTP or Pub/Sub trigger,
// executes the concept handler, and returns ActionCompletions.
//
// The handler initializes storage outside the handler function
// to reuse connections across warm invocations.
//
// Supports two modes:
//   1. HTTP: concept receives invocations from an always-on
//      engine (Cloud Run) via HTTP POST
//   2. Pub/Sub: concept receives invocations from a subscription,
//      sends completions to the engine's completion topic
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ActionInvocation,
  ActionCompletion,
} from '../../kernel/src/types.js';
import { timestamp } from '../../kernel/src/types.js';

// --- GCF Event Types ---

export interface GCFHttpRequest {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface GCFHttpResponse {
  status(code: number): GCFHttpResponse;
  json(data: unknown): void;
  send(body: string): void;
  set(header: string, value: string): GCFHttpResponse;
}

export interface PubSubMessage {
  data: string;  // Base64-encoded
  attributes?: Record<string, string>;
  messageId: string;
  publishTime: string;
}

export interface PubSubContext {
  eventId: string;
  timestamp: string;
  eventType: string;
  resource: { service: string; name: string };
}

// --- Completion Publisher ---

export interface GCFCompletionPublisher {
  publish(completion: ActionCompletion): Promise<void>;
}

// --- GCF Handler Config ---

export interface GCFHandlerConfig {
  /** The concept name this function serves */
  conceptName: string;
  /** The concept handler */
  handler: ConceptHandler;
  /** Storage adapter (initialized outside handler for reuse) */
  storage: ConceptStorage;
  /** For Pub/Sub mode: publisher to send completions to engine topic */
  completionPublisher?: GCFCompletionPublisher;
}

// --- HTTP Handler ---

/**
 * Create an HTTP Cloud Function handler for a Clef concept.
 *
 * Routes (by path suffix):
 *   POST /invoke  — receive an ActionInvocation, return ActionCompletion
 *   POST /query   — receive a query, return results
 *   GET  /health  — health check
 */
export function createHttpGCFHandler(config: GCFHandlerConfig) {
  return async (req: GCFHttpRequest, res: GCFHttpResponse): Promise<void> => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
      // Health check
      if (req.method === 'GET' && req.path.endsWith('/health')) {
        res.status(200).json({ available: true, concept: config.conceptName });
        return;
      }

      // Invoke
      if (req.method === 'POST' && req.path.endsWith('/invoke')) {
        const invocation = req.body as ActionInvocation;

        if (!invocation || !invocation.action) {
          res.status(400).json({ error: 'Missing or invalid invocation' });
          return;
        }

        const actionFn = config.handler[invocation.action];

        if (!actionFn) {
          const completion: ActionCompletion = {
            id: invocation.id,
            concept: invocation.concept,
            action: invocation.action,
            input: invocation.input,
            variant: 'error',
            output: { message: `Unknown action: ${invocation.action}` },
            flow: invocation.flow,
            timestamp: timestamp(),
          };
          res.status(200).json(completion);
          return;
        }

        const result = await actionFn(invocation.input, config.storage);
        const { variant, ...output } = result;

        const completion: ActionCompletion = {
          id: invocation.id,
          concept: invocation.concept,
          action: invocation.action,
          input: invocation.input,
          variant,
          output,
          flow: invocation.flow,
          timestamp: timestamp(),
        };

        res.status(200).json(completion);
        return;
      }

      // Query
      if (req.method === 'POST' && req.path.endsWith('/query')) {
        const { relation, args } = req.body as { relation: string; args?: Record<string, unknown> };
        const results = await config.storage.find(relation, args);
        res.status(200).json(results);
        return;
      }

      res.status(404).json({ error: 'Not found' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  };
}

// --- Pub/Sub Handler (Event-Driven) ---

/**
 * Create a Pub/Sub Cloud Function handler for a Clef concept.
 *
 * Processes invocations from a Pub/Sub subscription and publishes
 * completions to the engine's completion topic.
 */
export function createPubSubGCFHandler(config: GCFHandlerConfig) {
  if (!config.completionPublisher) {
    throw new Error('Pub/Sub handler requires a completionPublisher');
  }

  const publisher = config.completionPublisher;

  return async (message: PubSubMessage, _context: PubSubContext): Promise<void> => {
    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    const invocation: ActionInvocation = JSON.parse(decoded);
    const actionFn = config.handler[invocation.action];

    let completion: ActionCompletion;

    if (!actionFn) {
      completion = {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant: 'error',
        output: { message: `Unknown action: ${invocation.action}` },
        flow: invocation.flow,
        timestamp: timestamp(),
      };
    } else {
      const result = await actionFn(invocation.input, config.storage);
      const { variant, ...output } = result;

      completion = {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant,
        output,
        flow: invocation.flow,
        timestamp: timestamp(),
      };
    }

    await publisher.publish(completion);
  };
}
