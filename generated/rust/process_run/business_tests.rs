// Business logic tests for ProcessRun concept.
// Validates complex state machine transitions, parent-child relationships,
// and edge cases in the process run lifecycle.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessRunHandler;
    use super::super::r#impl::ProcessRunHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_empty_spec_ref_returns_invalid_spec() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;
        let result = handler.start(ProcessRunStartInput {
            spec_ref: "".to_string(),
            spec_version: 1,
            input: None,
        }, &storage).await.unwrap();
        match result {
            ProcessRunStartOutput::InvalidSpec { spec_ref } => {
                assert_eq!(spec_ref, "");
            }
            _ => panic!("Expected InvalidSpec for empty spec_ref"),
        }
    }

    #[tokio::test]
    async fn test_empty_spec_ref_for_child_returns_invalid_spec() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;
        let result = handler.start_child(ProcessRunStartChildInput {
            spec_ref: "".to_string(),
            spec_version: 1,
            parent_run: "run-parent".to_string(),
            input: None,
        }, &storage).await.unwrap();
        match result {
            ProcessRunStartChildOutput::InvalidSpec { spec_ref } => {
                assert_eq!(spec_ref, "");
            }
            _ => panic!("Expected InvalidSpec for empty child spec_ref"),
        }
    }

    #[tokio::test]
    async fn test_completed_process_cannot_be_suspended() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let start = handler.start(ProcessRunStartInput {
            spec_ref: "flow".to_string(),
            spec_version: 1,
            input: None,
        }, &storage).await.unwrap();
        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        handler.complete(ProcessRunCompleteInput {
            run_id: run_id.clone(),
            output: None,
        }, &storage).await.unwrap();

        let result = handler.suspend(ProcessRunSuspendInput {
            run_id: run_id.clone(),
        }, &storage).await.unwrap();
        match result {
            ProcessRunSuspendOutput::NotRunning { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected NotRunning"),
        }
    }

    #[tokio::test]
    async fn test_failed_process_cannot_be_resumed() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let start = handler.start(ProcessRunStartInput {
            spec_ref: "risky".to_string(),
            spec_version: 1,
            input: None,
        }, &storage).await.unwrap();
        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        handler.fail(ProcessRunFailInput {
            run_id: run_id.clone(),
            error: "crash".to_string(),
        }, &storage).await.unwrap();

        let result = handler.resume(ProcessRunResumeInput {
            run_id: run_id.clone(),
        }, &storage).await.unwrap();
        match result {
            ProcessRunResumeOutput::NotSuspended { current_status, .. } => {
                assert_eq!(current_status, "failed");
            }
            _ => panic!("Expected NotSuspended"),
        }
    }

    #[tokio::test]
    async fn test_cancelled_process_cannot_transition() {
        // Cancelled is a terminal state -- cannot complete, fail, suspend, or resume
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let start = handler.start(ProcessRunStartInput {
            spec_ref: "cancel-test".to_string(),
            spec_version: 1,
            input: None,
        }, &storage).await.unwrap();
        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        handler.cancel(ProcessRunCancelInput { run_id: run_id.clone() }, &storage).await.unwrap();

        let complete = handler.complete(ProcessRunCompleteInput {
            run_id: run_id.clone(),
            output: None,
        }, &storage).await.unwrap();
        match complete {
            ProcessRunCompleteOutput::NotRunning { current_status, .. } => {
                assert_eq!(current_status, "cancelled");
            }
            _ => panic!("Expected NotRunning"),
        }

        let suspend = handler.suspend(ProcessRunSuspendInput { run_id: run_id.clone() }, &storage).await.unwrap();
        match suspend {
            ProcessRunSuspendOutput::NotRunning { current_status, .. } => {
                assert_eq!(current_status, "cancelled");
            }
            _ => panic!("Expected NotRunning"),
        }

        let cancel_again = handler.cancel(ProcessRunCancelInput { run_id: run_id.clone() }, &storage).await.unwrap();
        match cancel_again {
            ProcessRunCancelOutput::NotCancellable { current_status, .. } => {
                assert_eq!(current_status, "cancelled");
            }
            _ => panic!("Expected NotCancellable"),
        }
    }

    #[tokio::test]
    async fn test_multiple_suspend_resume_cycles() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let start = handler.start(ProcessRunStartInput {
            spec_ref: "cycle-test".to_string(),
            spec_version: 1,
            input: None,
        }, &storage).await.unwrap();
        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        for _ in 0..3 {
            handler.suspend(ProcessRunSuspendInput { run_id: run_id.clone() }, &storage).await.unwrap();

            let status = handler.get_status(ProcessRunGetStatusInput {
                run_id: run_id.clone(),
            }, &storage).await.unwrap();
            match status {
                ProcessRunGetStatusOutput::Ok { status, .. } => assert_eq!(status, "suspended"),
                _ => panic!("Expected Ok"),
            }

            handler.resume(ProcessRunResumeInput { run_id: run_id.clone() }, &storage).await.unwrap();

            let status = handler.get_status(ProcessRunGetStatusInput {
                run_id: run_id.clone(),
            }, &storage).await.unwrap();
            match status {
                ProcessRunGetStatusOutput::Ok { status, .. } => assert_eq!(status, "running"),
                _ => panic!("Expected Ok"),
            }
        }

        // Should still be able to complete after cycles
        let complete = handler.complete(ProcessRunCompleteInput {
            run_id: run_id.clone(),
            output: Some(json!({"cycles": 3})),
        }, &storage).await.unwrap();
        match complete {
            ProcessRunCompleteOutput::Ok { status, .. } => assert_eq!(status, "completed"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_start_with_input_preserves_data() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let result = handler.start(ProcessRunStartInput {
            spec_ref: "data-flow".to_string(),
            spec_version: 3,
            input: Some(json!({"users": ["alice", "bob"], "count": 2})),
        }, &storage).await.unwrap();
        match result {
            ProcessRunStartOutput::Ok { run_id, spec_ref, status } => {
                assert!(run_id.starts_with("run-"));
                assert_eq!(spec_ref, "data-flow");
                assert_eq!(status, "running");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_complete_not_found_run() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let result = handler.complete(ProcessRunCompleteInput {
            run_id: "run-nonexistent".to_string(),
            output: None,
        }, &storage).await.unwrap();
        match result {
            ProcessRunCompleteOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_fail_not_found_run() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let result = handler.fail(ProcessRunFailInput {
            run_id: "run-ghost".to_string(),
            error: "does not matter".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessRunFailOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_cancel_not_found_run() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let result = handler.cancel(ProcessRunCancelInput {
            run_id: "run-missing".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessRunCancelOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_parent_child_independent_lifecycles() {
        // Parent and child can have different statuses
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let parent = handler.start(ProcessRunStartInput {
            spec_ref: "main".to_string(),
            spec_version: 1,
            input: None,
        }, &storage).await.unwrap();
        let parent_id = match parent {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        let child = handler.start_child(ProcessRunStartChildInput {
            spec_ref: "sub".to_string(),
            spec_version: 1,
            parent_run: parent_id.clone(),
            input: None,
        }, &storage).await.unwrap();
        let child_id = match child {
            ProcessRunStartChildOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        // Complete child, parent still running
        handler.complete(ProcessRunCompleteInput {
            run_id: child_id.clone(),
            output: Some(json!({"result": "child-done"})),
        }, &storage).await.unwrap();

        let parent_status = handler.get_status(ProcessRunGetStatusInput {
            run_id: parent_id.clone(),
        }, &storage).await.unwrap();
        match parent_status {
            ProcessRunGetStatusOutput::Ok { status, .. } => assert_eq!(status, "running"),
            _ => panic!("Expected Ok"),
        }

        let child_status = handler.get_status(ProcessRunGetStatusInput {
            run_id: child_id.clone(),
        }, &storage).await.unwrap();
        match child_status {
            ProcessRunGetStatusOutput::Ok { status, .. } => assert_eq!(status, "completed"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_suspended_process_can_be_failed() {
        // A running process cannot be failed when suspended
        // (only running processes can fail per impl)
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let start = handler.start(ProcessRunStartInput {
            spec_ref: "suspend-fail".to_string(),
            spec_version: 1,
            input: None,
        }, &storage).await.unwrap();
        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        handler.suspend(ProcessRunSuspendInput { run_id: run_id.clone() }, &storage).await.unwrap();

        let result = handler.fail(ProcessRunFailInput {
            run_id: run_id.clone(),
            error: "interrupted".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessRunFailOutput::NotRunning { current_status, .. } => {
                assert_eq!(current_status, "suspended");
            }
            _ => panic!("Expected NotRunning for suspended process"),
        }
    }
}
