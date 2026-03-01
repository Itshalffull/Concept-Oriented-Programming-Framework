// generated: runtime_flow/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::RuntimeFlowHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn runtime_flow_invariant_1() {
        // invariant 1: after correlate, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // correlate(flowId: "f-123") -> ok(flow: f)
        let step1 = handler.correlate(
            CorrelateInput { flow_id: "f-123".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CorrelateOutput::Ok { flow, .. } => {
                assert_eq!(flow, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(flow: f) -> ok(flow: f, flowId: "f-123", status: _, stepCount: _, deviationCount: _)
        let step2 = handler.get(
            GetInput { flow: f.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { flow, flow_id, status, step_count, deviation_count, .. } => {
                assert_eq!(flow, f.clone());
                assert_eq!(flow_id, "f-123".to_string());
                assert_eq!(status, .clone());
                assert_eq!(step_count, .clone());
                assert_eq!(deviation_count, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
