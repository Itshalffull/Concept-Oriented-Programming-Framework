// Approval concept implementation
// Manages multi-approver approval workflows with support for approve, deny,
// request changes, and timeout transitions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ApprovalHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("appr-{}", n)
}

pub struct ApprovalHandlerImpl;

#[async_trait]
impl ApprovalHandler for ApprovalHandlerImpl {
    async fn request(
        &self,
        input: ApprovalRequestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalRequestOutput, Box<dyn std::error::Error>> {
        if input.approvers.is_empty() {
            return Ok(ApprovalRequestOutput::ValidationError {
                message: "At least one approver is required".to_string(),
            });
        }
        if input.subject.is_empty() {
            return Ok(ApprovalRequestOutput::ValidationError {
                message: "Subject must not be empty".to_string(),
            });
        }

        let approval_id = next_id();
        let approvers_json = serde_json::to_string(&input.approvers)?;

        storage.put("approval", &approval_id, json!({
            "approvalId": approval_id,
            "subject": input.subject,
            "requester": input.requester,
            "approvers": approvers_json,
            "description": input.description,
            "timeoutSeconds": input.timeout_seconds,
            "status": "pending",
            "decisions": "[]",
            "createdAt": chrono::Utc::now().to_rfc3339(),
            "updatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(ApprovalRequestOutput::Ok {
            approval_id,
            status: "pending".to_string(),
        })
    }

    async fn approve(
        &self,
        input: ApprovalApproveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalApproveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("approval", &input.approval_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ApprovalApproveOutput::NotFound {
                approval_id: input.approval_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "pending" && status != "changes_requested" {
            return Ok(ApprovalApproveOutput::AlreadyResolved {
                approval_id: input.approval_id,
                current_status: status.to_string(),
            });
        }

        let approvers: Vec<String> = serde_json::from_str(
            record["approvers"].as_str().unwrap_or("[]")
        )?;
        if !approvers.contains(&input.approver) {
            return Ok(ApprovalApproveOutput::NotAuthorized {
                approval_id: input.approval_id,
                message: format!("'{}' is not a designated approver", input.approver),
            });
        }

        let mut decisions: Vec<serde_json::Value> = serde_json::from_str(
            record["decisions"].as_str().unwrap_or("[]")
        )?;
        decisions.push(json!({
            "approver": input.approver,
            "decision": "approved",
            "comment": input.comment,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

        // Check if all approvers have approved
        let approved_set: std::collections::HashSet<String> = decisions.iter()
            .filter(|d| d["decision"].as_str() == Some("approved"))
            .filter_map(|d| d["approver"].as_str().map(|s| s.to_string()))
            .collect();
        let all_approved = approvers.iter().all(|a| approved_set.contains(a));
        let new_status = if all_approved { "approved" } else { "pending" };

        let mut updated = record.clone();
        updated["decisions"] = json!(serde_json::to_string(&decisions)?);
        updated["status"] = json!(new_status);
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("approval", &input.approval_id, updated).await?;

        Ok(ApprovalApproveOutput::Ok {
            approval_id: input.approval_id,
            status: new_status.to_string(),
        })
    }

    async fn deny(
        &self,
        input: ApprovalDenyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalDenyOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("approval", &input.approval_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ApprovalDenyOutput::NotFound {
                approval_id: input.approval_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "pending" && status != "changes_requested" {
            return Ok(ApprovalDenyOutput::AlreadyResolved {
                approval_id: input.approval_id,
                current_status: status.to_string(),
            });
        }

        let approvers: Vec<String> = serde_json::from_str(
            record["approvers"].as_str().unwrap_or("[]")
        )?;
        if !approvers.contains(&input.approver) {
            return Ok(ApprovalDenyOutput::NotAuthorized {
                approval_id: input.approval_id,
                message: format!("'{}' is not a designated approver", input.approver),
            });
        }

        let mut decisions: Vec<serde_json::Value> = serde_json::from_str(
            record["decisions"].as_str().unwrap_or("[]")
        )?;
        decisions.push(json!({
            "approver": input.approver,
            "decision": "denied",
            "reason": input.reason,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

        let mut updated = record.clone();
        updated["decisions"] = json!(serde_json::to_string(&decisions)?);
        updated["status"] = json!("denied");
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("approval", &input.approval_id, updated).await?;

        Ok(ApprovalDenyOutput::Ok {
            approval_id: input.approval_id,
            status: "denied".to_string(),
        })
    }

    async fn request_changes(
        &self,
        input: ApprovalRequestChangesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalRequestChangesOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("approval", &input.approval_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ApprovalRequestChangesOutput::NotFound {
                approval_id: input.approval_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "pending" && status != "changes_requested" {
            return Ok(ApprovalRequestChangesOutput::AlreadyResolved {
                approval_id: input.approval_id,
                current_status: status.to_string(),
            });
        }

        let approvers: Vec<String> = serde_json::from_str(
            record["approvers"].as_str().unwrap_or("[]")
        )?;
        if !approvers.contains(&input.approver) {
            return Ok(ApprovalRequestChangesOutput::NotAuthorized {
                approval_id: input.approval_id,
                message: format!("'{}' is not a designated approver", input.approver),
            });
        }

        let mut decisions: Vec<serde_json::Value> = serde_json::from_str(
            record["decisions"].as_str().unwrap_or("[]")
        )?;
        decisions.push(json!({
            "approver": input.approver,
            "decision": "changes_requested",
            "requestedChanges": input.requested_changes,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

        let mut updated = record.clone();
        updated["decisions"] = json!(serde_json::to_string(&decisions)?);
        updated["status"] = json!("changes_requested");
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("approval", &input.approval_id, updated).await?;

        Ok(ApprovalRequestChangesOutput::Ok {
            approval_id: input.approval_id,
            status: "changes_requested".to_string(),
        })
    }

    async fn timeout(
        &self,
        input: ApprovalTimeoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalTimeoutOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("approval", &input.approval_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ApprovalTimeoutOutput::NotFound {
                approval_id: input.approval_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "pending" && status != "changes_requested" {
            return Ok(ApprovalTimeoutOutput::AlreadyResolved {
                approval_id: input.approval_id,
                current_status: status.to_string(),
            });
        }

        let mut updated = record.clone();
        updated["status"] = json!("timed_out");
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("approval", &input.approval_id, updated).await?;

        Ok(ApprovalTimeoutOutput::Ok {
            approval_id: input.approval_id,
            status: "timed_out".to_string(),
        })
    }

    async fn get_status(
        &self,
        input: ApprovalGetStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalGetStatusOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("approval", &input.approval_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(ApprovalGetStatusOutput::NotFound {
                approval_id: input.approval_id,
            }),
        };

        Ok(ApprovalGetStatusOutput::Ok {
            approval_id: input.approval_id,
            status: record["status"].as_str().unwrap_or("").to_string(),
            approvers: record["approvers"].as_str().unwrap_or("[]").to_string(),
            decisions: record["decisions"].as_str().unwrap_or("[]").to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_request_approval() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;
        let result = handler.request(
            ApprovalRequestInput {
                subject: "Deploy v2.0".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into(), "carol".into()],
                description: "Production deployment".into(),
                timeout_seconds: Some(3600),
            },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalRequestOutput::Ok { approval_id, status } => {
                assert!(!approval_id.is_empty());
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_request_no_approvers_fails() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;
        let result = handler.request(
            ApprovalRequestInput {
                subject: "Test".into(),
                requester: "alice".into(),
                approvers: vec![],
                description: "".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalRequestOutput::ValidationError { message } => {
                assert!(message.contains("approver"));
            }
            _ => panic!("Expected ValidationError variant"),
        }
    }

    #[tokio::test]
    async fn test_approve_single_approver() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Change".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into()],
                description: "".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, _ => panic!("Expected Ok") };

        let result = handler.approve(
            ApprovalApproveInput { approval_id: id.clone(), approver: "bob".into(), comment: None },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalApproveOutput::Ok { status, .. } => assert_eq!(status, "approved"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deny_approval() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Risky change".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into()],
                description: "".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, _ => panic!("Expected Ok") };

        let result = handler.deny(
            ApprovalDenyInput { approval_id: id.clone(), approver: "bob".into(), reason: "Too risky".into() },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalDenyOutput::Ok { status, .. } => assert_eq!(status, "denied"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_request_changes() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Feature".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into()],
                description: "".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, _ => panic!("Expected Ok") };

        let result = handler.request_changes(
            ApprovalRequestChangesInput {
                approval_id: id.clone(),
                approver: "bob".into(),
                requested_changes: "Add tests".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalRequestChangesOutput::Ok { status, .. } => assert_eq!(status, "changes_requested"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_timeout_approval() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Urgent".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into()],
                description: "".into(),
                timeout_seconds: Some(60),
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, _ => panic!("Expected Ok") };

        let result = handler.timeout(
            ApprovalTimeoutInput { approval_id: id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalTimeoutOutput::Ok { status, .. } => assert_eq!(status, "timed_out"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_status() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Check".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into()],
                description: "".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, _ => panic!("Expected Ok") };

        let result = handler.get_status(
            ApprovalGetStatusInput { approval_id: id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalGetStatusOutput::Ok { status, .. } => assert_eq!(status, "pending"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_unauthorized_approver() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Secret".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into()],
                description: "".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, _ => panic!("Expected Ok") };

        let result = handler.approve(
            ApprovalApproveInput { approval_id: id.clone(), approver: "eve".into(), comment: None },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalApproveOutput::NotAuthorized { .. } => {}
            _ => panic!("Expected NotAuthorized variant"),
        }
    }
}
