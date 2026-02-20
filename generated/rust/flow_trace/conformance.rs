// generated: flow_trace/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FlowTraceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn flow_trace_invariant_1() {
        // invariant 1: after render, build behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let o = "u-test-invariant-001".to_string();
        let e = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // render(trace: { flowId: "f1", status: "ok", durationMs: 100, root: { action: "Test/ping", variant: "ok", durationMs: 50, fields: {  }, children: [] } }, options: {  }) -> ok(output: o)
        let step1 = handler.render(
            RenderInput { trace: todo!(/* record: { "flowId": "f1".to_string(), "status": "ok".to_string(), "durationMs": 100, "root": todo!(/* record: { "action": "Test/ping".to_string(), "variant": "ok".to_string(), "durationMs": 50, "fields": todo!(/* record: {  } */), "children": todo!(/* list: [] */) } */) } */), options: todo!(/* record: {  } */) },
            &storage,
        ).await.unwrap();
        match step1 {
            RenderOutput::Ok { output, .. } => {
                assert_eq!(output, o.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // build(flowId: "f1") -> error(message: e)
        let step2 = handler.build(
            BuildInput { flow_id: "f1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            BuildOutput::Error { message, .. } => {
                assert_eq!(message, e.clone());
            },
            other => panic!("Expected Error, got {:?}", other),
        }
    }

}
