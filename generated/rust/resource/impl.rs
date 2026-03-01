use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ResourceHandler;
use serde_json::json;

pub struct ResourceHandlerImpl;

#[async_trait]
impl ResourceHandler for ResourceHandlerImpl {
    async fn upsert(
        &self,
        input: ResourceUpsertInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceUpsertOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("resource", &input.locator).await?;

        if let Some(record) = existing {
            let prev_digest = record.get("digest").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if prev_digest == input.digest {
                return Ok(ResourceUpsertOutput::Unchanged {
                    resource: input.locator,
                });
            }

            storage.put("resource", &input.locator, json!({
                "locator": input.locator,
                "kind": input.kind,
                "digest": input.digest,
                "lastModified": input.last_modified,
                "size": input.size
            })).await?;

            Ok(ResourceUpsertOutput::Changed {
                resource: input.locator,
                previous_digest: prev_digest,
            })
        } else {
            storage.put("resource", &input.locator, json!({
                "locator": input.locator,
                "kind": input.kind,
                "digest": input.digest,
                "lastModified": input.last_modified,
                "size": input.size
            })).await?;

            Ok(ResourceUpsertOutput::Created {
                resource: input.locator,
            })
        }
    }

    async fn get(
        &self,
        input: ResourceGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("resource", &input.locator).await?;
        match record {
            Some(r) => Ok(ResourceGetOutput::Ok {
                resource: r.get("locator").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                kind: r.get("kind").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                digest: r.get("digest").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }),
            None => Ok(ResourceGetOutput::NotFound {
                locator: input.locator,
            }),
        }
    }

    async fn list(
        &self,
        input: ResourceListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceListOutput, Box<dyn std::error::Error>> {
        let criteria = input.kind.as_ref().map(|k| json!({"kind": k}));
        let records = storage.find("resource", criteria.as_ref()).await?;

        let resources: Vec<serde_json::Value> = records.iter().map(|r| {
            json!({
                "locator": r.get("locator").and_then(|v| v.as_str()).unwrap_or(""),
                "kind": r.get("kind").and_then(|v| v.as_str()).unwrap_or(""),
                "digest": r.get("digest").and_then(|v| v.as_str()).unwrap_or("")
            })
        }).collect();

        Ok(ResourceListOutput::Ok {
            resources: serde_json::to_string(&resources)?,
        })
    }

    async fn remove(
        &self,
        input: ResourceRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ResourceRemoveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("resource", &input.locator).await?;
        if existing.is_none() {
            return Ok(ResourceRemoveOutput::NotFound {
                locator: input.locator,
            });
        }

        storage.del("resource", &input.locator).await?;
        Ok(ResourceRemoveOutput::Ok {
            resource: input.locator,
        })
    }

    async fn diff(
        &self,
        input: ResourceDiffInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<ResourceDiffOutput, Box<dyn std::error::Error>> {
        if input.old_digest == input.new_digest {
            Ok(ResourceDiffOutput::Ok {
                change_type: "unchanged".to_string(),
            })
        } else if input.old_digest.is_empty() {
            Ok(ResourceDiffOutput::Ok {
                change_type: "created".to_string(),
            })
        } else if input.new_digest.is_empty() {
            Ok(ResourceDiffOutput::Ok {
                change_type: "deleted".to_string(),
            })
        } else {
            Ok(ResourceDiffOutput::Ok {
                change_type: "modified".to_string(),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_upsert_create() {
        let storage = InMemoryStorage::new();
        let handler = ResourceHandlerImpl;
        let result = handler.upsert(
            ResourceUpsertInput {
                locator: "file:///test.txt".to_string(),
                kind: "text".to_string(),
                digest: "abc123".to_string(),
                last_modified: None,
                size: Some(100),
            },
            &storage,
        ).await.unwrap();
        match result {
            ResourceUpsertOutput::Created { resource } => {
                assert_eq!(resource, "file:///test.txt");
            },
            _ => panic!("Expected Created variant"),
        }
    }

    #[tokio::test]
    async fn test_upsert_unchanged() {
        let storage = InMemoryStorage::new();
        let handler = ResourceHandlerImpl;
        handler.upsert(
            ResourceUpsertInput {
                locator: "f".to_string(), kind: "t".to_string(),
                digest: "d1".to_string(), last_modified: None, size: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.upsert(
            ResourceUpsertInput {
                locator: "f".to_string(), kind: "t".to_string(),
                digest: "d1".to_string(), last_modified: None, size: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ResourceUpsertOutput::Unchanged { .. } => {},
            _ => panic!("Expected Unchanged variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ResourceHandlerImpl;
        let result = handler.get(
            ResourceGetInput { locator: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ResourceGetOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ResourceHandlerImpl;
        let result = handler.remove(
            ResourceRemoveInput { locator: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ResourceRemoveOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_unchanged() {
        let storage = InMemoryStorage::new();
        let handler = ResourceHandlerImpl;
        let result = handler.diff(
            ResourceDiffInput {
                locator: "f".to_string(),
                old_digest: "abc".to_string(),
                new_digest: "abc".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ResourceDiffOutput::Ok { change_type } => assert_eq!(change_type, "unchanged"),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_diff_created() {
        let storage = InMemoryStorage::new();
        let handler = ResourceHandlerImpl;
        let result = handler.diff(
            ResourceDiffInput {
                locator: "f".to_string(),
                old_digest: "".to_string(),
                new_digest: "abc".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ResourceDiffOutput::Ok { change_type } => assert_eq!(change_type, "created"),
            _ => panic!("Expected Ok"),
        }
    }
}
