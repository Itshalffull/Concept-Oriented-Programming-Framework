// Cache Concept Implementation (Rust)
//
// Infrastructure kit — set/get cached values with TTL and tags,
// invalidate by key or by tags.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Set ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheSetInput {
    pub key: String,
    pub value: String,
    pub tags: String,
    pub max_age: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CacheSetOutput {
    #[serde(rename = "ok")]
    Ok { key: String },
}

// ── Get ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheGetInput {
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CacheGetOutput {
    #[serde(rename = "ok")]
    Ok { key: String, value: String },
    #[serde(rename = "miss")]
    Miss { key: String },
}

// ── Invalidate ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheInvalidateInput {
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CacheInvalidateOutput {
    #[serde(rename = "ok")]
    Ok { key: String },
}

// ── InvalidateByTags ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheInvalidateByTagsInput {
    pub tags: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CacheInvalidateByTagsOutput {
    #[serde(rename = "ok")]
    Ok { count: u64 },
}

// ── Handler ───────────────────────────────────────────────

pub struct CacheHandler;

impl CacheHandler {
    pub async fn set(
        &self,
        input: CacheSetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CacheSetOutput> {
        let now = chrono::Utc::now().timestamp() as u64;
        let expires_at = now + input.max_age;
        storage
            .put(
                "cache_bin",
                &input.key,
                json!({
                    "key": input.key,
                    "value": input.value,
                    "tags": input.tags,
                    "max_age": input.max_age,
                    "created_at": now,
                    "expires_at": expires_at,
                }),
            )
            .await?;
        Ok(CacheSetOutput::Ok { key: input.key })
    }

    pub async fn get(
        &self,
        input: CacheGetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CacheGetOutput> {
        let existing = storage.get("cache_bin", &input.key).await?;
        match existing {
            None => Ok(CacheGetOutput::Miss {
                key: input.key,
            }),
            Some(record) => {
                // Check expiry
                let now = chrono::Utc::now().timestamp() as u64;
                let expires_at = record["expires_at"].as_u64().unwrap_or(0);
                if now > expires_at {
                    // Expired — remove and return miss
                    storage.del("cache_bin", &input.key).await?;
                    return Ok(CacheGetOutput::Miss {
                        key: input.key,
                    });
                }
                let value = record["value"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                Ok(CacheGetOutput::Ok {
                    key: input.key,
                    value,
                })
            }
        }
    }

    pub async fn invalidate(
        &self,
        input: CacheInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CacheInvalidateOutput> {
        storage.del("cache_bin", &input.key).await?;
        Ok(CacheInvalidateOutput::Ok { key: input.key })
    }

    pub async fn invalidate_by_tags(
        &self,
        input: CacheInvalidateByTagsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CacheInvalidateByTagsOutput> {
        let target_tags: Vec<&str> = input.tags.split(',').map(|s| s.trim()).collect();
        let all_entries = storage.find("cache_bin", None).await?;

        let mut count: u64 = 0;
        for entry in &all_entries {
            let entry_tags = entry["tags"].as_str().unwrap_or("");
            let entry_tag_list: Vec<&str> = entry_tags.split(',').map(|s| s.trim()).collect();

            let has_match = target_tags.iter().any(|t| entry_tag_list.contains(t));
            if has_match {
                if let Some(key) = entry["key"].as_str() {
                    storage.del("cache_bin", key).await?;
                    count += 1;
                }
            }
        }

        Ok(CacheInvalidateByTagsOutput::Ok { count })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- set ---

    #[tokio::test]
    async fn set_stores_cache_entry() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        let result = handler
            .set(
                CacheSetInput {
                    key: "k1".into(),
                    value: "hello".into(),
                    tags: "t1,t2".into(),
                    max_age: 3600,
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CacheSetOutput::Ok { key } => assert_eq!(key, "k1"),
        }

        let record = storage.get("cache_bin", "k1").await.unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn set_overwrites_existing_entry() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        handler
            .set(
                CacheSetInput {
                    key: "k1".into(),
                    value: "first".into(),
                    tags: "t1".into(),
                    max_age: 3600,
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .set(
                CacheSetInput {
                    key: "k1".into(),
                    value: "second".into(),
                    tags: "t1".into(),
                    max_age: 3600,
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("cache_bin", "k1").await.unwrap().unwrap();
        assert_eq!(record["value"].as_str().unwrap(), "second");
    }

    // --- get ---

    #[tokio::test]
    async fn get_returns_cached_value() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        handler
            .set(
                CacheSetInput {
                    key: "k1".into(),
                    value: "cached_data".into(),
                    tags: "".into(),
                    max_age: 9999999,
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get(CacheGetInput { key: "k1".into() }, &storage)
            .await
            .unwrap();

        match result {
            CacheGetOutput::Ok { key, value } => {
                assert_eq!(key, "k1");
                assert_eq!(value, "cached_data");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn get_returns_miss_for_missing_key() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        let result = handler
            .get(CacheGetInput { key: "missing".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, CacheGetOutput::Miss { .. }));
    }

    // --- invalidate ---

    #[tokio::test]
    async fn invalidate_removes_entry() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        handler
            .set(
                CacheSetInput {
                    key: "k1".into(),
                    value: "data".into(),
                    tags: "".into(),
                    max_age: 9999999,
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .invalidate(CacheInvalidateInput { key: "k1".into() }, &storage)
            .await
            .unwrap();

        let result = handler
            .get(CacheGetInput { key: "k1".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, CacheGetOutput::Miss { .. }));
    }

    #[tokio::test]
    async fn invalidate_returns_ok_for_nonexistent_key() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        let result = handler
            .invalidate(CacheInvalidateInput { key: "nope".into() }, &storage)
            .await
            .unwrap();

        match result {
            CacheInvalidateOutput::Ok { key } => assert_eq!(key, "nope"),
        }
    }

    // --- invalidate_by_tags ---

    #[tokio::test]
    async fn invalidate_by_tags_removes_matching_entries() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        handler
            .set(
                CacheSetInput {
                    key: "k1".into(),
                    value: "v1".into(),
                    tags: "alpha,beta".into(),
                    max_age: 9999999,
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .set(
                CacheSetInput {
                    key: "k2".into(),
                    value: "v2".into(),
                    tags: "gamma".into(),
                    max_age: 9999999,
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .invalidate_by_tags(
                CacheInvalidateByTagsInput { tags: "alpha".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CacheInvalidateByTagsOutput::Ok { count } => assert_eq!(count, 1),
        }

        // k1 should be gone, k2 should remain
        let r1 = handler.get(CacheGetInput { key: "k1".into() }, &storage).await.unwrap();
        assert!(matches!(r1, CacheGetOutput::Miss { .. }));

        let r2 = handler.get(CacheGetInput { key: "k2".into() }, &storage).await.unwrap();
        assert!(matches!(r2, CacheGetOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn invalidate_by_tags_returns_zero_when_no_match() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandler;

        let result = handler
            .invalidate_by_tags(
                CacheInvalidateByTagsInput { tags: "nonexistent".into() },
                &storage,
            )
            .await
            .unwrap();

        match result {
            CacheInvalidateByTagsOutput::Ok { count } => assert_eq!(count, 0),
        }
    }
}
