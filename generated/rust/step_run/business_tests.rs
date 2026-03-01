// Business logic tests for StepRun concept.
// Validates step execution lifecycle, duplicate detection,
// skip semantics, and cross-run isolation.

#[cfg(test)]
mod tests {
    use super::super::handler::StepRunHandler;
    use super::super::r#impl::StepRunHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_duplicate_running_step_rejected() {
        // Cannot start a step that is already running for the same step_ref in a run
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let first = handler.start(StepRunStartInput {
            run_ref: "run-dup".to_string(),
            step_ref: "validate".to_string(),
            input: None,
        }, &storage).await.unwrap();
        match first {
            StepRunStartOutput::Ok { .. } => {}
            _ => panic!("Expected Ok for first start"),
        }

        let second = handler.start(StepRunStartInput {
            run_ref: "run-dup".to_string(),
            step_ref: "validate".to_string(),
            input: None,
        }, &storage).await.unwrap();
        match second {
            StepRunStartOutput::AlreadyRunning { step_ref, .. } => {
                assert_eq!(step_ref, "validate");
            }
            _ => panic!("Expected AlreadyRunning for duplicate step"),
        }
    }

    #[tokio::test]
    async fn test_same_step_ref_different_runs_independent() {
        // Same step_ref in different runs should not conflict
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let run_a = handler.start(StepRunStartInput {
            run_ref: "run-a".to_string(),
            step_ref: "validate".to_string(),
            input: None,
        }, &storage).await.unwrap();
        match run_a {
            StepRunStartOutput::Ok { .. } => {}
            _ => panic!("Expected Ok for run-a"),
        }

        let run_b = handler.start(StepRunStartInput {
            run_ref: "run-b".to_string(),
            step_ref: "validate".to_string(),
            input: None,
        }, &storage).await.unwrap();
        match run_b {
            StepRunStartOutput::Ok { .. } => {}
            _ => panic!("Expected Ok for run-b (different run)"),
        }
    }

    #[tokio::test]
    async fn test_step_can_restart_after_completion() {
        // After a step completes, a new instance of the same step_ref can start
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let first_start = handler.start(StepRunStartInput {
            run_ref: "run-retry".to_string(),
            step_ref: "process-payment".to_string(),
            input: Some(json!({"amount": 100})),
        }, &storage).await.unwrap();
        let first_id = match first_start {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        handler.complete(StepRunCompleteInput {
            step_run_id: first_id.clone(),
            run_ref: "run-retry".to_string(),
            output: Some(json!({"result": "success"})),
        }, &storage).await.unwrap();

        // Should be able to start a new instance of the same step
        let second_start = handler.start(StepRunStartInput {
            run_ref: "run-retry".to_string(),
            step_ref: "process-payment".to_string(),
            input: Some(json!({"amount": 200})),
        }, &storage).await.unwrap();
        match second_start {
            StepRunStartOutput::Ok { step_run_id, .. } => {
                assert_ne!(step_run_id, first_id);
            }
            _ => panic!("Expected Ok for second start after completion"),
        }
    }

    #[tokio::test]
    async fn test_cancel_with_reason_and_without() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        // Cancel with reason
        let start1 = handler.start(StepRunStartInput {
            run_ref: "run-c1".to_string(),
            step_ref: "step-1".to_string(),
            input: None,
        }, &storage).await.unwrap();
        let id1 = match start1 {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let cancel1 = handler.cancel(StepRunCancelInput {
            step_run_id: id1.clone(),
            run_ref: "run-c1".to_string(),
            reason: Some("timeout exceeded".to_string()),
        }, &storage).await.unwrap();
        match cancel1 {
            StepRunCancelOutput::Ok { status, .. } => assert_eq!(status, "cancelled"),
            _ => panic!("Expected Ok"),
        }

        // Cancel without reason
        let start2 = handler.start(StepRunStartInput {
            run_ref: "run-c2".to_string(),
            step_ref: "step-2".to_string(),
            input: None,
        }, &storage).await.unwrap();
        let id2 = match start2 {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let cancel2 = handler.cancel(StepRunCancelInput {
            step_run_id: id2.clone(),
            run_ref: "run-c2".to_string(),
            reason: None,
        }, &storage).await.unwrap();
        match cancel2 {
            StepRunCancelOutput::Ok { status, .. } => assert_eq!(status, "cancelled"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_fail_with_and_without_error_code() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let start1 = handler.start(StepRunStartInput {
            run_ref: "run-f1".to_string(),
            step_ref: "step-err".to_string(),
            input: None,
        }, &storage).await.unwrap();
        let id1 = match start1 {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let fail1 = handler.fail(StepRunFailInput {
            step_run_id: id1.clone(),
            run_ref: "run-f1".to_string(),
            error: "connection refused".to_string(),
            error_code: Some("ECONNREFUSED".to_string()),
        }, &storage).await.unwrap();
        match fail1 {
            StepRunFailOutput::Ok { status, .. } => assert_eq!(status, "failed"),
            _ => panic!("Expected Ok"),
        }

        let start2 = handler.start(StepRunStartInput {
            run_ref: "run-f2".to_string(),
            step_ref: "step-err2".to_string(),
            input: None,
        }, &storage).await.unwrap();
        let id2 = match start2 {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let fail2 = handler.fail(StepRunFailInput {
            step_run_id: id2.clone(),
            run_ref: "run-f2".to_string(),
            error: "unknown error".to_string(),
            error_code: None,
        }, &storage).await.unwrap();
        match fail2 {
            StepRunFailOutput::Ok { status, .. } => assert_eq!(status, "failed"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_skipped_step_get_returns_skipped_status() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let skip = handler.skip(StepRunSkipInput {
            run_ref: "run-skip".to_string(),
            step_ref: "optional-notify".to_string(),
            reason: Some("notifications disabled".to_string()),
        }, &storage).await.unwrap();
        let step_run_id = match skip {
            StepRunSkipOutput::Ok { step_run_id, .. } => step_run_id,
        };

        let get = handler.get(StepRunGetInput {
            step_run_id,
            run_ref: "run-skip".to_string(),
        }, &storage).await.unwrap();
        match get {
            StepRunGetOutput::Ok { status, step_ref, .. } => {
                assert_eq!(status, "skipped");
                assert_eq!(step_ref, "optional-notify");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_cancel_failed_step_returns_invalid_transition() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let start = handler.start(StepRunStartInput {
            run_ref: "run-cf".to_string(),
            step_ref: "step-x".to_string(),
            input: None,
        }, &storage).await.unwrap();
        let step_run_id = match start {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        handler.fail(StepRunFailInput {
            step_run_id: step_run_id.clone(),
            run_ref: "run-cf".to_string(),
            error: "boom".to_string(),
            error_code: None,
        }, &storage).await.unwrap();

        let result = handler.cancel(StepRunCancelInput {
            step_run_id: step_run_id.clone(),
            run_ref: "run-cf".to_string(),
            reason: None,
        }, &storage).await.unwrap();
        match result {
            StepRunCancelOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "failed");
            }
            _ => panic!("Expected InvalidTransition"),
        }
    }

    #[tokio::test]
    async fn test_complete_with_output_preserves_data() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let start = handler.start(StepRunStartInput {
            run_ref: "run-out".to_string(),
            step_ref: "compute".to_string(),
            input: Some(json!({"x": 10})),
        }, &storage).await.unwrap();
        let step_run_id = match start {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        handler.complete(StepRunCompleteInput {
            step_run_id: step_run_id.clone(),
            run_ref: "run-out".to_string(),
            output: Some(json!({"result": 100, "details": {"computed": true}})),
        }, &storage).await.unwrap();

        let get = handler.get(StepRunGetInput {
            step_run_id,
            run_ref: "run-out".to_string(),
        }, &storage).await.unwrap();
        match get {
            StepRunGetOutput::Ok { status, output, .. } => {
                assert_eq!(status, "completed");
                assert_eq!(output["result"], json!(100));
                assert_eq!(output["details"]["computed"], json!(true));
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_get_preserves_input_data() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;

        let start = handler.start(StepRunStartInput {
            run_ref: "run-input".to_string(),
            step_ref: "fetch".to_string(),
            input: Some(json!({"url": "https://api.example.com", "method": "GET"})),
        }, &storage).await.unwrap();
        let step_run_id = match start {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let get = handler.get(StepRunGetInput {
            step_run_id,
            run_ref: "run-input".to_string(),
        }, &storage).await.unwrap();
        match get {
            StepRunGetOutput::Ok { input, .. } => {
                assert_eq!(input["url"], json!("https://api.example.com"));
                assert_eq!(input["method"], json!("GET"));
            }
            _ => panic!("Expected Ok"),
        }
    }
}
