// Reference concept implementation
// Manages directed references (links) between source and target entities.
// Supports add, remove, get outgoing references, and target existence checks.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ReferenceHandler;
use serde_json::json;

pub struct ReferenceHandlerImpl;

/// Build a deterministic storage key for a source->target reference pair
fn ref_key(source: &str, target: &str) -> String {
    format!("{}:{}", source, target)
}

#[async_trait]
impl ReferenceHandler for ReferenceHandlerImpl {
    async fn add_ref(
        &self,
        input: ReferenceAddRefInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceAddRefOutput, Box<dyn std::error::Error>> {
        let key = ref_key(&input.source, &input.target);

        let existing = storage.get("reference", &key).await?;
        if existing.is_some() {
            return Ok(ReferenceAddRefOutput::Exists {
                source: input.source,
                target: input.target,
            });
        }

        storage.put("reference", &key, json!({
            "source": input.source,
            "target": input.target,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(ReferenceAddRefOutput::Ok {
            source: input.source,
            target: input.target,
        })
    }

    async fn remove_ref(
        &self,
        input: ReferenceRemoveRefInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceRemoveRefOutput, Box<dyn std::error::Error>> {
        let key = ref_key(&input.source, &input.target);

        let existing = storage.get("reference", &key).await?;
        if existing.is_none() {
            return Ok(ReferenceRemoveRefOutput::Notfound {
                source: input.source,
                target: input.target,
            });
        }

        storage.del("reference", &key).await?;

        Ok(ReferenceRemoveRefOutput::Ok {
            source: input.source,
            target: input.target,
        })
    }

    async fn get_refs(
        &self,
        input: ReferenceGetRefsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceGetRefsOutput, Box<dyn std::error::Error>> {
        let all_refs = storage.find("reference", Some(&json!({"source": input.source}))).await?;

        if all_refs.is_empty() {
            return Ok(ReferenceGetRefsOutput::Notfound {
                source: input.source,
            });
        }

        let targets: Vec<String> = all_refs.iter()
            .filter_map(|r| r.get("target").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        Ok(ReferenceGetRefsOutput::Ok {
            targets: serde_json::to_string(&targets)?,
        })
    }

    async fn resolve_target(
        &self,
        input: ReferenceResolveTargetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceResolveTargetOutput, Box<dyn std::error::Error>> {
        // Check if any reference points to this target
        let refs = storage.find("reference", Some(&json!({"target": input.target}))).await?;

        Ok(ReferenceResolveTargetOutput::Ok {
            exists: !refs.is_empty(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_add_ref() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandlerImpl;
        let result = handler.add_ref(
            ReferenceAddRefInput { source: "doc-1".to_string(), target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ReferenceAddRefOutput::Ok { source, target } => {
                assert_eq!(source, "doc-1");
                assert_eq!(target, "doc-2");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_add_ref_exists() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandlerImpl;
        handler.add_ref(
            ReferenceAddRefInput { source: "doc-1".to_string(), target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.add_ref(
            ReferenceAddRefInput { source: "doc-1".to_string(), target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ReferenceAddRefOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_ref() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandlerImpl;
        handler.add_ref(
            ReferenceAddRefInput { source: "doc-1".to_string(), target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.remove_ref(
            ReferenceRemoveRefInput { source: "doc-1".to_string(), target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ReferenceRemoveRefOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_ref_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandlerImpl;
        let result = handler.remove_ref(
            ReferenceRemoveRefInput { source: "doc-1".to_string(), target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ReferenceRemoveRefOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_target_exists() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandlerImpl;
        handler.add_ref(
            ReferenceAddRefInput { source: "doc-1".to_string(), target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.resolve_target(
            ReferenceResolveTargetInput { target: "doc-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ReferenceResolveTargetOutput::Ok { exists } => assert!(exists),
        }
    }

    #[tokio::test]
    async fn test_resolve_target_not_exists() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandlerImpl;
        let result = handler.resolve_target(
            ReferenceResolveTargetInput { target: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ReferenceResolveTargetOutput::Ok { exists } => assert!(!exists),
        }
    }
}
