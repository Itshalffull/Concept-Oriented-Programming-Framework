// ProcessRun concept implementation
// Tracks the lifecycle of a running process instance from start to completion,
// failure, or cancellation, including parent-child relationships for subprocess nesting.
// Status transitions: pending -> running -> suspended -> running (resume)
//                     running|suspended -> completed|failed|cancelled

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProcessRunHandler;
use serde_json::json;

pub struct ProcessRunHandlerImpl;

fn generate_run_id() -> String {
    format!("run-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl ProcessRunHandler for ProcessRunHandlerImpl {
    async fn start(
        &self,
        input: ProcessRunStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunStartOutput, Box<dyn std::error::Error>> {
        if input.spec_ref.is_empty() {
            return Ok(ProcessRunStartOutput::InvalidSpec {
                spec_ref: input.spec_ref,
            });
        }

        let run_id = generate_run_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("process_runs", &run_id, json!({
            "run_id": run_id,
            "spec_ref": input.spec_ref,
            "spec_version": input.spec_version,
            "status": "running",
            "parent_run": null,
            "input": input.input,
            "output": null,
            "error": null,
            "started_at": timestamp,
            "ended_at": null,
        })).await?;

        Ok(ProcessRunStartOutput::Ok {
            run_id,
            spec_ref: input.spec_ref,
            status: "running".to_string(),
        })
    }

    async fn start_child(
        &self,
        input: ProcessRunStartChildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunStartChildOutput, Box<dyn std::error::Error>> {
        if input.spec_ref.is_empty() {
            return Ok(ProcessRunStartChildOutput::InvalidSpec {
                spec_ref: input.spec_ref,
            });
        }

        let run_id = generate_run_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("process_runs", &run_id, json!({
            "run_id": run_id,
            "spec_ref": input.spec_ref,
            "spec_version": input.spec_version,
            "status": "running",
            "parent_run": input.parent_run,
            "input": input.input,
            "output": null,
            "error": null,
            "started_at": timestamp,
            "ended_at": null,
        })).await?;

        Ok(ProcessRunStartChildOutput::Ok {
            run_id,
            parent_run: input.parent_run,
            status: "running".to_string(),
        })
    }

    async fn complete(
        &self,
        input: ProcessRunCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunCompleteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_runs", &input.run_id).await?;

        match existing {
            None => Ok(ProcessRunCompleteOutput::NotFound {
                run_id: input.run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "running" {
                    return Ok(ProcessRunCompleteOutput::NotRunning {
                        run_id: input.run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("completed"));
                    obj.insert("output".to_string(), json!(input.output));
                    obj.insert("ended_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("process_runs", &input.run_id, updated).await?;

                Ok(ProcessRunCompleteOutput::Ok {
                    run_id: input.run_id,
                    status: "completed".to_string(),
                })
            }
        }
    }

    async fn fail(
        &self,
        input: ProcessRunFailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunFailOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_runs", &input.run_id).await?;

        match existing {
            None => Ok(ProcessRunFailOutput::NotFound {
                run_id: input.run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "running" {
                    return Ok(ProcessRunFailOutput::NotRunning {
                        run_id: input.run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("failed"));
                    obj.insert("error".to_string(), json!(input.error));
                    obj.insert("ended_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("process_runs", &input.run_id, updated).await?;

                Ok(ProcessRunFailOutput::Ok {
                    run_id: input.run_id,
                    error: input.error,
                    status: "failed".to_string(),
                })
            }
        }
    }

    async fn cancel(
        &self,
        input: ProcessRunCancelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunCancelOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_runs", &input.run_id).await?;

        match existing {
            None => Ok(ProcessRunCancelOutput::NotFound {
                run_id: input.run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "running" && current_status != "suspended" {
                    return Ok(ProcessRunCancelOutput::NotCancellable {
                        run_id: input.run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("cancelled"));
                    obj.insert("ended_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("process_runs", &input.run_id, updated).await?;

                Ok(ProcessRunCancelOutput::Ok {
                    run_id: input.run_id,
                    status: "cancelled".to_string(),
                })
            }
        }
    }

    async fn suspend(
        &self,
        input: ProcessRunSuspendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunSuspendOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_runs", &input.run_id).await?;

        match existing {
            None => Ok(ProcessRunSuspendOutput::NotFound {
                run_id: input.run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "running" {
                    return Ok(ProcessRunSuspendOutput::NotRunning {
                        run_id: input.run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("suspended"));
                    obj.insert("suspended_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("process_runs", &input.run_id, updated).await?;

                Ok(ProcessRunSuspendOutput::Ok {
                    run_id: input.run_id,
                    status: "suspended".to_string(),
                })
            }
        }
    }

    async fn resume(
        &self,
        input: ProcessRunResumeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunResumeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_runs", &input.run_id).await?;

        match existing {
            None => Ok(ProcessRunResumeOutput::NotFound {
                run_id: input.run_id,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "suspended" {
                    return Ok(ProcessRunResumeOutput::NotSuspended {
                        run_id: input.run_id,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("running"));
                    obj.insert("resumed_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("process_runs", &input.run_id, updated).await?;

                Ok(ProcessRunResumeOutput::Ok {
                    run_id: input.run_id,
                    status: "running".to_string(),
                })
            }
        }
    }

    async fn get_status(
        &self,
        input: ProcessRunGetStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunGetStatusOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_runs", &input.run_id).await?;

        match existing {
            None => Ok(ProcessRunGetStatusOutput::NotFound {
                run_id: input.run_id,
            }),
            Some(record) => Ok(ProcessRunGetStatusOutput::Ok {
                run_id: input.run_id,
                status: record["status"].as_str().unwrap_or("unknown").to_string(),
                spec_ref: record["spec_ref"].as_str().unwrap_or("").to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_start_creates_running_process() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;
        let result = handler.start(
            ProcessRunStartInput {
                spec_ref: "onboard".to_string(),
                spec_version: 1,
                input: Some(json!({ "user": "alice" })),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessRunStartOutput::Ok { run_id, spec_ref, status } => {
                assert!(run_id.starts_with("run-"));
                assert_eq!(spec_ref, "onboard");
                assert_eq!(status, "running");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_start_child_links_parent() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let parent = handler.start(
            ProcessRunStartInput {
                spec_ref: "main".to_string(),
                spec_version: 1,
                input: None,
            },
            &storage,
        ).await.unwrap();
        let parent_id = match parent {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        let child = handler.start_child(
            ProcessRunStartChildInput {
                spec_ref: "sub-process".to_string(),
                spec_version: 1,
                parent_run: parent_id.clone(),
                input: None,
            },
            &storage,
        ).await.unwrap();
        match child {
            ProcessRunStartChildOutput::Ok { parent_run, status, .. } => {
                assert_eq!(parent_run, parent_id);
                assert_eq!(status, "running");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_complete_running_process() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

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

        let result = handler.complete(
            ProcessRunCompleteInput {
                run_id: run_id.clone(),
                output: Some(json!({ "result": "done" })),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessRunCompleteOutput::Ok { status, .. } => {
                assert_eq!(status, "completed");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_fail_running_process() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let start = handler.start(
            ProcessRunStartInput {
                spec_ref: "risky".to_string(),
                spec_version: 1,
                input: None,
            },
            &storage,
        ).await.unwrap();
        let run_id = match start {
            ProcessRunStartOutput::Ok { run_id, .. } => run_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.fail(
            ProcessRunFailInput {
                run_id: run_id.clone(),
                error: "step timeout".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessRunFailOutput::Ok { status, error, .. } => {
                assert_eq!(status, "failed");
                assert_eq!(error, "step timeout");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_suspend_and_resume() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

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

        let suspend = handler.suspend(
            ProcessRunSuspendInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();
        match suspend {
            ProcessRunSuspendOutput::Ok { status, .. } => assert_eq!(status, "suspended"),
            _ => panic!("Expected Ok"),
        }

        let resume = handler.resume(
            ProcessRunResumeInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();
        match resume {
            ProcessRunResumeOutput::Ok { status, .. } => assert_eq!(status, "running"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_cancel_from_suspended() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;

        let start = handler.start(
            ProcessRunStartInput {
                spec_ref: "s".to_string(),
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

        let result = handler.cancel(
            ProcessRunCancelInput { run_id: run_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ProcessRunCancelOutput::Ok { status, .. } => assert_eq!(status, "cancelled"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_status_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessRunHandlerImpl;
        let result = handler.get_status(
            ProcessRunGetStatusInput { run_id: "run-nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProcessRunGetStatusOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }
}
