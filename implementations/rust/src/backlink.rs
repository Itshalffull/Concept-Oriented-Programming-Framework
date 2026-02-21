// Backlink Concept Implementation (Rust)
//
// Reverse-index of references — retrieve all entities that reference
// a given entity, and reindex backlinks from the reference store.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- GetBacklinks ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetBacklinksInput {
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetBacklinksOutput {
    #[serde(rename = "ok")]
    Ok {
        entity_id: String,
        backlinks: String,
    },
}

// --- Reindex ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReindexInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReindexOutput {
    #[serde(rename = "ok")]
    Ok { count: u64 },
}

pub struct BacklinkHandler;

impl BacklinkHandler {
    pub async fn get_backlinks(
        &self,
        input: GetBacklinksInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetBacklinksOutput> {
        let all_backlinks = storage
            .find(
                "backlink",
                Some(&json!({ "target_id": input.entity_id })),
            )
            .await?;
        let backlinks_json = serde_json::to_string(&all_backlinks)?;
        Ok(GetBacklinksOutput::Ok {
            entity_id: input.entity_id,
            backlinks: backlinks_json,
        })
    }

    pub async fn reindex(
        &self,
        _input: ReindexInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ReindexOutput> {
        // Fetch all references and rebuild backlink index
        let all_refs = storage.find("reference", None).await?;
        let mut count: u64 = 0;

        // Clear existing backlinks by processing each one
        let existing_backlinks = storage.find("backlink", None).await?;
        for bl in &existing_backlinks {
            if let Some(key) = bl.get("backlink_key").and_then(|v| v.as_str()) {
                storage.del("backlink", key).await?;
            }
        }

        // Rebuild from references
        for reference in &all_refs {
            let source_id = reference
                .get("source_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let target_id = reference
                .get("target_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let ref_type = reference
                .get("ref_type")
                .and_then(|v| v.as_str())
                .unwrap_or("link");

            if !source_id.is_empty() && !target_id.is_empty() {
                let backlink_key = format!("{}:{}", target_id, source_id);
                storage
                    .put(
                        "backlink",
                        &backlink_key,
                        json!({
                            "backlink_key": backlink_key,
                            "target_id": target_id,
                            "source_id": source_id,
                            "ref_type": ref_type,
                            "indexed_at": chrono::Utc::now().to_rfc3339(),
                        }),
                    )
                    .await?;
                count += 1;
            }
        }

        Ok(ReindexOutput::Ok { count })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- get_backlinks ---

    #[tokio::test]
    async fn get_backlinks_returns_empty_when_none() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandler;

        let result = handler
            .get_backlinks(
                GetBacklinksInput { entity_id: "ent1".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetBacklinksOutput::Ok { entity_id, backlinks } => {
                assert_eq!(entity_id, "ent1");
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&backlinks).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn get_backlinks_returns_matching_backlinks() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandler;

        // Manually insert a backlink record
        storage
            .put(
                "backlink",
                "target1:source1",
                json!({
                    "backlink_key": "target1:source1",
                    "target_id": "target1",
                    "source_id": "source1",
                    "ref_type": "link",
                }),
            )
            .await
            .unwrap();

        let result = handler
            .get_backlinks(
                GetBacklinksInput { entity_id: "target1".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetBacklinksOutput::Ok { backlinks, .. } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&backlinks).unwrap();
                assert_eq!(parsed.len(), 1);
                assert_eq!(parsed[0]["source_id"].as_str().unwrap(), "source1");
            }
        }
    }

    // --- reindex ---

    #[tokio::test]
    async fn reindex_returns_zero_when_no_references() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandler;

        let result = handler.reindex(ReindexInput, &storage).await.unwrap();

        match result {
            ReindexOutput::Ok { count } => assert_eq!(count, 0),
        }
    }

    #[tokio::test]
    async fn reindex_builds_backlinks_from_references() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandler;

        // Insert reference records
        storage
            .put(
                "reference",
                "ref1",
                json!({
                    "source_id": "pageA",
                    "target_id": "pageB",
                    "ref_type": "link",
                }),
            )
            .await
            .unwrap();

        storage
            .put(
                "reference",
                "ref2",
                json!({
                    "source_id": "pageC",
                    "target_id": "pageB",
                    "ref_type": "embed",
                }),
            )
            .await
            .unwrap();

        let result = handler.reindex(ReindexInput, &storage).await.unwrap();

        match result {
            ReindexOutput::Ok { count } => assert_eq!(count, 2),
        }

        // Verify the backlinks were created
        let bl = storage.get("backlink", "pageB:pageA").await.unwrap();
        assert!(bl.is_some());
    }
}
