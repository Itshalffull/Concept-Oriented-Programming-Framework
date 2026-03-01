// Business logic tests for WorkItem concept.
// Validates ownership enforcement, delegation chains,
// state machine transitions, and complex lifecycle scenarios.

#[cfg(test)]
mod tests {
    use super::super::handler::WorkItemHandler;
    use super::super::r#impl::WorkItemHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_full_lifecycle_open_to_completed() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Review document".into(),
            description: "Review Q4 financials".into(),
            priority: "high".into(),
            assigned_to: None,
            due_date: Some("2026-03-15".into()),
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, status } => {
                assert_eq!(status, "open");
                work_item_id
            }
            _ => panic!("Expected Ok"),
        };

        handler.claim(WorkItemClaimInput {
            work_item_id: wi_id.clone(),
            claimed_by: "alice".into(),
        }, &storage).await.unwrap();

        handler.start(WorkItemStartInput {
            work_item_id: wi_id.clone(),
            started_by: "alice".into(),
        }, &storage).await.unwrap();

        let complete = handler.complete(WorkItemCompleteInput {
            work_item_id: wi_id.clone(),
            completed_by: "alice".into(),
            result: Some(json!({"approved": true, "comments": "LGTM"})),
        }, &storage).await.unwrap();
        match complete {
            WorkItemCompleteOutput::Ok { status, .. } => assert_eq!(status, "completed"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_delegate_chain_preserves_state() {
        // alice -> bob -> charlie delegation chain
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Chain task".into(),
            description: "".into(),
            priority: "medium".into(),
            assigned_to: Some("alice".into()),
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        // alice delegates to bob
        handler.delegate(WorkItemDelegateInput {
            work_item_id: wi_id.clone(),
            delegated_by: "alice".into(),
            delegate_to: "bob".into(),
            reason: Some("On PTO".into()),
        }, &storage).await.unwrap();

        // bob delegates to charlie
        handler.delegate(WorkItemDelegateInput {
            work_item_id: wi_id.clone(),
            delegated_by: "bob".into(),
            delegate_to: "charlie".into(),
            reason: Some("Too busy".into()),
        }, &storage).await.unwrap();

        // charlie can start the work
        let start = handler.start(WorkItemStartInput {
            work_item_id: wi_id.clone(),
            started_by: "charlie".into(),
        }, &storage).await.unwrap();
        match start {
            WorkItemStartOutput::Ok { status, .. } => assert_eq!(status, "in_progress"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_wrong_person_cannot_start_work() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Assigned task".into(),
            description: "".into(),
            priority: "low".into(),
            assigned_to: Some("alice".into()),
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.start(WorkItemStartInput {
            work_item_id: wi_id.clone(),
            started_by: "bob".into(),
        }, &storage).await.unwrap();
        match result {
            WorkItemStartOutput::NotClaimed { message, .. } => {
                assert!(message.contains("alice"));
            }
            _ => panic!("Expected NotClaimed"),
        }
    }

    #[tokio::test]
    async fn test_release_and_reclaim_by_different_user() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Releasable".into(),
            description: "".into(),
            priority: "medium".into(),
            assigned_to: Some("alice".into()),
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        // alice releases
        handler.release(WorkItemReleaseInput {
            work_item_id: wi_id.clone(),
            released_by: "alice".into(),
        }, &storage).await.unwrap();

        // bob claims the released item
        let claim = handler.claim(WorkItemClaimInput {
            work_item_id: wi_id.clone(),
            claimed_by: "bob".into(),
        }, &storage).await.unwrap();
        match claim {
            WorkItemClaimOutput::Ok { claimed_by, .. } => assert_eq!(claimed_by, "bob"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_wrong_person_cannot_release() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Non-releasable by other".into(),
            description: "".into(),
            priority: "low".into(),
            assigned_to: Some("alice".into()),
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.release(WorkItemReleaseInput {
            work_item_id: wi_id.clone(),
            released_by: "eve".into(),
        }, &storage).await.unwrap();
        match result {
            WorkItemReleaseOutput::NotOwner { message, .. } => {
                assert!(message.contains("alice"));
            }
            _ => panic!("Expected NotOwner"),
        }
    }

    #[tokio::test]
    async fn test_wrong_person_cannot_delegate() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Protected delegation".into(),
            description: "".into(),
            priority: "low".into(),
            assigned_to: Some("alice".into()),
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.delegate(WorkItemDelegateInput {
            work_item_id: wi_id.clone(),
            delegated_by: "eve".into(),
            delegate_to: "bob".into(),
            reason: None,
        }, &storage).await.unwrap();
        match result {
            WorkItemDelegateOutput::NotOwner { .. } => {}
            _ => panic!("Expected NotOwner"),
        }
    }

    #[tokio::test]
    async fn test_reject_open_item_succeeds() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Rejectable".into(),
            description: "".into(),
            priority: "low".into(),
            assigned_to: None,
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.reject(WorkItemRejectInput {
            work_item_id: wi_id.clone(),
            rejected_by: "manager".into(),
            reason: "Not needed".into(),
        }, &storage).await.unwrap();
        match result {
            WorkItemRejectOutput::Ok { status, .. } => assert_eq!(status, "rejected"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_reject_rejected_item_fails() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Double reject".into(),
            description: "".into(),
            priority: "low".into(),
            assigned_to: None,
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        handler.reject(WorkItemRejectInput {
            work_item_id: wi_id.clone(),
            rejected_by: "mgr".into(),
            reason: "first".into(),
        }, &storage).await.unwrap();

        let result = handler.reject(WorkItemRejectInput {
            work_item_id: wi_id.clone(),
            rejected_by: "mgr".into(),
            reason: "second".into(),
        }, &storage).await.unwrap();
        match result {
            WorkItemRejectOutput::InvalidState { current_status, .. } => {
                assert_eq!(current_status, "rejected");
            }
            _ => panic!("Expected InvalidState"),
        }
    }

    #[tokio::test]
    async fn test_claim_already_in_progress_rejected() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Active task".into(),
            description: "".into(),
            priority: "high".into(),
            assigned_to: Some("alice".into()),
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        handler.start(WorkItemStartInput {
            work_item_id: wi_id.clone(),
            started_by: "alice".into(),
        }, &storage).await.unwrap();

        let result = handler.claim(WorkItemClaimInput {
            work_item_id: wi_id.clone(),
            claimed_by: "bob".into(),
        }, &storage).await.unwrap();
        match result {
            WorkItemClaimOutput::AlreadyClaimed { current_owner, .. } => {
                assert_eq!(current_owner, "alice");
            }
            _ => panic!("Expected AlreadyClaimed"),
        }
    }

    #[tokio::test]
    async fn test_complete_with_result_data() {
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create = handler.create(WorkItemCreateInput {
            title: "Data task".into(),
            description: "".into(),
            priority: "low".into(),
            assigned_to: Some("alice".into()),
            due_date: None,
        }, &storage).await.unwrap();
        let wi_id = match create {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            _ => panic!("Expected Ok"),
        };

        handler.start(WorkItemStartInput {
            work_item_id: wi_id.clone(),
            started_by: "alice".into(),
        }, &storage).await.unwrap();

        let result = handler.complete(WorkItemCompleteInput {
            work_item_id: wi_id.clone(),
            completed_by: "alice".into(),
            result: Some(json!({"decision": "approved", "notes": "Looks good"})),
        }, &storage).await.unwrap();
        match result {
            WorkItemCompleteOutput::Ok { status, .. } => assert_eq!(status, "completed"),
            _ => panic!("Expected Ok"),
        }
    }
}
