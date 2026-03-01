// generated: webhookinbox.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./webhookinbox.types";

export interface WebhookInboxHandler {
  register(input: T.WebhookInboxRegisterInput, storage: ConceptStorage):
    Promise<T.WebhookInboxRegisterOutput>;
  receive(input: T.WebhookInboxReceiveInput, storage: ConceptStorage):
    Promise<T.WebhookInboxReceiveOutput>;
  expire(input: T.WebhookInboxExpireInput, storage: ConceptStorage):
    Promise<T.WebhookInboxExpireOutput>;
  ack(input: T.WebhookInboxAckInput, storage: ConceptStorage):
    Promise<T.WebhookInboxAckOutput>;
}
