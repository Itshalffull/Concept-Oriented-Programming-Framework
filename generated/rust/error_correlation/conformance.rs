// generated: error_correlation/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ErrorCorrelationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn error_correlation_invariant_1() {
        // invariant 1: after record, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let e = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // record(flowId: "f-123", errorKind: "action-error", message: "Token signing key not configured", rawEvent: "{}") -> ok(error: e)
        let step1 = handler.record(
            RecordInput { flow_id: "f-123".to_string(), error_kind: "action-error".to_string(), message: "Token signing key not configured".to_string(), raw_event: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { error, .. } => {
                assert_eq!(error, e.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(error: e) -> ok(error: e, flowId: "f-123", errorKind: "action-error", errorMessage: "Token signing key not configured", timestamp: _)
        let step2 = handler.get(
            GetInput { error: e.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { error, flow_id, error_kind, error_message, timestamp, .. } => {
                assert_eq!(error, e.clone());
                assert_eq!(flow_id, "f-123".to_string());
                assert_eq!(error_kind, "action-error".to_string());
                assert_eq!(error_message, "Token signing key not configured".to_string());
                assert_eq!(timestamp, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
