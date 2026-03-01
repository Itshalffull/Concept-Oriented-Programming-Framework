// generated: step_run/conformance.rs
// Conformance tests for StepRun concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::StepRunHandler;
    use super::super::r#impl::StepRunHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> StepRunHandlerImpl {
        StepRunHandlerImpl
    }

    #[tokio::test]
    async fn step_run_invariant_start_then_get_running() {
        // Invariant: after start, get returns status "running"
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-inv-001".to_string(),
                step_ref: "step-a".to_string(),
                input: None,
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match start_result {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let get_result = handler.get(
            StepRunGetInput {
                step_run_id,
                run_ref: "run-inv-001".to_string(),
            },
            &storage,
        ).await.unwrap();

        match get_result {
            StepRunGetOutput::Ok { status, .. } => {
                assert_eq!(status, "running");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn step_run_invariant_terminal_states_immutable() {
        // Invariant: once in a terminal state, no further transitions are allowed
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-inv-002".to_string(),
                step_ref: "step-b".to_string(),
                input: None,
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match start_result {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        // Complete the step
        handler.complete(
            StepRunCompleteInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-inv-002".to_string(),
                output: None,
            },
            &storage,
        ).await.unwrap();

        // Attempt to fail it
        let fail_result = handler.fail(
            StepRunFailInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-inv-002".to_string(),
                error: "should reject".to_string(),
                error_code: None,
            },
            &storage,
        ).await.unwrap();

        match fail_result {
            StepRunFailOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected InvalidTransition"),
        }

        // Attempt to cancel it
        let cancel_result = handler.cancel(
            StepRunCancelInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-inv-002".to_string(),
                reason: None,
            },
            &storage,
        ).await.unwrap();

        match cancel_result {
            StepRunCancelOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected InvalidTransition"),
        }
    }

    #[tokio::test]
    async fn step_run_invariant_skip_is_terminal() {
        // Invariant: skipped steps are immediately terminal
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let skip_result = handler.skip(
            StepRunSkipInput {
                run_ref: "run-inv-003".to_string(),
                step_ref: "optional".to_string(),
                reason: Some("not applicable".to_string()),
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match skip_result {
            StepRunSkipOutput::Ok { step_run_id, .. } => step_run_id,
        };

        let get_result = handler.get(
            StepRunGetInput {
                step_run_id,
                run_ref: "run-inv-003".to_string(),
            },
            &storage,
        ).await.unwrap();

        match get_result {
            StepRunGetOutput::Ok { status, .. } => {
                assert_eq!(status, "skipped");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn step_run_invariant_complete_preserves_output() {
        // Invariant: completed step preserves its output
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-inv-004".to_string(),
                step_ref: "compute".to_string(),
                input: None,
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match start_result {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        handler.complete(
            StepRunCompleteInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-inv-004".to_string(),
                output: Some(json!({ "answer": 42 })),
            },
            &storage,
        ).await.unwrap();

        let get_result = handler.get(
            StepRunGetInput {
                step_run_id,
                run_ref: "run-inv-004".to_string(),
            },
            &storage,
        ).await.unwrap();

        match get_result {
            StepRunGetOutput::Ok { output, .. } => {
                assert_eq!(output["answer"], json!(42));
            }
            _ => panic!("Expected Ok"),
        }
    }
}
