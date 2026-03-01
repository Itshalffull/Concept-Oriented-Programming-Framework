// ProcessSpec concept implementation
// Manages versioned process specifications with lifecycle states:
// draft -> published -> deprecated. Only draft specs can be updated.
// Published specs are immutable and available for instantiation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProcessSpecHandler;
use serde_json::json;

pub struct ProcessSpecHandlerImpl;

fn generate_spec_ref(name: &str, version: &str) -> String {
    format!("spec-{}:{}", name, version)
}

#[async_trait]
impl ProcessSpecHandler for ProcessSpecHandlerImpl {
    async fn create(
        &self,
        input: ProcessSpecCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecCreateOutput, Box<dyn std::error::Error>> {
        let spec_ref = generate_spec_ref(&input.name, &input.version);

        // Check for duplicate
        let existing = storage.get("process_specs", &spec_ref).await?;
        if existing.is_some() {
            return Ok(ProcessSpecCreateOutput::AlreadyExists {
                name: input.name,
                version: input.version,
            });
        }

        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("process_specs", &spec_ref, json!({
            "spec_ref": spec_ref,
            "name": input.name,
            "version": input.version,
            "status": "draft",
            "steps": input.steps,
            "metadata": input.metadata.unwrap_or(json!({})),
            "created_at": timestamp,
            "updated_at": timestamp,
        })).await?;

        Ok(ProcessSpecCreateOutput::Ok {
            spec_ref,
            name: input.name,
            version: input.version,
        })
    }

    async fn publish(
        &self,
        input: ProcessSpecPublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecPublishOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_specs", &input.spec_ref).await?;

        match existing {
            None => Ok(ProcessSpecPublishOutput::NotFound {
                spec_ref: input.spec_ref,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "draft" {
                    return Ok(ProcessSpecPublishOutput::InvalidTransition {
                        spec_ref: input.spec_ref,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("published"));
                    obj.insert("published_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                    obj.insert("updated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("process_specs", &input.spec_ref, updated).await?;

                Ok(ProcessSpecPublishOutput::Ok {
                    spec_ref: input.spec_ref,
                    status: "published".to_string(),
                })
            }
        }
    }

    async fn deprecate(
        &self,
        input: ProcessSpecDeprecateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecDeprecateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_specs", &input.spec_ref).await?;

        match existing {
            None => Ok(ProcessSpecDeprecateOutput::NotFound {
                spec_ref: input.spec_ref,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "published" {
                    return Ok(ProcessSpecDeprecateOutput::InvalidTransition {
                        spec_ref: input.spec_ref,
                        current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("deprecated"));
                    obj.insert("deprecated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                    obj.insert("updated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                    if let Some(reason) = &input.reason {
                        obj.insert("deprecation_reason".to_string(), json!(reason));
                    }
                }

                storage.put("process_specs", &input.spec_ref, updated).await?;

                Ok(ProcessSpecDeprecateOutput::Ok {
                    spec_ref: input.spec_ref,
                    status: "deprecated".to_string(),
                })
            }
        }
    }

    async fn update(
        &self,
        input: ProcessSpecUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecUpdateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("process_specs", &input.spec_ref).await?;

        match existing {
            None => Ok(ProcessSpecUpdateOutput::NotFound {
                spec_ref: input.spec_ref,
            }),
            Some(record) => {
                let current_status = record["status"].as_str().unwrap_or("unknown").to_string();
                if current_status != "draft" {
                    return Ok(ProcessSpecUpdateOutput::NotEditable {
                        spec_ref: input.spec_ref,
                        status: current_status,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    if let Some(steps) = &input.steps {
                        obj.insert("steps".to_string(), json!(steps));
                    }
                    if let Some(metadata) = &input.metadata {
                        obj.insert("metadata".to_string(), metadata.clone());
                    }
                    obj.insert("updated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }

                storage.put("process_specs", &input.spec_ref, updated).await?;

                Ok(ProcessSpecUpdateOutput::Ok {
                    spec_ref: input.spec_ref,
                })
            }
        }
    }

    async fn get(
        &self,
        input: ProcessSpecGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessSpecGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("process_specs", &input.spec_ref).await?;

        match record {
            None => Ok(ProcessSpecGetOutput::NotFound {
                spec_ref: input.spec_ref,
            }),
            Some(r) => {
                let steps: Vec<serde_json::Value> = r["steps"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();

                Ok(ProcessSpecGetOutput::Ok {
                    spec_ref: r["spec_ref"].as_str().unwrap_or("").to_string(),
                    name: r["name"].as_str().unwrap_or("").to_string(),
                    version: r["version"].as_str().unwrap_or("").to_string(),
                    status: r["status"].as_str().unwrap_or("").to_string(),
                    steps,
                    metadata: r["metadata"].clone(),
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_spec() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let result = handler.create(
            ProcessSpecCreateInput {
                name: "order-fulfillment".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![
                    json!({ "id": "validate", "type": "task" }),
                    json!({ "id": "process", "type": "task" }),
                    json!({ "id": "ship", "type": "task" }),
                ],
                metadata: Some(json!({ "owner": "ops-team" })),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProcessSpecCreateOutput::Ok { spec_ref, name, version } => {
                assert!(spec_ref.starts_with("spec-"));
                assert_eq!(name, "order-fulfillment");
                assert_eq!(version, "1.0.0");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_duplicate_returns_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        handler.create(
            ProcessSpecCreateInput {
                name: "dup-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        let result = handler.create(
            ProcessSpecCreateInput {
                name: "dup-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecCreateOutput::AlreadyExists { name, version } => {
                assert_eq!(name, "dup-test");
                assert_eq!(version, "1.0.0");
            }
            _ => panic!("Expected AlreadyExists variant"),
        }
    }

    #[tokio::test]
    async fn test_publish_draft_spec() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "pub-test".to_string(),
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

        let result = handler.publish(
            ProcessSpecPublishInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecPublishOutput::Ok { status, .. } => {
                assert_eq!(status, "published");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_publish_already_published_returns_invalid_transition() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "double-pub".to_string(),
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

        handler.publish(
            ProcessSpecPublishInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        let result = handler.publish(
            ProcessSpecPublishInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecPublishOutput::InvalidTransition { current_status, .. } => {
                assert_eq!(current_status, "published");
            }
            _ => panic!("Expected InvalidTransition variant"),
        }
    }

    #[tokio::test]
    async fn test_deprecate_published_spec() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "dep-test".to_string(),
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

        handler.publish(
            ProcessSpecPublishInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        let result = handler.deprecate(
            ProcessSpecDeprecateInput {
                spec_ref: spec_ref.clone(),
                reason: Some("superseded by v2".to_string()),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecDeprecateOutput::Ok { status, .. } => {
                assert_eq!(status, "deprecated");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_update_draft_spec() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "upd-test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![json!({ "id": "old-step" })],
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        let spec_ref = match create_result {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        let result = handler.update(
            ProcessSpecUpdateInput {
                spec_ref: spec_ref.clone(),
                steps: Some(vec![json!({ "id": "new-step" })]),
                metadata: Some(json!({ "updated": true })),
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecUpdateOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }

        // Verify update persisted
        let get_result = handler.get(
            ProcessSpecGetInput { spec_ref },
            &storage,
        ).await.unwrap();

        match get_result {
            ProcessSpecGetOutput::Ok { steps, metadata, .. } => {
                assert_eq!(steps.len(), 1);
                assert_eq!(steps[0]["id"], "new-step");
                assert_eq!(metadata["updated"], json!(true));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_update_published_returns_not_editable() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "locked-test".to_string(),
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

        handler.publish(
            ProcessSpecPublishInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        let result = handler.update(
            ProcessSpecUpdateInput {
                spec_ref: spec_ref.clone(),
                steps: Some(vec![json!({ "id": "should-fail" })]),
                metadata: None,
            },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecUpdateOutput::NotEditable { status, .. } => {
                assert_eq!(status, "published");
            }
            _ => panic!("Expected NotEditable variant"),
        }
    }

    #[tokio::test]
    async fn test_get_existing_spec() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let create_result = handler.create(
            ProcessSpecCreateInput {
                name: "get-test".to_string(),
                version: "2.0.0".to_string(),
                steps: vec![json!({ "id": "s1" }), json!({ "id": "s2" })],
                metadata: Some(json!({ "team": "platform" })),
            },
            &storage,
        ).await.unwrap();

        let spec_ref = match create_result {
            ProcessSpecCreateOutput::Ok { spec_ref, .. } => spec_ref,
            _ => panic!("Expected Ok"),
        };

        let result = handler.get(
            ProcessSpecGetInput { spec_ref: spec_ref.clone() },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecGetOutput::Ok { name, version, status, steps, .. } => {
                assert_eq!(name, "get-test");
                assert_eq!(version, "2.0.0");
                assert_eq!(status, "draft");
                assert_eq!(steps.len(), 2);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProcessSpecHandlerImpl;
        let result = handler.get(
            ProcessSpecGetInput { spec_ref: "spec-nonexistent:0.0.0".to_string() },
            &storage,
        ).await.unwrap();

        match result {
            ProcessSpecGetOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound variant"),
        }
    }
}
