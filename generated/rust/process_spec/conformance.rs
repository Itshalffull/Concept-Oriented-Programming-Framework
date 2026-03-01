// generated: process_spec/conformance.rs
// Conformance tests for ProcessSpec concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessSpecHandler;
    use super::super::r#impl::ProcessSpecHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> ProcessSpecHandlerImpl {
        ProcessSpecHandlerImpl
    }

    #[tokio::test]
    async fn process_spec_invariant_lifecycle_draft_to_published() {
        // Invariant: a spec transitions from draft to published
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "lifecycle-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![json!({ "id": "step1" })],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        let spec_ref = match create_result {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        // Verify draft status
        let get_result = handler.get(
            ProcessSpecGetInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        match get_result {
            ProcessSpecGetOutput::Ok { status, .. } => assert_eq!(status, "draft"),
            _ => panic!("Expected Ok"),
        }

        // Publish
        handler.publish(
            ProcessSpecPublishInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        // Verify published status
        let get_result = handler.get(
            ProcessSpecGetInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        match get_result {
            ProcessSpecGetOutput::Ok { status, .. } => assert_eq!(status, "published"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn process_spec_invariant_published_immutable() {
        // Invariant: published specs cannot be updated
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "immutable-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![json!({ "id": "step1" })],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        let spec_ref = match create_result {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        handler.publish(
            ProcessSpecPublishInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        let update_result = handler.update(
            ProcessSpecUpdateInput {
                spec_ref: spec_ref.clone(),
                steps: Some(vec![json!({ "id": "should-not-work" })]),
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        match update_result {
            ProcessSpecUpdateOutput::NotEditable { status, .. } => {
                assert_eq!(status, "published");
            }
            _ => panic!("Expected NotEditable"),
        }
    }

    #[tokio::test]
    async fn process_spec_invariant_deprecation_requires_published() {
        // Invariant: only published specs can be deprecated
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "dep-guard-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        let spec_ref = match create_result {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        // Attempt deprecation on draft
        let result = handler.deprecate(
            ProcessSpecDeprecateInput {
                spec_ref: spec_ref.clone(),
                reason: None,
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecDeprecateOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "draft");
            }
            _ => panic!("Expected InvalidTransition"),
        }
    }

    #[tokio::test]
    async fn process_spec_invariant_unique_name_version() {
        // Invariant: (name, version) pairs are unique
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        handler.create(
            ProcessSpecCreateInput {
                name: "unique-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        let result = handler.create(
            ProcessSpecCreateInput {
                name: "unique-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecCreateOutput::AlreadyExists { .. } => {}
            _ => panic!("Expected AlreadyExists for duplicate name+version"),
        }
    }
}
