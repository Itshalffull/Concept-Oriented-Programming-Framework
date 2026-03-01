// Business logic tests for Approval concept.
// Validates multi-approver scenarios, delegation mechanics,
// terminal state enforcement, and ownership constraints.

#[cfg(test)]
mod tests {
    use super::super::handler::ApprovalHandler;
    use super::super::r#impl::ApprovalHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_approve_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let result = handler.approve(ApprovalApproveInput {
            approval_id: "appr-ghost".to_string(),
            decided_by: "alice".to_string(),
            comment: None,
        }, &storage).await.unwrap();
        match result {
            ApprovalApproveOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_reject_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let result = handler.reject(ApprovalRejectInput {
            approval_id: "appr-ghost".to_string(),
            decided_by: "alice".to_string(),
            reason: "test".to_string(),
        }, &storage).await.unwrap();
        match result {
            ApprovalRejectOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_approved_cannot_be_rejected() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(ApprovalRequestInput {
            subject: "Budget increase".to_string(),
            requested_by: "alice".to_string(),
            approvers: vec!["bob".to_string()],
            context: None,
        }, &storage).await.unwrap();
        let id = match req {
            ApprovalRequestOutput::Ok { approval_id, .. } => approval_id,
            _ => panic!("Expected Ok"),
        };

        handler.approve(ApprovalApproveInput {
            approval_id: id.clone(),
            decided_by: "bob".to_string(),
            comment: None,
        }, &storage).await.unwrap();

        let result = handler.reject(ApprovalRejectInput {
            approval_id: id.clone(),
            decided_by: "bob".to_string(),
            reason: "Changed my mind".to_string(),
        }, &storage).await.unwrap();
        match result {
            ApprovalRejectOutput::AlreadyDecided { current_status, .. } => {
                assert_eq!(current_status, "approved");
            }
            _ => panic!("Expected AlreadyDecided"),
        }
    }

    #[tokio::test]
    async fn test_rejected_cannot_be_approved() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(ApprovalRequestInput {
            subject: "Policy change".to_string(),
            requested_by: "alice".to_string(),
            approvers: vec!["bob".to_string()],
            context: None,
        }, &storage).await.unwrap();
        let id = match req {
            ApprovalRequestOutput::Ok { approval_id, .. } => approval_id,
            _ => panic!("Expected Ok"),
        };

        handler.reject(ApprovalRejectInput {
            approval_id: id.clone(),
            decided_by: "bob".to_string(),
            reason: "Policy violation".to_string(),
        }, &storage).await.unwrap();

        let result = handler.approve(ApprovalApproveInput {
            approval_id: id.clone(),
            decided_by: "bob".to_string(),
            comment: None,
        }, &storage).await.unwrap();
        match result {
            ApprovalApproveOutput::AlreadyDecided { current_status, .. } => {
                assert_eq!(current_status, "rejected");
            }
            _ => panic!("Expected AlreadyDecided"),
        }
    }

    #[tokio::test]
    async fn test_delegate_changes_approver() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(ApprovalRequestInput {
            subject: "Delegation test".to_string(),
            requested_by: "alice".to_string(),
            approvers: vec!["bob".to_string()],
            context: None,
        }, &storage).await.unwrap();
        let id = match req {
            ApprovalRequestOutput::Ok { approval_id, .. } => approval_id,
            _ => panic!("Expected Ok"),
        };

        let deleg = handler.delegate(ApprovalDelegateInput {
            approval_id: id.clone(),
            delegated_by: "bob".to_string(),
            delegate_to: "charlie".to_string(),
        }, &storage).await.unwrap();
        match deleg {
            ApprovalDelegateOutput::Ok { delegated_to, .. } => {
                assert_eq!(delegated_to, "charlie");
            }
            _ => panic!("Expected Ok"),
        }

        // charlie should now be able to approve
        let result = handler.approve(ApprovalApproveInput {
            approval_id: id.clone(),
            decided_by: "charlie".to_string(),
            comment: Some("Delegated approval".to_string()),
        }, &storage).await.unwrap();
        match result {
            ApprovalApproveOutput::Ok { status, .. } => assert_eq!(status, "approved"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_non_approver_cannot_delegate() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(ApprovalRequestInput {
            subject: "Access request".to_string(),
            requested_by: "alice".to_string(),
            approvers: vec!["bob".to_string()],
            context: None,
        }, &storage).await.unwrap();
        let id = match req {
            ApprovalRequestOutput::Ok { approval_id, .. } => approval_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.delegate(ApprovalDelegateInput {
            approval_id: id.clone(),
            delegated_by: "eve".to_string(),
            delegate_to: "charlie".to_string(),
        }, &storage).await.unwrap();
        match result {
            ApprovalDelegateOutput::NotApprover { .. } => {}
            _ => panic!("Expected NotApprover"),
        }
    }

    #[tokio::test]
    async fn test_approval_with_context_metadata() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let result = handler.request(ApprovalRequestInput {
            subject: "Deploy to production".to_string(),
            requested_by: "ci-pipeline".to_string(),
            approvers: vec!["lead".to_string(), "manager".to_string()],
            context: Some(json!({
                "environment": "production",
                "version": "2.1.0",
                "commit": "abc123"
            })),
        }, &storage).await.unwrap();
        match result {
            ApprovalRequestOutput::Ok { approval_id, status, .. } => {
                assert!(!approval_id.is_empty());
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_delegate_nonexistent_approval() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let result = handler.delegate(ApprovalDelegateInput {
            approval_id: "appr-missing".to_string(),
            delegated_by: "alice".to_string(),
            delegate_to: "bob".to_string(),
        }, &storage).await.unwrap();
        match result {
            ApprovalDelegateOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_approve_with_comment() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(ApprovalRequestInput {
            subject: "Comment test".to_string(),
            requested_by: "alice".to_string(),
            approvers: vec!["bob".to_string()],
            context: None,
        }, &storage).await.unwrap();
        let id = match req {
            ApprovalRequestOutput::Ok { approval_id, .. } => approval_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.approve(ApprovalApproveInput {
            approval_id: id.clone(),
            decided_by: "bob".to_string(),
            comment: Some("Looks good, approved with minor notes".to_string()),
        }, &storage).await.unwrap();
        match result {
            ApprovalApproveOutput::Ok { status, .. } => assert_eq!(status, "approved"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_double_approve_returns_already_decided() {
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(ApprovalRequestInput {
            subject: "Idempotency test".to_string(),
            requested_by: "alice".to_string(),
            approvers: vec!["bob".to_string()],
            context: None,
        }, &storage).await.unwrap();
        let id = match req {
            ApprovalRequestOutput::Ok { approval_id, .. } => approval_id,
            _ => panic!("Expected Ok"),
        };

        handler.approve(ApprovalApproveInput {
            approval_id: id.clone(),
            decided_by: "bob".to_string(),
            comment: None,
        }, &storage).await.unwrap();

        let result = handler.approve(ApprovalApproveInput {
            approval_id: id.clone(),
            decided_by: "bob".to_string(),
            comment: None,
        }, &storage).await.unwrap();
        match result {
            ApprovalApproveOutput::AlreadyDecided { .. } => {}
            _ => panic!("Expected AlreadyDecided"),
        }
    }
}
