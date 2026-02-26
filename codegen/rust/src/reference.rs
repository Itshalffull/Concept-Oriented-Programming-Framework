// Reference Concept Implementation (Rust)
//
// Manages directional references between entities — add, remove,
// and list outgoing references from a source.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- AddRef ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddRefInput {
    pub source_id: String,
    pub target_id: String,
    pub ref_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddRefOutput {
    #[serde(rename = "ok")]
    Ok {
        source_id: String,
        target_id: String,
    },
}

// --- RemoveRef ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveRefInput {
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveRefOutput {
    #[serde(rename = "ok")]
    Ok {
        source_id: String,
        target_id: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- GetRefs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetRefsInput {
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetRefsOutput {
    #[serde(rename = "ok")]
    Ok { source_id: String, refs: String },
}

pub struct ReferenceHandler;

impl ReferenceHandler {
    pub async fn add_ref(
        &self,
        input: AddRefInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddRefOutput> {
        let compound_key = format!("{}:{}", input.source_id, input.target_id);
        storage
            .put(
                "reference",
                &compound_key,
                json!({
                    "source_id": input.source_id,
                    "target_id": input.target_id,
                    "ref_type": input.ref_type,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(AddRefOutput::Ok {
            source_id: input.source_id,
            target_id: input.target_id,
        })
    }

    pub async fn remove_ref(
        &self,
        input: RemoveRefInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveRefOutput> {
        let compound_key = format!("{}:{}", input.source_id, input.target_id);
        let existing = storage.get("reference", &compound_key).await?;
        match existing {
            None => Ok(RemoveRefOutput::NotFound {
                message: format!(
                    "reference from '{}' to '{}' not found",
                    input.source_id, input.target_id
                ),
            }),
            Some(_) => {
                storage.del("reference", &compound_key).await?;
                Ok(RemoveRefOutput::Ok {
                    source_id: input.source_id,
                    target_id: input.target_id,
                })
            }
        }
    }

    pub async fn get_refs(
        &self,
        input: GetRefsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetRefsOutput> {
        let all_refs = storage
            .find(
                "reference",
                Some(&json!({ "source_id": input.source_id })),
            )
            .await?;
        let refs_json = serde_json::to_string(&all_refs)?;
        Ok(GetRefsOutput::Ok {
            source_id: input.source_id,
            refs: refs_json,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── add_ref tests ──────────────────────────────────────

    #[tokio::test]
    async fn add_ref_returns_ok_with_ids() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandler;

        let result = handler
            .add_ref(
                AddRefInput {
                    source_id: "s1".into(),
                    target_id: "t1".into(),
                    ref_type: "link".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            AddRefOutput::Ok { source_id, target_id } => {
                assert_eq!(source_id, "s1");
                assert_eq!(target_id, "t1");
            }
        }
    }

    #[tokio::test]
    async fn add_ref_stores_reference_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandler;

        handler
            .add_ref(
                AddRefInput {
                    source_id: "doc1".into(),
                    target_id: "doc2".into(),
                    ref_type: "citation".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("reference", "doc1:doc2").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["ref_type"].as_str().unwrap(), "citation");
    }

    // ── remove_ref tests ───────────────────────────────────

    #[tokio::test]
    async fn remove_ref_deletes_existing_reference() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandler;

        handler
            .add_ref(
                AddRefInput {
                    source_id: "a".into(),
                    target_id: "b".into(),
                    ref_type: "link".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .remove_ref(
                RemoveRefInput {
                    source_id: "a".into(),
                    target_id: "b".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveRefOutput::Ok { .. }));

        let record = storage.get("reference", "a:b").await.unwrap();
        assert!(record.is_none());
    }

    #[tokio::test]
    async fn remove_ref_returns_notfound_when_missing() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandler;

        let result = handler
            .remove_ref(
                RemoveRefInput {
                    source_id: "x".into(),
                    target_id: "y".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveRefOutput::NotFound { .. }));
    }

    // ── get_refs tests ─────────────────────────────────────

    #[tokio::test]
    async fn get_refs_returns_all_refs_from_source() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandler;

        handler
            .add_ref(
                AddRefInput {
                    source_id: "s1".into(),
                    target_id: "t1".into(),
                    ref_type: "link".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_ref(
                AddRefInput {
                    source_id: "s1".into(),
                    target_id: "t2".into(),
                    ref_type: "embed".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_refs(
                GetRefsInput {
                    source_id: "s1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetRefsOutput::Ok { source_id, refs } => {
                assert_eq!(source_id, "s1");
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&refs).unwrap();
                assert_eq!(parsed.len(), 2);
            }
        }
    }

    #[tokio::test]
    async fn get_refs_returns_empty_when_no_refs() {
        let storage = InMemoryStorage::new();
        let handler = ReferenceHandler;

        let result = handler
            .get_refs(
                GetRefsInput {
                    source_id: "lonely".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetRefsOutput::Ok { refs, .. } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&refs).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }
}
