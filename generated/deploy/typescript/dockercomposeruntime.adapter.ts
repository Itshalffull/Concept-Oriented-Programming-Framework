// generated: dockercomposeruntime.adapter.ts
import type {
  ActionInvocation, ActionCompletion,
  ConceptTransport, ConceptQuery
} from "@clef/runtime";
import type { DockerComposeRuntimeHandler } from "./dockercomposeruntime.handler";
import type { ConceptStorage } from "@clef/runtime";

export function createDockerComposeRuntimeLiteAdapter(
  handler: DockerComposeRuntimeHandler,
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
