// Approval concept conformance tests
// Validates approval workflow invariants: multi-approver consensus,
// denial short-circuits, timeout transitions, and authorization checks.

#[cfg(test)]
mod tests {
    use super::super::handler::ApprovalHandler;
    use super::super::r#impl::ApprovalHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn approval_multi_approver_consensus_invariant() {
        // Invariant: all designated approvers must approve for status to become "approved"
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Deploy".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into(), "carol".into()],
                description: "Multi-approver test".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        let id = match req {
            ApprovalRequestOutput::Ok { approval_id, status } => {
                assert_eq!(status, "pending");
                approval_id
            }
            other => panic!("Expected Ok, got {:?}", other),
        };

        // First approver: status should remain pending
        let first = handler.approve(
            ApprovalApproveInput { approval_id: id.clone(), approver: "bob".into(), comment: None },
            &storage,
        ).await.unwrap();
        match first {
            ApprovalApproveOutput::Ok { status, .. } => assert_eq!(status, "pending"),
            other => panic!("Expected Ok, got {:?}", other),
        }

        // Second approver: status should become approved
        let second = handler.approve(
            ApprovalApproveInput { approval_id: id.clone(), approver: "carol".into(), comment: None },
            &storage,
        ).await.unwrap();
        match second {
            ApprovalApproveOutput::Ok { status, .. } => assert_eq!(status, "approved"),
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn approval_deny_is_terminal_invariant() {
        // Invariant: once denied, further approvals are rejected
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Feature".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into(), "carol".into()],
                description: "".into(),
                timeout_seconds: None,
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, other => panic!("Expected Ok, got {:?}", other) };

        handler.deny(
            ApprovalDenyInput { approval_id: id.clone(), approver: "bob".into(), reason: "Not ready".into() },
            &storage,
        ).await.unwrap();

        let approve_after_deny = handler.approve(
            ApprovalApproveInput { approval_id: id.clone(), approver: "carol".into(), comment: None },
            &storage,
        ).await.unwrap();
        match approve_after_deny {
            ApprovalApproveOutput::AlreadyResolved { current_status, .. } => {
                assert_eq!(current_status, "denied");
            }
            other => panic!("Expected AlreadyResolved, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn approval_timeout_is_terminal_invariant() {
        // Invariant: after timeout, no further decisions can be recorded
        let storage = InMemoryStorage::new();
        let handler = ApprovalHandlerImpl;

        let req = handler.request(
            ApprovalRequestInput {
                subject: "Urgent".into(),
                requester: "alice".into(),
                approvers: vec!["bob".into()],
                description: "".into(),
                timeout_seconds: Some(1),
            },
            &storage,
        ).await.unwrap();
        let id = match req { ApprovalRequestOutput::Ok { approval_id, .. } => approval_id, other => panic!("Expected Ok, got {:?}", other) };

        handler.timeout(ApprovalTimeoutInput { approval_id: id.clone() }, &storage).await.unwrap();

        let result = handler.approve(
            ApprovalApproveInput { approval_id: id.clone(), approver: "bob".into(), comment: None },
            &storage,
        ).await.unwrap();
        match result {
            ApprovalApproveOutput::AlreadyResolved { current_status, .. } => {
                assert_eq!(current_status, "timed_out");
            }
            other => panic!("Expected AlreadyResolved, got {:?}", other),
        }
    }
}
