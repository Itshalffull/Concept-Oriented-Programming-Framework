// WorkItem concept conformance tests
// Validates lifecycle invariants: create -> claim -> start -> complete,
// as well as rejection, delegation, and release paths.

#[cfg(test)]
mod tests {
    use super::super::handler::WorkItemHandler;
    use super::super::r#impl::WorkItemHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn work_item_full_lifecycle_invariant() {
        // Invariant: a work item must traverse open -> claimed -> in_progress -> completed
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Conformance test task".into(),
                description: "Verify full lifecycle".into(),
                priority: "high".into(),
                assigned_to: None,
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result {
            WorkItemCreateOutput::Ok { work_item_id, status } => {
                assert_eq!(status, "open");
                work_item_id
            }
            other => panic!("Expected Ok, got {:?}", other),
        };

        let claim_result = handler.claim(
            WorkItemClaimInput { work_item_id: wi_id.clone(), claimed_by: "user-a".into() },
            &storage,
        ).await.unwrap();
        match claim_result {
            WorkItemClaimOutput::Ok { claimed_by, .. } => assert_eq!(claimed_by, "user-a"),
            other => panic!("Expected Ok, got {:?}", other),
        }

        let start_result = handler.start(
            WorkItemStartInput { work_item_id: wi_id.clone(), started_by: "user-a".into() },
            &storage,
        ).await.unwrap();
        match start_result {
            WorkItemStartOutput::Ok { status, .. } => assert_eq!(status, "in_progress"),
            other => panic!("Expected Ok, got {:?}", other),
        }

        let complete_result = handler.complete(
            WorkItemCompleteInput { work_item_id: wi_id.clone(), completed_by: "user-a".into(), result: Some("done".into()) },
            &storage,
        ).await.unwrap();
        match complete_result {
            WorkItemCompleteOutput::Ok { status, .. } => assert_eq!(status, "completed"),
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn work_item_delegate_then_complete_invariant() {
        // Invariant: delegation transfers ownership; new owner can complete
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Delegate test".into(),
                description: "".into(),
                priority: "medium".into(),
                assigned_to: Some("user-a".into()),
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            other => panic!("Expected Ok, got {:?}", other),
        };

        let delegate_result = handler.delegate(
            WorkItemDelegateInput {
                work_item_id: wi_id.clone(),
                delegated_by: "user-a".into(),
                delegate_to: "user-b".into(),
                reason: None,
            },
            &storage,
        ).await.unwrap();
        match delegate_result {
            WorkItemDelegateOutput::Ok { delegated_to, .. } => assert_eq!(delegated_to, "user-b"),
            other => panic!("Expected Ok, got {:?}", other),
        }

        let start_result = handler.start(
            WorkItemStartInput { work_item_id: wi_id.clone(), started_by: "user-b".into() },
            &storage,
        ).await.unwrap();
        match start_result {
            WorkItemStartOutput::Ok { status, .. } => assert_eq!(status, "in_progress"),
            other => panic!("Expected Ok, got {:?}", other),
        }

        let complete_result = handler.complete(
            WorkItemCompleteInput { work_item_id: wi_id.clone(), completed_by: "user-b".into(), result: None },
            &storage,
        ).await.unwrap();
        match complete_result {
            WorkItemCompleteOutput::Ok { status, .. } => assert_eq!(status, "completed"),
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn work_item_release_returns_to_open_invariant() {
        // Invariant: releasing a claimed item returns it to open state
        let storage = InMemoryStorage::new();
        let handler = WorkItemHandlerImpl;

        let create_result = handler.create(
            WorkItemCreateInput {
                title: "Release test".into(),
                description: "".into(),
                priority: "low".into(),
                assigned_to: Some("user-a".into()),
                due_date: None,
            },
            &storage,
        ).await.unwrap();
        let wi_id = match create_result {
            WorkItemCreateOutput::Ok { work_item_id, .. } => work_item_id,
            other => panic!("Expected Ok, got {:?}", other),
        };

        let release_result = handler.release(
            WorkItemReleaseInput { work_item_id: wi_id.clone(), released_by: "user-a".into() },
            &storage,
        ).await.unwrap();
        match release_result {
            WorkItemReleaseOutput::Ok { status, .. } => assert_eq!(status, "open"),
            other => panic!("Expected Ok, got {:?}", other),
        }

        // After release, another user can claim it
        let claim_result = handler.claim(
            WorkItemClaimInput { work_item_id: wi_id.clone(), claimed_by: "user-b".into() },
            &storage,
        ).await.unwrap();
        match claim_result {
            WorkItemClaimOutput::Ok { claimed_by, .. } => assert_eq!(claimed_by, "user-b"),
            other => panic!("Expected Ok, got {:?}", other),
        }
    }
}
