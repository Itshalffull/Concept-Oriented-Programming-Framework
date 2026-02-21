// generated: schema.adapter.ts
import type {
  ActionInvocation, ActionCompletion,
  ConceptTransport, ConceptQuery
} from "@copf/runtime";
import type { SchemaHandler } from "./schema.handler";
import type { ConceptStorage } from "@copf/runtime";

export function createSchemaLiteAdapter(
  handler: SchemaHandler,
  storage: ConceptStorage,
): ConceptTransport {
  return {
    queryMode: "lite",
    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const result = await (handler as any)[invocation.action](
        invocation.input,
        storage
      );
      const { variant, ...output } = result;
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant,
        output,
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    },
    async query(request: ConceptQuery) {
      return storage.find(request.relation, request.args);
    },
    async health() {
      return { available: true, latency: 0 };
    },
  };
}
