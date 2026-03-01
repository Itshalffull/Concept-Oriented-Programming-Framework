// Transport concept implementation
// Data transport layer with multi-protocol support, caching, retry policies, and offline queue.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TransportHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("P-{}", id)
}

const VALID_KINDS: &[&str] = &["rest", "graphql", "websocket"];

pub struct TransportHandlerImpl;

#[async_trait]
impl TransportHandler for TransportHandlerImpl {
    async fn configure(
        &self,
        input: TransportConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportConfigureOutput, Box<dyn std::error::Error>> {
        if !VALID_KINDS.contains(&input.kind.as_str()) {
            return Ok(TransportConfigureOutput::Invalid {
                message: format!("Invalid transport kind \"{}\". Valid kinds: {}", input.kind, VALID_KINDS.join(", ")),
            });
        }

        let base_url = input.base_url.as_deref().unwrap_or("");
        if base_url.is_empty() {
            return Ok(TransportConfigureOutput::Invalid {
                message: "Base URL is required".to_string(),
            });
        }

        let id = if input.transport.is_empty() { next_id() } else { input.transport };

        let retry_policy = input.retry_policy.unwrap_or_else(|| {
            json!({"maxRetries": 3, "backoff": "exponential"}).to_string()
        });

        storage.put("transport", &id, json!({
            "kind": input.kind,
            "baseUrl": base_url,
            "auth": input.auth.unwrap_or_default(),
            "status": "configured",
            "retryPolicy": retry_policy,
            "cacheTTL": 300,
            "pendingQueue": "[]"
        })).await?;

        Ok(TransportConfigureOutput::Ok { transport: id })
    }

    async fn fetch(
        &self,
        input: TransportFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportFetchOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("transport", &input.transport).await?;
        if existing.is_none() {
            return Ok(TransportFetchOutput::Error {
                transport: input.transport,
                status: 404,
                message: "Transport not found".to_string(),
            });
        }

        let record = existing.unwrap();
        let status = record["status"].as_str().unwrap_or("");
        if status != "configured" && status != "connected" {
            return Ok(TransportFetchOutput::Error {
                transport: input.transport,
                status: 503,
                message: format!("Transport is in \"{}\" state", status),
            });
        }

        // Check cache
        let cache_key = format!("cache:{}:{}", input.transport, input.query);
        let cached = storage.get("transportCache", &cache_key).await?;
        if let Some(ref cached_val) = cached {
            let timestamp = cached_val["timestamp"].as_i64().unwrap_or(0);
            let ttl = record["cacheTTL"].as_i64().unwrap_or(300) * 1000;
            let now = chrono::Utc::now().timestamp_millis();
            let age = now - timestamp;
            if age < ttl {
                return Ok(TransportFetchOutput::Cached {
                    transport: input.transport,
                    data: cached_val["data"].as_str().unwrap_or("").to_string(),
                    age: (age / 1000) as i64,
                });
            }
        }

        // Simulate fetch
        let kind = record["kind"].as_str().unwrap_or("");
        let base_url = record["baseUrl"].as_str().unwrap_or("");
        let data = json!({
            "source": format!("{}://{}", kind, base_url),
            "query": input.query,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }).to_string();

        // Store in cache
        storage.put("transportCache", &cache_key, json!({
            "data": data,
            "timestamp": chrono::Utc::now().timestamp_millis()
        })).await?;

        Ok(TransportFetchOutput::Ok {
            transport: input.transport,
            data,
        })
    }

    async fn mutate(
        &self,
        input: TransportMutateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportMutateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("transport", &input.transport).await?;
        if existing.is_none() {
            return Ok(TransportMutateOutput::Error {
                transport: input.transport,
                status: 404,
                message: "Transport not found".to_string(),
            });
        }

        let record = existing.unwrap();
        let status = record["status"].as_str().unwrap_or("");

        if status == "offline" {
            let queue_str = record["pendingQueue"].as_str().unwrap_or("[]");
            let mut queue: Vec<serde_json::Value> = serde_json::from_str(queue_str).unwrap_or_default();
            queue.push(json!({
                "action": input.action,
                "input": input.input,
                "queuedAt": chrono::Utc::now().to_rfc3339()
            }));

            let mut updated = record.clone();
            updated["pendingQueue"] = json!(serde_json::to_string(&queue)?);
            storage.put("transport", &input.transport, updated).await?;

            return Ok(TransportMutateOutput::Queued {
                transport: input.transport,
                queue_position: queue.len() as i64,
            });
        }

        let result = json!({
            "action": input.action,
            "input": input.input,
            "result": "success",
            "timestamp": chrono::Utc::now().to_rfc3339()
        }).to_string();

        Ok(TransportMutateOutput::Ok {
            transport: input.transport,
            result,
        })
    }

    async fn flush_queue(
        &self,
        input: TransportFlushQueueInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportFlushQueueOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("transport", &input.transport).await?;
        if existing.is_none() {
            return Ok(TransportFlushQueueOutput::Ok {
                transport: input.transport,
                flushed: 0,
            });
        }

        let record = existing.unwrap();
        let queue_str = record["pendingQueue"].as_str().unwrap_or("[]");
        let queue: Vec<serde_json::Value> = serde_json::from_str(queue_str).unwrap_or_default();

        if queue.is_empty() {
            return Ok(TransportFlushQueueOutput::Ok {
                transport: input.transport,
                flushed: 0,
            });
        }

        let status = record["status"].as_str().unwrap_or("");
        if status == "offline" {
            return Ok(TransportFlushQueueOutput::Partial {
                transport: input.transport,
                sent: 0,
                failed: queue.len() as i64,
            });
        }

        let sent = queue.len() as i64;
        let mut updated = record.clone();
        updated["pendingQueue"] = json!("[]");
        storage.put("transport", &input.transport, updated).await?;

        Ok(TransportFlushQueueOutput::Ok {
            transport: input.transport,
            flushed: sent,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_configure_success() {
        let storage = InMemoryStorage::new();
        let handler = TransportHandlerImpl;
        let result = handler.configure(
            TransportConfigureInput {
                transport: "tp1".to_string(),
                kind: "rest".to_string(),
                base_url: Some("https://api.example.com".to_string()),
                auth: None,
                retry_policy: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportConfigureOutput::Ok { transport } => {
                assert_eq!(transport, "tp1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_configure_invalid_kind() {
        let storage = InMemoryStorage::new();
        let handler = TransportHandlerImpl;
        let result = handler.configure(
            TransportConfigureInput {
                transport: "tp1".to_string(),
                kind: "invalid".to_string(),
                base_url: Some("https://api.example.com".to_string()),
                auth: None,
                retry_policy: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportConfigureOutput::Invalid { message } => {
                assert!(message.contains("Invalid transport kind"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_configure_no_base_url() {
        let storage = InMemoryStorage::new();
        let handler = TransportHandlerImpl;
        let result = handler.configure(
            TransportConfigureInput {
                transport: "tp1".to_string(),
                kind: "rest".to_string(),
                base_url: None,
                auth: None,
                retry_policy: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportConfigureOutput::Invalid { message } => {
                assert!(message.contains("Base URL"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_transport_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TransportHandlerImpl;
        let result = handler.fetch(
            TransportFetchInput {
                transport: "missing".to_string(),
                query: "test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportFetchOutput::Error { status, .. } => {
                assert_eq!(status, 404);
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_fetch_after_configure() {
        let storage = InMemoryStorage::new();
        let handler = TransportHandlerImpl;
        handler.configure(
            TransportConfigureInput {
                transport: "tp1".to_string(),
                kind: "rest".to_string(),
                base_url: Some("https://api.example.com".to_string()),
                auth: None,
                retry_policy: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.fetch(
            TransportFetchInput {
                transport: "tp1".to_string(),
                query: "users".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportFetchOutput::Ok { data, .. } => {
                assert!(!data.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_mutate_transport_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TransportHandlerImpl;
        let result = handler.mutate(
            TransportMutateInput {
                transport: "missing".to_string(),
                action: "create".to_string(),
                input: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportMutateOutput::Error { status, .. } => {
                assert_eq!(status, 404);
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_flush_queue_no_transport() {
        let storage = InMemoryStorage::new();
        let handler = TransportHandlerImpl;
        let result = handler.flush_queue(
            TransportFlushQueueInput { transport: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TransportFlushQueueOutput::Ok { flushed, .. } => {
                assert_eq!(flushed, 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
