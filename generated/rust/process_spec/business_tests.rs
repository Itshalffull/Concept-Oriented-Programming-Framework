// Business logic tests for ProcessSpec concept.
// Validates versioning, lifecycle state machine, and metadata management
// beyond what conformance and unit tests cover.

#[cfg(test)]
mod tests {
    use super::super::handler::ProcessSpecHandler;
    use super::super::r#impl::ProcessSpecHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_multiple_versions_coexist_independently() {
        // Different versions of the same spec can exist simultaneously
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let v1 = handler.create(ProcessSpecCreateInput {
            name: "onboarding".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![json!({"id": "welcome"})],
            metadata: None,
        }, &storage).await.unwrap();
        let v1_ref = match v1 {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        let v2 = handler.create(ProcessSpecCreateInput {
            name: "onboarding".to_string(),
            version: "2.0.0".to_string(),
            steps: vec![json!({"id": "welcome"}), json!({"id": "verify"})],
            metadata: None,
        }, &storage).await.unwrap();
        let v2_ref = match v2 {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        // Publish v1, leave v2 in draft
        handler.publish(ProcessSpecPublishInput { spec_ref: v1_ref.clone() }, &storage).await.unwrap();

        let get_v1 = handler.get(ProcessSpecGetInput { spec_ref: v1_ref }, &storage).await.unwrap();
        match get_v1 {
            ProcessSpecGetOutput::Ok { status, steps, .. } => {
                assert_eq!(status, "published");
                assert_eq!(steps.len(), 1);
            }
            _ => panic!("Expected Ok"),
        }

        let get_v2 = handler.get(ProcessSpecGetInput { spec_ref: v2_ref }, &storage).await.unwrap();
        match get_v2 {
            ProcessSpecGetOutput::Ok { status, steps, .. } => {
                assert_eq!(status, "draft");
                assert_eq!(steps.len(), 2);
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_deprecation_without_reason_succeeds() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let create = handler.create(ProcessSpecCreateInput {
            name: "no-reason-dep".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![],
            metadata: None,
        }, &storage).await.unwrap();
        let spec_ref = match create {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        handler.publish(ProcessSpecPublishInput { spec_ref: spec_ref.clone() }, &storage).await.unwrap();

        let result = handler.deprecate(ProcessSpecDeprecateInput {
            spec_ref: spec_ref.clone(),
            reason: None,
        }, &storage).await.unwrap();
        match result {
            ProcessSpecDeprecateOutput::Ok { status, .. } => assert_eq!(status, "deprecated"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_deprecated_spec_cannot_be_updated() {
        // After deprecation, updates should be rejected
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let create = handler.create(ProcessSpecCreateInput {
            name: "deprecated-update".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![json!({"id": "s1"})],
            metadata: None,
        }, &storage).await.unwrap();
        let spec_ref = match create {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        handler.publish(ProcessSpecPublishInput { spec_ref: spec_ref.clone() }, &storage).await.unwrap();
        handler.deprecate(ProcessSpecDeprecateInput {
            spec_ref: spec_ref.clone(),
            reason: Some("replaced".to_string()),
        }, &storage).await.unwrap();

        let update_result = handler.update(ProcessSpecUpdateInput {
            spec_ref: spec_ref.clone(),
            steps: Some(vec![json!({"id": "new-step"})]),
            metadata: None,
        }, &storage).await.unwrap();
        match update_result {
            ProcessSpecUpdateOutput::NotEditable { status, .. } => {
                assert_eq!(status, "deprecated");
            }
            _ => panic!("Expected NotEditable for deprecated spec"),
        }
    }

    #[tokio::test]
    async fn test_deprecated_spec_cannot_be_re_published() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let create = handler.create(ProcessSpecCreateInput {
            name: "repub-test".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![],
            metadata: None,
        }, &storage).await.unwrap();
        let spec_ref = match create {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        handler.publish(ProcessSpecPublishInput { spec_ref: spec_ref.clone() }, &storage).await.unwrap();
        handler.deprecate(ProcessSpecDeprecateInput {
            spec_ref: spec_ref.clone(),
            reason: None,
        }, &storage).await.unwrap();

        let result = handler.publish(ProcessSpecPublishInput { spec_ref: spec_ref.clone() }, &storage).await.unwrap();
        match result {
            ProcessSpecPublishOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "deprecated");
            }
            _ => panic!("Expected InvalidTransition for deprecated spec"),
        }
    }

    #[tokio::test]
    async fn test_update_only_steps_preserves_metadata() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let create = handler.create(ProcessSpecCreateInput {
            name: "partial-update".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![json!({"id": "orig"})],
            metadata: Some(json!({"team": "platform", "priority": "high"})),
        }, &storage).await.unwrap();
        let spec_ref = match create {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        handler.update(ProcessSpecUpdateInput {
            spec_ref: spec_ref.clone(),
            steps: Some(vec![json!({"id": "new-step"})]),
            metadata: None,
        }, &storage).await.unwrap();

        let get = handler.get(ProcessSpecGetInput { spec_ref }, &storage).await.unwrap();
        match get {
            ProcessSpecGetOutput::Ok { steps, metadata, .. } => {
                assert_eq!(steps.len(), 1);
                assert_eq!(steps[0]["id"], "new-step");
                assert_eq!(metadata["team"], json!("platform"));
                assert_eq!(metadata["priority"], json!("high"));
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_update_only_metadata_preserves_steps() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let create = handler.create(ProcessSpecCreateInput {
            name: "meta-only-update".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![json!({"id": "step-a"}), json!({"id": "step-b"})],
            metadata: Some(json!({"team": "eng"})),
        }, &storage).await.unwrap();
        let spec_ref = match create {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        handler.update(ProcessSpecUpdateInput {
            spec_ref: spec_ref.clone(),
            steps: None,
            metadata: Some(json!({"team": "ops", "env": "prod"})),
        }, &storage).await.unwrap();

        let get = handler.get(ProcessSpecGetInput { spec_ref }, &storage).await.unwrap();
        match get {
            ProcessSpecGetOutput::Ok { steps, metadata, .. } => {
                assert_eq!(steps.len(), 2);
                assert_eq!(metadata["team"], json!("ops"));
                assert_eq!(metadata["env"], json!("prod"));
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_create_with_empty_steps_succeeds() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let result = handler.create(ProcessSpecCreateInput {
            name: "empty-steps".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![],
            metadata: None,
        }, &storage).await.unwrap();
        match result {
            ProcessSpecCreateOutput::Ok { .. } => {}
            _ => panic!("Expected Ok for empty steps"),
        }
    }

    #[tokio::test]
    async fn test_publish_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let result = handler.publish(ProcessSpecPublishInput {
            spec_ref: "spec-nonexistent:0.0.0".to_string(),
        }, &storage).await.unwrap();
        match result {
            ProcessSpecPublishOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_deprecate_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let result = handler.deprecate(ProcessSpecDeprecateInput {
            spec_ref: "spec-ghost:1.0.0".to_string(),
            reason: None,
        }, &storage).await.unwrap();
        match result {
            ProcessSpecDeprecateOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_update_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;

        let result = handler.update(ProcessSpecUpdateInput {
            spec_ref: "spec-missing:1.0.0".to_string(),
            steps: Some(vec![]),
            metadata: None,
        }, &storage).await.unwrap();
        match result {
            ProcessSpecUpdateOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }
}
