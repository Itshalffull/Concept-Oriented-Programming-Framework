// generated: process_run/conformance.rs
// Conformance tests for ProcessRun concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessRunHandler;
    use super::super::r#impl::ProcessRunHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> ProcessRunHandlerImpl {
        ProcessRunHandlerImpl
    }

    #[tokio::test]
    async fn process_run_invariant_start_then_running() {
        // Invariant: after start, get_status returns "running"
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let start = handler.start(
            ProcessRunStartInput {
                spec_ref: "onboard".to_string(),
                spec_version: 1,
                input: Some(json!({ "data": "test" })),
            },
            &storage,
        ).await.unwrap();

        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        let status = handler.get_status(
            ProcessRunGetStatusInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();

        match status {
            ProcessRunGetStatusOutput::Ok { status, spec_ref, .. } => {
                assert_eq!(status, "running");
                assert_eq!(spec_ref, "onboard");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn process_run_invariant_complete_then_completed() {
        // Invariant: after start -> complete, status is "completed"
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let start = handler.start(
            ProcessRunStartInput {
                spec_ref: "onboard".to_string(),
                spec_version: 1,
                input: None,
            },
            &storage,
        ).await.unwrap();

        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        handler.complete(
            ProcessRunCompleteInput {
                run_id: run_id.clone(),
                output: Some(json!({ "result": "success" })),
            },
            &storage,
        ).await.unwrap();

        let status = handler.get_status(
            ProcessRunGetStatusInput { run_id },
            &storage,
        ).await.unwrap();

        match status {
            ProcessRunGetStatusOutput::Ok { status, .. } => {
                assert_eq!(status, "completed");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn process_run_invariant_terminal_states_immutable() {
        // Invariant: once completed, no further transitions allowed
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let start = handler.start(
            ProcessRunStartInput {
                spec_ref: "flow".to_string(),
                spec_version: 1,
                input: None,
            },
            &storage,
        ).await.unwrap();

        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        handler.complete(
            ProcessRunCompleteInput { run_id: run_id.clone(), output: None },
            &storage,
        ).await.unwrap();

        let fail_result = handler.fail(
            ProcessRunFailInput { run_id: run_id.clone(), error: "late error".to_string() },
            &storage,
        ).await.unwrap();
        match fail_result {
            ProcessRunFailOutput::NotRunning { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected NotRunning"),
        }

        let cancel_result = handler.cancel(
            ProcessRunCancelInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();
        match cancel_result {
            ProcessRunCancelOutput::NotCancellable { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected NotCancellable"),
        }
    }

    #[tokio::test]
    async fn process_run_invariant_suspend_resume_cycle() {
        // Invariant: running -> suspend -> resume returns to running
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let start = handler.start(
            ProcessRunStartInput {
                spec_ref: "workflow".to_string(),
                spec_version: 1,
                input: None,
            },
            &storage,
        ).await.unwrap();

        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        handler.suspend(
            ProcessRunSuspendInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();

        let status_suspended = handler.get_status(
            ProcessRunGetStatusInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();
        match status_suspended {
            ProcessRunGetStatusOutput::Ok { status, .. } => assert_eq!(status, "suspended"),
            _ => panic!("Expected Ok"),
        }

        handler.resume(
            ProcessRunResumeInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();

        let status_resumed = handler.get_status(
            ProcessRunGetStatusInput { run_id },
            &storage,
        ).await.unwrap();
        match status_resumed {
            ProcessRunGetStatusOutput::Ok { status, .. } => assert_eq!(status, "running"),
            _ => panic!("Expected Ok"),
        }
    }
}
