// ============================================================
// AWS Lambda Concept Function Scaffold
//
// Wraps a Clef concept handler as an AWS Lambda function.
// Receives ActionInvocations via API Gateway or direct invoke,
// executes the concept handler, and returns ActionCompletions.
//
// The handler initializes storage outside the handler function
// to reuse connections across warm invocations.
//
// Supports two modes:
//   1. HTTP (API Gateway): concept receives invocations from
//      an always-on engine via HTTP POST
//   2. SQS: concept receives invocations from a queue, sends
//      completions back to the engine's completion queue
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ActionInvocation,
  ActionCompletion,
} from '../../types.js';
import { timestamp } from '../../types.js';

// --- Lambda Event Types ---

export interface APIGatewayEvent {
  httpMethod: string;
  path: string;
  body: string | null;
  headers: Record<string, string>;
  requestContext?: Record<string, unknown>;
}

export interface APIGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface SQSEvent {
  Records: SQSRecord[];
}

export interface SQSRecord {
  messageId: string;
  body: string;
  attributes: Record<string, string>;
  eventSourceARN: string;
}

export interface SQSBatchResponse {
  batchItemFailures: { itemIdentifier: string }[];
}

// --- Completion Publisher ---

export interface CompletionPublisher {
  publish(completion: ActionCompletion): Promise<void>;
}

// --- Lambda Handler Config ---

export interface LambdaHandlerConfig {
  /** The concept name this function serves */
  conceptName: string;
  /** The concept handler */
  handler: ConceptHandler;
  /** Storage adapter (initialized outside handler for reuse) */
  storage: ConceptStorage;
  /** For SQS mode: publisher to send completions back to engine */
  completionPublisher?: CompletionPublisher;
}

// --- HTTP Handler (API Gateway) ---

/**
 * Create an API Gateway Lambda handler for a Clef concept.
 *
 * Routes:
 *   POST /invoke  — receive an ActionInvocation, return ActionCompletion
 *   POST /query   — receive a query, return results
 *   GET  /health  — health check
 */
export function createHttpLambdaHandler(config: LambdaHandlerConfig) {
  return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    try {
      // Health check
      if (event.httpMethod === 'GET' && event.path.endsWith('/health')) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ available: true, concept: config.conceptName }),
        };
      }

      // Invoke
      if (event.httpMethod === 'POST' && event.path.endsWith('/invoke')) {
        if (!event.body) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Missing request body' }),
          };
        }

        const invocation: ActionInvocation = JSON.parse(event.body);
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
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(completion),
          };
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

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(completion),
        };
      }

      // Query
      if (event.httpMethod === 'POST' && event.path.endsWith('/query')) {
        if (!event.body) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Missing request body' }),
          };
        }

        const { relation, args } = JSON.parse(event.body);
        const results = await config.storage.find(relation, args);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(results),
        };
      }

      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Not found' }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: message }),
      };
    }
  };
}

// --- SQS Handler (Event-Driven) ---

/**
 * Create an SQS Lambda handler for a Clef concept.
 *
 * Processes invocations from an SQS queue and publishes
 * completions back to the engine's completion queue.
 * Supports partial batch failure reporting.
 */
export function createSqsLambdaHandler(config: LambdaHandlerConfig) {
  if (!config.completionPublisher) {
    throw new Error('SQS handler requires a completionPublisher');
  }

  const publisher = config.completionPublisher;

  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const failures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
      try {
        const invocation: ActionInvocation = JSON.parse(record.body);
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
      } catch {
        failures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures: failures };
  };
}
