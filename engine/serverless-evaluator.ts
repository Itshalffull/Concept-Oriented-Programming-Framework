// ============================================================
// Serverless Engine Evaluator
//
// A Lambda/GCF handler that processes completions from a message
// queue, runs sync evaluation, and publishes invocations back.
//
// This is the engine's onCompletion function wrapped in a queue
// consumer. No persistent state in the function itself — all
// state flows through the durable action log and firing guard.
//
// Flow:
//   1. Receive completion from queue (SQS or Pub/Sub)
//   2. Load compiled syncs from bundled .copf-cache/
//   3. Build sync index (cached across warm invocations)
//   4. Load relevant flow from durable action log
//   5. Run matching algorithm
//   6. Check distributed firing guard for deduplication
//   7. Publish resulting invocations to concept queues
//   8. Persist new action log entries
// ============================================================

import type {
  ActionCompletion,
  ActionInvocation,
  CompiledSync,
  ConceptRegistry,
} from '../kernel/src/types.js';
import { createPerRequestEngine, invalidatePerRequestCache } from './per-request-engine.js';
import type { DurableActionLog } from './durable-action-log.js';
import type { DistributedFiringGuard } from '../infrastructure/serverless/distributed-lock.js';
import type { SQSClient } from '../infrastructure/transports/sqs-transport.js';
import type { PubSubClient } from '../infrastructure/transports/pubsub-transport.js';

// --- Invocation Dispatcher ---

export interface InvocationDispatcher {
  /** Dispatch invocations to concept queues */
  dispatch(invocations: ActionInvocation[]): Promise<void>;
}

// --- SQS Invocation Dispatcher ---

export function createSQSDispatcher(
  client: SQSClient,
  queuePrefix: string,
  region: string,
  fifo?: boolean,
): InvocationDispatcher {
  return {
    async dispatch(invocations: ActionInvocation[]): Promise<void> {
      for (const invocation of invocations) {
        const suffix = fifo ? '.fifo' : '';
        const queueUrl = `https://sqs.${region}.amazonaws.com/${queuePrefix}${invocation.concept}-invocations${suffix}`;

        const sendParams: Parameters<SQSClient['sendMessage']>[0] = {
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(invocation),
        };

        if (fifo) {
          sendParams.MessageGroupId = invocation.flow;
          sendParams.MessageDeduplicationId = invocation.id;
        }

        await client.sendMessage(sendParams);
      }
    },
  };
}

// --- Pub/Sub Invocation Dispatcher ---

export function createPubSubDispatcher(
  client: PubSubClient,
  projectId: string,
  topicPrefix: string,
  enableOrdering?: boolean,
): InvocationDispatcher {
  return {
    async dispatch(invocations: ActionInvocation[]): Promise<void> {
      for (const invocation of invocations) {
        const topic = `projects/${projectId}/topics/${topicPrefix}${invocation.concept}-invocations`;
        const data = Buffer.from(JSON.stringify(invocation)).toString('base64');

        const publishParams: Parameters<PubSubClient['publish']>[0] = {
          topic,
          data,
          attributes: {
            concept: invocation.concept,
            action: invocation.action,
            flow: invocation.flow,
          },
        };

        if (enableOrdering) {
          publishParams.orderingKey = invocation.flow;
        }

        await client.publish(publishParams);
      }
    },
  };
}

// --- Evaluator Configuration ---

export interface ServerlessEvaluatorConfig {
  /** Compiled syncs (bundled in deployment package) */
  compiledSyncs: CompiledSync[];
  /** Concept registry for where-clause queries */
  registry: ConceptRegistry;
  /** Durable action log */
  durableLog: DurableActionLog;
  /** Distributed firing guard */
  firingGuard?: DistributedFiringGuard;
  /** Dispatcher to send invocations to concept queues */
  dispatcher: InvocationDispatcher;
}

// --- SQS Evaluator Handler ---

export interface SQSEvaluatorEvent {
  Records: {
    messageId: string;
    body: string;
    attributes: Record<string, string>;
    eventSourceARN: string;
  }[];
}

export interface SQSBatchResponse {
  batchItemFailures: { itemIdentifier: string }[];
}

/**
 * Create an SQS Lambda handler that acts as the sync engine
 * evaluator. Consumes completions from concept completion queues
 * and dispatches invocations to concept invocation queues.
 */
export function createSQSEvaluatorHandler(config: ServerlessEvaluatorConfig) {
  const engine = createPerRequestEngine({
    compiledSyncs: config.compiledSyncs,
    registry: config.registry,
    durableLog: config.durableLog,
    firingGuard: config.firingGuard,
  });

  return async (event: SQSEvaluatorEvent): Promise<SQSBatchResponse> => {
    const failures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
      try {
        const completion: ActionCompletion = JSON.parse(record.body);
        const invocations = await engine.onCompletion(completion);

        if (invocations.length > 0) {
          await config.dispatcher.dispatch(invocations);
        }
      } catch {
        failures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures: failures };
  };
}

// --- Pub/Sub Evaluator Handler ---

export interface PubSubEvaluatorMessage {
  data: string;       // Base64-encoded completion
  attributes?: Record<string, string>;
  messageId: string;
  publishTime: string;
}

export interface PubSubEvaluatorContext {
  eventId: string;
  timestamp: string;
  eventType: string;
  resource: { service: string; name: string };
}

/**
 * Create a Pub/Sub Cloud Function handler that acts as the sync
 * engine evaluator. Consumes completions from concept completion
 * topics and dispatches invocations to concept invocation topics.
 */
export function createPubSubEvaluatorHandler(config: ServerlessEvaluatorConfig) {
  const engine = createPerRequestEngine({
    compiledSyncs: config.compiledSyncs,
    registry: config.registry,
    durableLog: config.durableLog,
    firingGuard: config.firingGuard,
  });

  return async (message: PubSubEvaluatorMessage, _context: PubSubEvaluatorContext): Promise<void> => {
    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    const completion: ActionCompletion = JSON.parse(decoded);
    const invocations = await engine.onCompletion(completion);

    if (invocations.length > 0) {
      await config.dispatcher.dispatch(invocations);
    }
  };
}

export { invalidatePerRequestCache };
