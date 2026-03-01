// WorkItem concept implementation
// Manages human-assigned work items through their full lifecycle:
// open -> claimed -> in_progress -> completed/rejected, with delegation and release support.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WorkItemHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("wi-{}", n)
}

pub struct WorkItemHandlerImpl;

#[async_trait]
impl WorkItemHandler for WorkItemHandlerImpl {
    async fn create(
        &self,
        input: WorkItemCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemCreateOutput, Box<dyn std::error::Error>> {
        if input.title.is_empty() {
            return Ok(WorkItemCreateOutput::ValidationError {
                message: "Title must not be empty".to_string(),
            });
        }

        let work_item_id = next_id();
        let status = if input.assigned_to.is_some() { "claimed" } else { "open" };

        storage.put("work_item", &work_item_id, json!({
            "workItemId": work_item_id,
            "title": input.title,
            "description": input.description,
            "priority": input.priority,
            "status": status,
            "assignedTo": input.assigned_to,
            "dueDate": input.due_date,
            "createdAt": chrono::Utc::now().to_rfc3339(),
            "updatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(WorkItemCreateOutput::Ok {
            work_item_id,
            status: status.to_string(),
        })
    }

    async fn claim(
        &self,
        input: WorkItemClaimInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemClaimOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("work_item", &input.work_item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(WorkItemClaimOutput::NotFound {
                work_item_id: input.work_item_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status == "claimed" || status == "in_progress" {
            let current_owner = record["assignedTo"].as_str().unwrap_or("unknown").to_string();
            return Ok(WorkItemClaimOutput::AlreadyClaimed {
                work_item_id: input.work_item_id,
                current_owner,
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("claimed");
        updated["assignedTo"] = json!(input.claimed_by.clone());
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("work_item", &input.work_item_id, updated).await?;

        Ok(WorkItemClaimOutput::Ok {
            work_item_id: input.work_item_id,
            claimed_by: input.claimed_by,
        })
    }

    async fn start(
        &self,
        input: WorkItemStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemStartOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("work_item", &input.work_item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(WorkItemStartOutput::NotFound {
                work_item_id: input.work_item_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "claimed" {
            return Ok(WorkItemStartOutput::NotClaimed {
                work_item_id: input.work_item_id,
                message: format!("Work item must be in 'claimed' state to start, currently '{}'", status),
            });
        }

        let assigned = record["assignedTo"].as_str().unwrap_or("");
        if assigned != input.started_by {
            return Ok(WorkItemStartOutput::NotClaimed {
                work_item_id: input.work_item_id,
                message: format!("Only the assigned user '{}' can start this work item", assigned),
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("in_progress");
        updated["startedAt"] = json!(chrono::Utc::now().to_rfc3339());
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("work_item", &input.work_item_id, updated).await?;

        Ok(WorkItemStartOutput::Ok {
            work_item_id: input.work_item_id,
            status: "in_progress".to_string(),
        })
    }

    async fn complete(
        &self,
        input: WorkItemCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemCompleteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("work_item", &input.work_item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(WorkItemCompleteOutput::NotFound {
                work_item_id: input.work_item_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "in_progress" {
            return Ok(WorkItemCompleteOutput::InvalidState {
                work_item_id: input.work_item_id,
                current_status: status.to_string(),
                message: "Work item must be in 'in_progress' state to complete".to_string(),
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("completed");
        updated["completedBy"] = json!(input.completed_by);
        updated["result"] = json!(input.result);
        updated["completedAt"] = json!(chrono::Utc::now().to_rfc3339());
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("work_item", &input.work_item_id, updated).await?;

        Ok(WorkItemCompleteOutput::Ok {
            work_item_id: input.work_item_id,
            status: "completed".to_string(),
        })
    }

    async fn reject(
        &self,
        input: WorkItemRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemRejectOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("work_item", &input.work_item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(WorkItemRejectOutput::NotFound {
                work_item_id: input.work_item_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status == "completed" || status == "rejected" {
            return Ok(WorkItemRejectOutput::InvalidState {
                work_item_id: input.work_item_id,
                current_status: status.to_string(),
                message: format!("Cannot reject a work item in '{}' state", status),
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("rejected");
        updated["rejectedBy"] = json!(input.rejected_by);
        updated["rejectionReason"] = json!(input.reason);
        updated["rejectedAt"] = json!(chrono::Utc::now().to_rfc3339());
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("work_item", &input.work_item_id, updated).await?;

        Ok(WorkItemRejectOutput::Ok {
            work_item_id: input.work_item_id,
            status: "rejected".to_string(),
        })
    }

    async fn delegate(
        &self,
        input: WorkItemDelegateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemDelegateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("work_item", &input.work_item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(WorkItemDelegateOutput::NotFound {
                work_item_id: input.work_item_id,
            }),
        };

        let assigned = record["assignedTo"].as_str().unwrap_or("");
        if assigned != input.delegated_by {
            return Ok(WorkItemDelegateOutput::NotOwner {
                work_item_id: input.work_item_id,
                message: format!("Only the current assignee '{}' can delegate this work item", assigned),
            });
        }

        let mut updated = record.clone();
        updated["assignedTo"] = json!(input.delegate_to.clone());
        updated["delegatedFrom"] = json!(input.delegated_by);
        updated["delegationReason"] = json!(input.reason);
        updated["status"] = json!("claimed");
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("work_item", &input.work_item_id, updated).await?;

        Ok(WorkItemDelegateOutput::Ok {
            work_item_id: input.work_item_id,
            delegated_to: input.delegate_to,
        })
    }

    async fn release(
        &self,
        input: WorkItemReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WorkItemReleaseOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("work_item", &input.work_item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(WorkItemReleaseOutput::NotFound {
                work_item_id: input.work_item_id,
            }),
        };

        let assigned = record["assignedTo"].as_str().unwrap_or("");
        if assigned != input.released_by {
            return Ok(WorkItemReleaseOutput::NotOwner {
                work_item_id: input.work_item_id,
                message: format!("Only the current assignee '{}' can release this work item", assigned),
            });
        }

        let mut updated = record.clone();
        updated["assignedTo"] = json!(null);
        updated["status"] = json!("open");
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("work_item", &input.work_item_id, updated).await?;

        Ok(WorkItemReleaseOutput::Ok {
            work_item_id: input.work_item_id,
            status: "open".to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_work_item() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let result = handler.create(
            WorkItemCreateInput {
                title: "Fix login bug".into(),
                description: "Users cannot log in with SSO".into(),
                priority: "high".into(),
                assigned_to: None,
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemCreateOutput::Ok { work_item_id, status } => {
                assert!(!work_item_id.is_empty());
                assert_eq!(status, "open");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_with_assignment() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let result = handler.create(
            WorkItemCreateInput {
                title: "Review PR".into(),
                description: "Review pull request #42".into(),
                priority: "medium".into(),
                assigned_to: Some("alice".into()),
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemCreateOutput::Ok { status, .. } => {
                assert_eq!(status, "claimed");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_empty_title_fails() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let result = handler.create(
            WorkItemCreateInput {
                title: "".into(),
                description: "desc".into(),
                priority: "low".into(),
                assigned_to: None,
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemCreateOutput::ValidationError { message } => {
                assert!(message.contains("Title"));
            }
            _ => panic!("Expected ValidationError variant"),
        }
    }

    #[tokio::test]
    async fn test_claim_and_start_lifecycle() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Task".into(),
                description: "Do something".into(),
                priority: "low".into(),
                assigned_to: None,
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let claim_result = handler.claim(
            WorkItemClaimInput { work_item_id: wi_id.clone(), claimed_by: "bob".into() },
            &storage,
        ).await.unwrap();
        match claim_result {
            WorkItemClaimOutput::Ok { claimed_by, .. } => assert_eq!(claimed_by, "bob"),
            _ => panic!("Expected Ok variant"),
        }

        let start_result = handler.start(
            WorkItemStartInput { work_item_id: wi_id.clone(), started_by: "bob".into() },
            &storage,
        ).await.unwrap();
        match start_result {
            WorkItemStartOutput::Ok { status, .. } => assert_eq!(status, "in_progress"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_complete_requires_in_progress() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Task".into(),
                description: "".into(),
                priority: "low".into(),
                assigned_to: None,
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.complete(
            WorkItemCompleteInput { work_item_id: wi_id.clone(), completed_by: "bob".into(), result: None },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemCompleteOutput::InvalidState { current_status, .. } => {
                assert_eq!(current_status, "open");
            }
            _ => panic!("Expected InvalidState variant"),
        }
    }

    #[tokio::test]
    async fn test_delegate_work_item() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Delegatable task".into(),
                description: "".into(),
                priority: "medium".into(),
                assigned_to: Some("alice".into()),
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.delegate(
            WorkItemDelegateInput {
                work_item_id: wi_id.clone(),
                delegated_by: "alice".into(),
                delegate_to: "charlie".into(),
                reason: Some("Out of office".into()),
            },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemDelegateOutput::Ok { delegated_to, .. } => assert_eq!(delegated_to, "charlie"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_release_work_item() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Releasable task".into(),
                description: "".into(),
                priority: "low".into(),
                assigned_to: Some("alice".into()),
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.release(
            WorkItemReleaseInput { work_item_id: wi_id.clone(), released_by: "alice".into() },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemReleaseOutput::Ok { status, .. } => assert_eq!(status, "open"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_claim_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;
        let result = handler.claim(
            WorkItemClaimInput { work_item_id: "nonexistent".into(), claimed_by: "bob".into() },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemClaimOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_reject_completed_fails() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Task".into(), description: "".into(), priority: "low".into(),
                assigned_to: Some("alice".into()), due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result { WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id, _ => panic!("Expected Ok") };

        handler.start(WorkItemStartInput { work_item_id: wi_id.clone(), started_by: "alice".into() }, &storage).await.unwrap();
        handler.complete(WorkItemCompleteInput { work_item_id: wi_id.clone(), completed_by: "alice".into(), result: None }, &storage).await.unwrap();

        let result = handler.reject(
            WorkItemRejectInput { work_item_id: wi_id.clone(), rejected_by: "bob".into(), reason: "Too late".into() },
            &storage,
        ).await.unwrap();
        match result {
            WorkItemRejectOutput::InvalidState { current_status, .. } => {
                assert_eq!(current_status, "completed");
            }
            _ => panic!("Expected InvalidState variant"),
        }
    }
}
