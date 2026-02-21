// generated: eventbus.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./eventbus.types";

export interface EventBusHandler {
  registerEventType(input: T.EventBusRegisterEventTypeInput, storage: ConceptStorage):
    Promise<T.EventBusRegisterEventTypeOutput>;
  subscribe(input: T.EventBusSubscribeInput, storage: ConceptStorage):
    Promise<T.EventBusSubscribeOutput>;
  unsubscribe(input: T.EventBusUnsubscribeInput, storage: ConceptStorage):
    Promise<T.EventBusUnsubscribeOutput>;
  dispatch(input: T.EventBusDispatchInput, storage: ConceptStorage):
    Promise<T.EventBusDispatchOutput>;
  dispatchAsync(input: T.EventBusDispatchAsyncInput, storage: ConceptStorage):
    Promise<T.EventBusDispatchAsyncOutput>;
  getHistory(input: T.EventBusGetHistoryInput, storage: ConceptStorage):
    Promise<T.EventBusGetHistoryOutput>;
}
