// Cache Handler Implementation
//
// Key-value cache with TTL and tag-based invalidation.
// Stores entries by composite bin:key, supports time-based expiry
// and bulk invalidation by tags.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CacheHandler;
use serde_json::json;

pub struct CacheHandlerImpl;

#[async_trait]
impl CacheHandler for CacheHandlerImpl {
    async fn set(
        &self,
        input: CacheSetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheSetOutput, Box<dyn std::error::Error>> {
        let composite_key = format!("{}:{}", input.bin, input.key);
        let tag_list: Vec<&str> = input.tags
            .split(',')
            .map(|t| t.trim())
            .filter(|t| !t.is_empty())
            .collect();
        let created_at = chrono::Utc::now().timestamp_millis();

        storage.put("cacheEntry", &composite_key, json!({
            "bin": input.bin,
            "key": input.key,
            "data": input.data,
            "tags": tag_list,
            "maxAge": input.max_age,
            "createdAt": created_at,
        })).await?;

        Ok(CacheSetOutput::Ok)
    }

    async fn get(
        &self,
        input: CacheGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheGetOutput, Box<dyn std::error::Error>> {
        let composite_key = format!("{}:{}", input.bin, input.key);
        let entry = storage.get("cacheEntry", &composite_key).await?;

        match entry {
            None => Ok(CacheGetOutput::Miss),
            Some(entry) => {
                let created_at = entry["createdAt"].as_i64().unwrap_or(0);
                let max_age = entry["maxAge"].as_i64().unwrap_or(0);
                let now = chrono::Utc::now().timestamp_millis();

                // Check TTL expiration
                if max_age > 0 && (now - created_at) > max_age * 1000 {
                    storage.del("cacheEntry", &composite_key).await?;
                    return Ok(CacheGetOutput::Miss);
                }

                let data = entry["data"].as_str().unwrap_or("").to_string();
                Ok(CacheGetOutput::Ok { data })
            }
        }
    }

    async fn invalidate(
        &self,
        input: CacheInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheInvalidateOutput, Box<dyn std::error::Error>> {
        let composite_key = format!("{}:{}", input.bin, input.key);
        let entry = storage.get("cacheEntry", &composite_key).await?;

        if entry.is_none() {
            return Ok(CacheInvalidateOutput::Notfound);
        }

        storage.del("cacheEntry", &composite_key).await?;
        Ok(CacheInvalidateOutput::Ok)
    }

    async fn invalidate_by_tags(
        &self,
        input: CacheInvalidateByTagsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheInvalidateByTagsOutput, Box<dyn std::error::Error>> {
        let target_tags: Vec<&str> = input.tags
            .split(',')
            .map(|t| t.trim())
            .filter(|t| !t.is_empty())
            .collect();

        let all_entries = storage.find("cacheEntry", json!({})).await?;
        let mut count: i64 = 0;

        for entry in &all_entries {
            let entry_tags: Vec<String> = entry["tags"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let has_match = target_tags.iter().any(|t| entry_tags.iter().any(|et| et == t));

            if has_match {
                let composite_key = format!(
                    "{}:{}",
                    entry["bin"].as_str().unwrap_or(""),
                    entry["key"].as_str().unwrap_or("")
                );
                storage.del("cacheEntry", &composite_key).await?;
                count += 1;
            }
        }

        Ok(CacheInvalidateByTagsOutput::Ok { count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_set_and_get_cache_entry() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandlerImpl;
        handler.set(
            CacheSetInput {
                bin: "articles".to_string(),
                key: "article-1".to_string(),
                data: "cached-content".to_string(),
                tags: "article,public".to_string(),
                max_age: 3600,
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            CacheGetInput {
                bin: "articles".to_string(),
                key: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CacheGetOutput::Ok { data } => {
                assert_eq!(data, "cached-content");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_miss() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandlerImpl;
        let result = handler.get(
            CacheGetInput {
                bin: "missing".to_string(),
                key: "missing-key".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CacheGetOutput::Miss => {}
            _ => panic!("Expected Miss variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_existing_entry() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandlerImpl;
        handler.set(
            CacheSetInput {
                bin: "users".to_string(),
                key: "user-1".to_string(),
                data: "data".to_string(),
                tags: "user".to_string(),
                max_age: 600,
            },
            &storage,
        ).await.unwrap();
        let result = handler.invalidate(
            CacheInvalidateInput {
                bin: "users".to_string(),
                key: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CacheInvalidateOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_missing_entry_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandlerImpl;
        let result = handler.invalidate(
            CacheInvalidateInput {
                bin: "x".to_string(),
                key: "y".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CacheInvalidateOutput::Notfound => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_invalidate_by_tags() {
        let storage = InMemoryStorage::new();
        let handler = CacheHandlerImpl;
        let result = handler.invalidate_by_tags(
            CacheInvalidateByTagsInput { tags: "nonexistent-tag".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CacheInvalidateByTagsOutput::Ok { count } => {
                assert_eq!(count, 0);
            }
        }
    }
}
