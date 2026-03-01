// StepRun concept implementation
// Tracks individual step execution within a process run.
// Status transitions: pending -> running -> completed|failed|cancelled|skipped.
// Only running steps can be completed, failed, or cancelled.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::StepRunHandler;
use serde_json::json;

pub struct StepRunHandlerImpl;

fn generate_step_run_id() -> String {
    format!("sr-{}", uuid::Uuid::new_v4())
}

fn step_run_key(run_ref: &str, step_run_id: &str) -> String {
    format!("{}::{}", run_ref, step_run_id)
}

/// Valid terminal statuses that prevent further transitions
fn is_terminal(status: &str) -> bool {
    matches!(status, "completed" | "failed" | "cancelled" | "skipped")
}

#[async_trait]
impl StepRunHandler for StepRunHandlerImpl {
    async fn start(
        &self,
        input: StepRunStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunStartOutput, Box<dyn std::error::Error>> {
        // Check if there is already a running step for this step_ref in this run
        let existing_steps = storage.find("step_runs", Some(&json!({
            "run_ref": input.run_ref,
            "step_ref": input.step_ref,
        }))).await?;

        for step in &existing_steps {
            if step["status"].as_str() == Some("running") {
                let existing_id = step["step_run_id"].as_str().unwrap_or("").to_string();
                return Ok(StepRunStartOutput::AlreadyRunning {
                    step_run_id: existing_id,
                    step_ref: input.step_ref,
                });
            }
        }

        let step_run_id = generate_step_run_id();
        let key = step_run_key(&input.run_ref, &step_run_id);
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("step_runs", &key, json!({
            "step_run_id": step_run_id,
            "run_ref": input.run_ref,
            "step_ref": input.step_ref,
            "status": "running",
            "input": input.input.unwrap_or(json!({})),
            "output": json!(null),
            "started_at": timestamp,
        })).await?;

        Ok(StepRunStartOutput::Ok {
            step_run_id,
            status: "running".to_string(),
        })
    }

    async fn complete(
        &self,
        input: StepRunCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunCompleteOutput, Box<dyn std::error::Error>> {
        let key = step_run_key(&input.run_ref, &input.step_run_id);
        let existing = storage.get("step_runs", &key).await?;

        match existing {
            None => Ok(StepRunCompleteOutput::NotFound {
                step_run_id: input.step_run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "running" {
                    return Ok(StepRunCompleteOutput::InvalidTransition {
                        step_run_id: input.step_run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("completed"));
                    obj.insert("output".to_string(), input.output.unwrap_or(json!({})));
                    obj.insert("completed_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("step_runs", &key, updated).await?;

                Ok(StepRunCompleteOutput::Ok {
                    step_run_id: input.step_run_id,
                    status: "completed".to_string(),
                })
            }
        }
    }

    async fn fail(
        &self,
        input: StepRunFailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunFailOutput, Box<dyn std::error::Error>> {
        let key = step_run_key(&input.run_ref, &input.step_run_id);
        let existing = storage.get("step_runs", &key).await?;

        match existing {
            None => Ok(StepRunFailOutput::NotFound {
                step_run_id: input.step_run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "running" {
                    return Ok(StepRunFailOutput::InvalidTransition {
                        step_run_id: input.step_run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("failed"));
                    obj.insert("error".to_string(), json!(input.error));
                    if let Some(code) = &input.error_code {
                        obj.insert("error_code".to_string(), json!(code));
                    }
                    obj.insert("failed_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("step_runs", &key, updated).await?;

                Ok(StepRunFailOutput::Ok {
                    step_run_id: input.step_run_id,
                    status: "failed".to_string(),
                })
            }
        }
    }

    async fn cancel(
        &self,
        input: StepRunCancelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunCancelOutput, Box<dyn std::error::Error>> {
        let key = step_run_key(&input.run_ref, &input.step_run_id);
        let existing = storage.get("step_runs", &key).await?;

        match existing {
            None => Ok(StepRunCancelOutput::NotFound {
                step_run_id: input.step_run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "running" {
                    return Ok(StepRunCancelOutput::InvalidTransition {
                        step_run_id: input.step_run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("cancelled"));
                    if let Some(reason) = &input.reason {
                        obj.insert("cancel_reason".to_string(), json!(reason));
                    }
                    obj.insert("cancelled_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("step_runs", &key, updated).await?;

                Ok(StepRunCancelOutput::Ok {
                    step_run_id: input.step_run_id,
                    status: "cancelled".to_string(),
                })
            }
        }
    }

    async fn skip(
        &self,
        input: StepRunSkipInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunSkipOutput, Box<dyn std::error::Error>> {
        let step_run_id = generate_step_run_id();
        let key = step_run_key(&input.run_ref, &step_run_id);
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("step_runs", &key, json!({
            "step_run_id": step_run_id,
            "run_ref": input.run_ref,
            "step_ref": input.step_ref,
            "status": "skipped",
            "input": json!(null),
            "output": json!(null),
            "skip_reason": input.reason,
            "skipped_at": timestamp,
        })).await?;

        Ok(StepRunSkipOutput::Ok {
            step_run_id,
            status: "skipped".to_string(),
        })
    }

    async fn get(
        &self,
        input: StepRunGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StepRunGetOutput, Box<dyn std::error::Error>> {
        let key = step_run_key(&input.run_ref, &input.step_run_id);
        let record = storage.get("step_runs", &key).await?;

        match record {
            None => Ok(StepRunGetOutput::NotFound {
                step_run_id: input.step_run_id,
            }),
            Some(r) => Ok(StepRunGetOutput::Ok {
                step_run_id: r["step_run_id"].as_str().unwrap_or("").to_string(),
                run_ref: r["run_ref"].as_str().unwrap_or("").to_string(),
                step_ref: r["step_ref"].as_str().unwrap_or("").to_string(),
                status: r["status"].as_str().unwrap_or("").to_string(),
                input: r["input"].clone(),
                output: r["output"].clone(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_start_creates_running_step() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let result = handler.start(
            StepRunStartInput {
                run_ref: "run-001".to_string(),
                step_ref: "validate".to_string(),
                input: Some(json!({ "data": "payload" })),
            },
            &storage,
        ).await.unwrap();
        match result {
            StepRunStartOutput::Ok { step_run_id, status } => {
                assert!(step_run_id.starts_with("sr-"));
                assert_eq!(status, "running");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_complete_running_step() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-002".to_string(),
                step_ref: "process".to_string(),
                input: None,
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match start_result {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.complete(
            StepRunCompleteInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-002".to_string(),
                output: Some(json!({ "result": "success" })),
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunCompleteOutput::Ok { status, .. } => {
                assert_eq!(status, "completed");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_complete_already_completed_returns_invalid_transition() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-003".to_string(),
                step_ref: "task".to_string(),
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
                run_ref: "run-003".to_string(),
                output: None,
            },
            &storage,
        ).await.unwrap();

        let result = handler.complete(
            StepRunCompleteInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-003".to_string(),
                output: None,
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunCompleteOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected InvalidTransition variant"),
        }
    }

    #[tokio::test]
    async fn test_fail_running_step() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-004".to_string(),
                step_ref: "risky-step".to_string(),
                input: None,
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match start_result {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.fail(
            StepRunFailInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-004".to_string(),
                error: "timeout exceeded".to_string(),
                error_code: Some("TIMEOUT".to_string()),
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunFailOutput::Ok { status, .. } => {
                assert_eq!(status, "failed");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_cancel_running_step() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-005".to_string(),
                step_ref: "cancellable".to_string(),
                input: None,
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match start_result {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.cancel(
            StepRunCancelInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-005".to_string(),
                reason: Some("user requested".to_string()),
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunCancelOutput::Ok { status, .. } => {
                assert_eq!(status, "cancelled");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_skip_creates_skipped_step() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let result = handler.skip(
            StepRunSkipInput {
                run_ref: "run-006".to_string(),
                step_ref: "optional-step".to_string(),
                reason: Some("condition not met".to_string()),
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunSkipOutput::Ok { step_run_id, status } => {
                assert!(step_run_id.starts_with("sr-"));
                assert_eq!(status, "skipped");
            }
        }
    }

    #[tokio::test]
    async fn test_get_existing_step_run() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-007".to_string(),
                step_ref: "fetch-data".to_string(),
                input: Some(json!({ "url": "https://example.com" })),
            },
            &storage,
        ).await.unwrap();

        let step_run_id = match start_result {
            StepRunStartOutput::Ok { step_run_id, .. } => step_run_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.get(
            StepRunGetInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-007".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunGetOutput::Ok { step_ref, status, run_ref, .. } => {
                assert_eq!(step_ref, "fetch-data");
                assert_eq!(status, "running");
                assert_eq!(run_ref, "run-007");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let result = handler.get(
            StepRunGetInput {
                step_run_id: "sr-nonexistent".to_string(),
                run_ref: "run-008".to_string(),
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunGetOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_fail_completed_step_returns_invalid_transition() {
        let storage = InMemoryStorage::new();
        let handler = StepRunHandlerImpl;
        let start_result = handler.start(
            StepRunStartInput {
                run_ref: "run-009".to_string(),
                step_ref: "step-x".to_string(),
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
                run_ref: "run-009".to_string(),
                output: None,
            },
            &storage,
        ).await.unwrap();

        let result = handler.fail(
            StepRunFailInput {
                step_run_id: step_run_id.clone(),
                run_ref: "run-009".to_string(),
                error: "should not work".to_string(),
                error_code: None,
            },
            &storage,
        ).await.unwrap();

        match result {
            StepRunFailOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected InvalidTransition variant"),
        }
    }
}
