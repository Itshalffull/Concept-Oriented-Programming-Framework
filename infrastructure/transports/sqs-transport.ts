// ============================================================
// SQS Transport Adapter
//
// Implements ConceptTransport where invoke() publishes to an
// SQS invocation queue and completions are received via a
// separate completion queue.
//
// Queue model (two queues per concept):
//   {prefix}-{concept}-invocations
//     Engine publishes invocations, concept Lambda consumes
//   {prefix}-{concept}-completions
//     Concept Lambda publishes completions, engine consumes
//
// Supports FIFO queues for ordering guarantees and dead letter
// queues for failed message handling.
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from '../../kernel/src/types.js';

// --- SQS Client Interface ---
// Abstracted so callers can provide the real AWS SDK client or a mock.

export interface SQSClient {
  sendMessage(params: {
    QueueUrl: string;
    MessageBody: string;
    MessageGroupId?: string;      // FIFO queues
    MessageDeduplicationId?: string;  // FIFO queues
    DelaySeconds?: number;
  }): Promise<{ MessageId: string }>;

  receiveMessage(params: {
    QueueUrl: string;
    MaxNumberOfMessages: number;
    WaitTimeSeconds?: number;
    VisibilityTimeout?: number;
  }): Promise<{ Messages?: SQSMessage[] }>;

  deleteMessage(params: {
    QueueUrl: string;
    ReceiptHandle: string;
  }): Promise<void>;
}

export interface SQSMessage {
  MessageId: string;
  Body: string;
  ReceiptHandle: string;
  Attributes?: Record<string, string>;
}

// --- Configuration ---

export interface SQSTransportConfig {
  /** AWS region */
  region: string;
  /** Queue name prefix (e.g. "myapp-prod-") */
  queuePrefix: string;
  /** Visibility timeout — must exceed concept's max execution time */
  visibilityTimeout: number;
  /** Batch size for polling (1-10) */
  batchSize?: number;
  /** Use FIFO queues for ordering guarantees */
  fifo?: boolean;
  /** Base URL for constructing queue URLs (for local dev) */
  queueUrlBase?: string;
}

// --- Helpers ---

function invocationQueueUrl(config: SQSTransportConfig, concept: string): string {
  const suffix = config.fifo ? '.fifo' : '';
  if (config.queueUrlBase) {
    return `${config.queueUrlBase}/${config.queuePrefix}${concept}-invocations${suffix}`;
  }
  return `https://sqs.${config.region}.amazonaws.com/${config.queuePrefix}${concept}-invocations${suffix}`;
}

function completionQueueUrl(config: SQSTransportConfig, concept: string): string {
  const suffix = config.fifo ? '.fifo' : '';
  if (config.queueUrlBase) {
    return `${config.queueUrlBase}/${config.queuePrefix}${concept}-completions${suffix}`;
  }
  return `https://sqs.${config.region}.amazonaws.com/${config.queuePrefix}${concept}-completions${suffix}`;
}

// --- Factory ---

/**
 * Create a ConceptTransport backed by SQS queues.
 *
 * invoke() sends to the concept's invocation queue.
 * The completion is awaited by polling the completion queue
 * (for synchronous invoke) or fire-and-forget (for async).
 *
 * @param client - SQS client (real or mock)
 * @param config - Transport configuration
 * @param conceptName - The target concept name
 */
export function createSQSTransport(
  client: SQSClient,
  config: SQSTransportConfig,
  conceptName: string,
): ConceptTransport {
  const invocationUrl = invocationQueueUrl(config, conceptName);
  const completionUrl = completionQueueUrl(config, conceptName);
  const batchSize = config.batchSize ?? 1;

  return {
    queryMode: 'lite',

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      // Send invocation to the concept's invocation queue
      const sendParams: Parameters<SQSClient['sendMessage']>[0] = {
        QueueUrl: invocationUrl,
        MessageBody: JSON.stringify(invocation),
      };

      if (config.fifo) {
        sendParams.MessageGroupId = invocation.flow;
        sendParams.MessageDeduplicationId = invocation.id;
      }

      await client.sendMessage(sendParams);

      // Poll for the completion (synchronous mode)
      const deadline = Date.now() + (config.visibilityTimeout * 1000);
      while (Date.now() < deadline) {
        const response = await client.receiveMessage({
          QueueUrl: completionUrl,
          MaxNumberOfMessages: batchSize,
          WaitTimeSeconds: 5,
          VisibilityTimeout: config.visibilityTimeout,
        });

        if (response.Messages) {
          for (const msg of response.Messages) {
            const completion: ActionCompletion = JSON.parse(msg.Body);
            if (completion.id === invocation.id) {
              await client.deleteMessage({
                QueueUrl: completionUrl,
                ReceiptHandle: msg.ReceiptHandle,
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
        output: { message: 'SQS transport timeout waiting for completion' },
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    },

    async query(_request: ConceptQuery): Promise<Record<string, unknown>[]> {
      // Queries are not supported over SQS — concepts must expose
      // query endpoints separately (e.g., via API Gateway)
      return [];
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        // Simple health check: try to receive (no messages expected)
        await client.receiveMessage({
          QueueUrl: completionUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 0,
        });
        return { available: true, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}

// --- Completion Publisher for Lambda Concept Functions ---

/**
 * Create a publisher that sends completions to the concept's
 * completion queue. Used by Lambda concept functions in SQS mode.
 */
export function createSQSCompletionPublisher(
  client: SQSClient,
  config: SQSTransportConfig,
  conceptName: string,
) {
  const url = completionQueueUrl(config, conceptName);

  return {
    async publish(completion: ActionCompletion): Promise<void> {
      const sendParams: Parameters<SQSClient['sendMessage']>[0] = {
        QueueUrl: url,
        MessageBody: JSON.stringify(completion),
      };

      if (config.fifo) {
        sendParams.MessageGroupId = completion.flow;
        sendParams.MessageDeduplicationId = completion.id;
      }

      await client.sendMessage(sendParams);
    },
  };
}
