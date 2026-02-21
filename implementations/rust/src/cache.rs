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
