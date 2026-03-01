// Content -- content-addressed storage with pinning and resolution
// Stores data by content identifier (CID), supports pinning for persistence guarantees,
// and resolves CIDs back to their original data.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ContentHandler;
use serde_json::json;

pub struct ContentHandlerImpl;

/// Compute a simple content identifier from data bytes
fn compute_cid(data: &[u8]) -> String {
    // Simple hash-based CID: use a basic hash for deterministic content addressing
    let mut hash: u64 = 0xcbf29ce484222325; // FNV offset basis
    for byte in data {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3); // FNV prime
    }
    format!("cid-{:016x}", hash)
}

#[async_trait]
impl ContentHandler for ContentHandlerImpl {
    async fn store(
        &self,
        input: ContentStoreInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStoreOutput, Box<dyn std::error::Error>> {
        let cid = compute_cid(&input.data);
        let size = input.data.len() as i64;

        storage.put("content", &cid, json!({
            "cid": cid,
            "name": input.name,
            "contentType": input.content_type,
            "size": size,
            "data": input.data,
            "pinned": false,
        })).await?;

        Ok(ContentStoreOutput::Ok { cid, size })
    }

    async fn pin(
        &self,
        input: ContentPinInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentPinOutput, Box<dyn std::error::Error>> {
        let record = storage.get("content", &input.cid).await?;
        match record {
            Some(mut r) => {
                r["pinned"] = json!(true);
                storage.put("content", &input.cid, r).await?;
                Ok(ContentPinOutput::Ok { cid: input.cid })
            }
            None => Ok(ContentPinOutput::Error {
                cid: input.cid.clone(),
                message: format!("Content '{}' not found", input.cid),
            }),
        }
    }

    async fn unpin(
        &self,
        input: ContentUnpinInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentUnpinOutput, Box<dyn std::error::Error>> {
        let record = storage.get("content", &input.cid).await?;
        match record {
            Some(mut r) => {
                r["pinned"] = json!(false);
                storage.put("content", &input.cid, r).await?;
                Ok(ContentUnpinOutput::Ok { cid: input.cid })
            }
            None => Ok(ContentUnpinOutput::Error {
                cid: input.cid.clone(),
                message: format!("Content '{}' not found", input.cid),
            }),
        }
    }

    async fn resolve(
        &self,
        input: ContentResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentResolveOutput, Box<dyn std::error::Error>> {
        let record = storage.get("content", &input.cid).await?;
        match record {
            Some(r) => {
                let data: Vec<u8> = r.get("data")
                    .and_then(|d| serde_json::from_value(d.clone()).ok())
                    .unwrap_or_default();
                let content_type = r["contentType"].as_str().unwrap_or("application/octet-stream").to_string();
                let size = r["size"].as_i64().unwrap_or(0);

                Ok(ContentResolveOutput::Ok {
                    data,
                    content_type,
                    size,
                })
            }
            None => Ok(ContentResolveOutput::NotFound { cid: input.cid }),
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
        let handler = ContentHandlerImpl;
        let result = handler.store(
            ContentStoreInput {
                data: b"hello world".to_vec(),
                name: "test.txt".to_string(),
                content_type: "text/plain".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ContentStoreOutput::Ok { cid, size } => {
                assert!(cid.starts_with("cid-"));
                assert_eq!(size, 11);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_pin_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentHandlerImpl;
        let result = handler.pin(
            ContentPinInput { cid: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentPinOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_unpin_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentHandlerImpl;
        let result = handler.unpin(
            ContentUnpinInput { cid: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentUnpinOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ContentHandlerImpl;
        let result = handler.resolve(
            ContentResolveInput { cid: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ContentResolveOutput::NotFound { cid } => {
                assert_eq!(cid, "nonexistent");
            },
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_store_then_pin() {
        let storage = InMemoryStorage::new();
        let handler = ContentHandlerImpl;

        let store_result = handler.store(
            ContentStoreInput {
                data: b"test data".to_vec(),
                name: "test".to_string(),
                content_type: "text/plain".to_string(),
            },
            &storage,
        ).await.unwrap();

        let cid = match store_result {
            ContentStoreOutput::Ok { cid, .. } => cid,
            _ => panic!("Expected Ok"),
        };

        let pin_result = handler.pin(
            ContentPinInput { cid: cid.clone() },
            &storage,
        ).await.unwrap();
        match pin_result {
            ContentPinOutput::Ok { cid: pinned_cid } => {
                assert_eq!(pinned_cid, cid);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
