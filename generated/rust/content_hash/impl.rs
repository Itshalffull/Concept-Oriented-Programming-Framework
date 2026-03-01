// Content Hash -- content-addressed storage with hash-based integrity verification
// Stores content keyed by its hash, supports retrieval, verification, and deletion.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ContentHashHandler;
use serde_json::json;

pub struct ContentHashHandlerImpl;

/// Compute a hash from content bytes using FNV-1a
fn hash_content(content: &[u8]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in content {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)
}

#[async_trait]
impl ContentHashHandler for ContentHashHandlerImpl {
    async fn store(
        &self,
        input: ContentHashStoreInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashStoreOutput, Box<dyn std::error::Error>> {
        let hash = hash_content(&input.content);

        let existing = storage.get("content_hash", &hash).await?;
        if existing.is_some() {
            return Ok(ContentHashStoreOutput::AlreadyExists { hash });
        }

        storage.put("content_hash", &hash, json!({
            "hash": hash,
            "content": input.content,
            "size": input.content.len(),
            "refCount": 1,
        })).await?;

        Ok(ContentHashStoreOutput::Ok { hash })
    }

    async fn retrieve(
        &self,
        input: ContentHashRetrieveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashRetrieveOutput, Box<dyn std::error::Error>> {
        let record = storage.get("content_hash", &input.hash).await?;
        match record {
            Some(r) => {
                let content: Vec<u8> = r.get("content")
                    .and_then(|c| serde_json::from_value(c.clone()).ok())
                    .unwrap_or_default();
                Ok(ContentHashRetrieveOutput::Ok { content })
            }
            None => Ok(ContentHashRetrieveOutput::NotFound {
                message: format!("No content found for hash '{}'", input.hash),
            }),
        }
    }

    async fn verify(
        &self,
        input: ContentHashVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashVerifyOutput, Box<dyn std::error::Error>> {
        let record = storage.get("content_hash", &input.hash).await?;
        if record.is_none() {
            return Ok(ContentHashVerifyOutput::NotFound {
                message: format!("No content found for hash '{}'", input.hash),
            });
        }

        // Recompute hash from provided content and compare
        let actual_hash = hash_content(&input.content);

        if actual_hash == input.hash {
            Ok(ContentHashVerifyOutput::Valid)
        } else {
            Ok(ContentHashVerifyOutput::Corrupt {
                expected: input.hash,
                actual: actual_hash,
            })
        }
    }

    async fn delete(
        &self,
        input: ContentHashDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashDeleteOutput, Box<dyn std::error::Error>> {
        let record = storage.get("content_hash", &input.hash).await?;
        match record {
            Some(r) => {
                let ref_count = r["refCount"].as_i64().unwrap_or(0);
                if ref_count > 1 {
                    return Ok(ContentHashDeleteOutput::Referenced {
                        message: format!(
                            "Content hash '{}' still has {} references",
                            input.hash, ref_count
                        ),
                    });
                }

                storage.del("content_hash", &input.hash).await?;
                Ok(ContentHashDeleteOutput::Ok)
            }
            None => Ok(ContentHashDeleteOutput::NotFound {
                message: format!("No content found for hash '{}'", input.hash),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_store_success() {
        let storage = InMemoryStorage::new();
        let handler = ContentHashHandlerImpl;
        let result = handler.store(
            ContentHashStoreInput { content: b"test content".to_vec() },
            &storage,
        ).await.unwrap();
        match result {
            ContentHashStoreOutput::Ok { hash } => {
                assert!(!hash.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_store_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = ContentHashHandlerImpl;

        handler.store(
            ContentHashStoreInput { content: b"test".to_vec() },
            &storage,
        ).await.unwrap();

        let result = handler.store(
            ContentHashStoreInput { content: b"test".to_vec() },
            &storage,
        ).await.unwrap();
        match result {
            ContentHashStoreOutput::AlreadyExists { .. } => {},
            _ => panic!("Expected AlreadyExists variant"),
        }
    }

    #[tokio::test]
    async fn test_retrieve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentHashHandlerImpl;
        let result = handler.retrieve(
            ContentHashRetrieveInput { hash: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentHashRetrieveOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_verify_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentHashHandlerImpl;
        let result = handler.verify(
            ContentHashVerifyInput {
                hash: "nonexistent".to_string(),
                content: b"test".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentHashVerifyOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentHashHandlerImpl;
        let result = handler.delete(
            ContentHashDeleteInput { hash: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentHashDeleteOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_store_then_delete() {
        let storage = InMemoryStorage::new();
        let handler = ContentHashHandlerImpl;

        let store_result = handler.store(
            ContentHashStoreInput { content: b"deleteme".to_vec() },
            &storage,
        ).await.unwrap();

        let hash = match store_result {
            ContentHashStoreOutput::Ok { hash } => hash,
            _ => panic!("Expected Ok"),
        };

        let del_result = handler.delete(
            ContentHashDeleteInput { hash },
            &storage,
        ).await.unwrap();
        match del_result {
            ContentHashDeleteOutput::Ok => {},
            _ => panic!("Expected Ok variant for delete"),
        }
    }
}
