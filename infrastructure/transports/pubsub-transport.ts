// ============================================================
// Google Cloud Pub/Sub Transport Adapter
//
// Implements ConceptTransport where invoke() publishes to a
// Pub/Sub invocation topic and completions are received via
// a separate completion subscription.
//
// Topic model (two topics per concept):
//   {prefix}-{concept}-invocations
//     Engine publishes invocations, concept GCF subscribes
//   {prefix}-{concept}-completions
//     Concept GCF publishes completions, engine subscribes
//
// Supports ordered message delivery and dead letter topics.
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from '../../kernel/src/types.js';

// --- Pub/Sub Client Interface ---
// Abstracted so callers can provide the real GCP SDK client or a mock.

export interface PubSubClient {
  publish(params: {
    topic: string;
    data: string;       // Base64-encoded message data
    attributes?: Record<string, string>;
    orderingKey?: string;
  }): Promise<{ messageId: string }>;

  pull(params: {
    subscription: string;
    maxMessages: number;
  }): Promise<{ receivedMessages?: PubSubReceivedMessage[] }>;

  acknowledge(params: {
    subscription: string;
    ackIds: string[];
  }): Promise<void>;
}

export interface PubSubReceivedMessage {
  ackId: string;
  message: {
    messageId: string;
    data: string;        // Base64-encoded
    attributes?: Record<string, string>;
    publishTime: string;
  };
}

// --- Configuration ---

export interface PubSubTransportConfig {
  /** GCP project ID */
  projectId: string;
  /** Topic name prefix (e.g. "myapp-prod-") */
  topicPrefix: string;
  /** Acknowledgment deadline in seconds */
  ackDeadlineSeconds: number;
  /** Enable message ordering by flow ID */
  enableOrdering?: boolean;
}

// --- Helpers ---

function invocationTopic(config: PubSubTransportConfig, concept: string): string {
  return `projects/${config.projectId}/topics/${config.topicPrefix}${concept}-invocations`;
}

function completionTopic(config: PubSubTransportConfig, concept: string): string {
  return `projects/${config.projectId}/topics/${config.topicPrefix}${concept}-completions`;
}

function completionSubscription(config: PubSubTransportConfig, concept: string): string {
  return `projects/${config.projectId}/subscriptions/${config.topicPrefix}${concept}-completions-sub`;
}

// --- Factory ---

/**
 * Create a ConceptTransport backed by Google Cloud Pub/Sub.
 *
 * invoke() publishes to the concept's invocation topic.
 * The completion is awaited by pulling from the completion subscription.
 *
 * @param client - Pub/Sub client (real or mock)
 * @param config - Transport configuration
 * @param conceptName - The target concept name
 */
export function createPubSubTransport(
  client: PubSubClient,
  config: PubSubTransportConfig,
  conceptName: string,
): ConceptTransport {
  const invTopic = invocationTopic(config, conceptName);
  const compSub = completionSubscription(config, conceptName);

  return {
    queryMode: 'lite',

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      // Publish invocation to the concept's invocation topic
      const data = Buffer.from(JSON.stringify(invocation)).toString('base64');
      const publishParams: Parameters<PubSubClient['publish']>[0] = {
        topic: invTopic,
        data,
        attributes: {
          concept: invocation.concept,
          action: invocation.action,
          flow: invocation.flow,
        },
      };

      if (config.enableOrdering) {
        publishParams.orderingKey = invocation.flow;
      }

      await client.publish(publishParams);

      // Pull for the completion (synchronous mode)
      const deadline = Date.now() + (config.ackDeadlineSeconds * 1000);
      while (Date.now() < deadline) {
        const response = await client.pull({
          subscription: compSub,
          maxMessages: 10,
        });

        if (response.receivedMessages) {
          for (const received of response.receivedMessages) {
            const decoded = Buffer.from(received.message.data, 'base64').toString('utf-8');
            const completion: ActionCompletion = JSON.parse(decoded);

            if (completion.id === invocation.id) {
              await client.acknowledge({
                subscription: compSub,
                ackIds: [received.ackId],
              });
              return completion;
            }
          }
        }
      }

      // Timeout — return error completion
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant: 'error',
        output: { message: 'Pub/Sub transport timeout waiting for completion' },
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    },

    async query(_request: ConceptQuery): Promise<Record<string, unknown>[]> {
      // Queries are not supported over Pub/Sub — concepts must expose
      // query endpoints separately (e.g., via Cloud Functions HTTP)
      return [];
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        await client.pull({
          subscription: compSub,
          maxMessages: 0,
        });
        return { available: true, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}

// --- Completion Publisher for GCF Concept Functions ---

/**
 * Create a publisher that sends completions to the concept's
 * completion topic. Used by GCF concept functions in Pub/Sub mode.
 */
export function createPubSubCompletionPublisher(
  client: PubSubClient,
  config: PubSubTransportConfig,
  conceptName: string,
) {
  const topic = completionTopic(config, conceptName);

  return {
    async publish(completion: ActionCompletion): Promise<void> {
      const data = Buffer.from(JSON.stringify(completion)).toString('base64');
      const publishParams: Parameters<PubSubClient['publish']>[0] = {
        topic,
        data,
        attributes: {
          concept: completion.concept,
          action: completion.action,
          flow: completion.flow,
        },
      };

      if (config.enableOrdering) {
        publishParams.orderingKey = completion.flow;
      }

      await client.publish(publishParams);
    },
  };
}
