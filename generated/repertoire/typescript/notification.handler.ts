// generated: notification.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./notification.types";

export interface NotificationHandler {
  registerChannel(input: T.NotificationRegisterChannelInput, storage: ConceptStorage):
    Promise<T.NotificationRegisterChannelOutput>;
  defineTemplate(input: T.NotificationDefineTemplateInput, storage: ConceptStorage):
    Promise<T.NotificationDefineTemplateOutput>;
  subscribe(input: T.NotificationSubscribeInput, storage: ConceptStorage):
    Promise<T.NotificationSubscribeOutput>;
  unsubscribe(input: T.NotificationUnsubscribeInput, storage: ConceptStorage):
    Promise<T.NotificationUnsubscribeOutput>;
  notify(input: T.NotificationNotifyInput, storage: ConceptStorage):
    Promise<T.NotificationNotifyOutput>;
  markRead(input: T.NotificationMarkReadInput, storage: ConceptStorage):
    Promise<T.NotificationMarkReadOutput>;
  getUnread(input: T.NotificationGetUnreadInput, storage: ConceptStorage):
    Promise<T.NotificationGetUnreadOutput>;
}
