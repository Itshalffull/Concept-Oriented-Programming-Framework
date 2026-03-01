// Registry concept implementation
// Service registry for concept discovery. Concepts register their URI
// and transport configuration, deregister on shutdown, and emit heartbeats
// for health monitoring.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RegistryHandler;
use serde_json::json;

pub struct RegistryHandlerImpl;

#[async_trait]
impl RegistryHandler for RegistryHandlerImpl {
    async fn register(
        &self,
        input: RegistryRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RegistryRegisterOutput, Box<dyn std::error::Error>> {
        if input.uri.trim().is_empty() {
            return Ok(RegistryRegisterOutput::Error {
                message: "URI cannot be empty".to_string(),
            });
        }

        // Extract concept name from URI (last segment)
        let concept = input.uri
            .rsplit('/')
            .next()
            .unwrap_or(&input.uri)
            .to_string();

        let now = chrono::Utc::now().to_rfc3339();

        storage.put("registry", &input.uri, json!({
            "uri": input.uri,
            "concept": concept,
            "transport": input.transport,
            "registeredAt": now,
            "lastHeartbeat": now,
            "status": "active",
        })).await?;

        Ok(RegistryRegisterOutput::Ok { concept })
    }

    async fn deregister(
        &self,
        input: RegistryDeregisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RegistryDeregisterOutput, Box<dyn std::error::Error>> {
        storage.del("registry", &input.uri).await?;

        Ok(RegistryDeregisterOutput::Ok)
    }

    async fn heartbeat(
        &self,
        input: RegistryHeartbeatInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RegistryHeartbeatOutput, Box<dyn std::error::Error>> {
        let record = storage.get("registry", &input.uri).await?;

        match record {
            Some(mut r) => {
                r["lastHeartbeat"] = json!(chrono::Utc::now().to_rfc3339());
                r["status"] = json!("active");
                storage.put("registry", &input.uri, r).await?;

                Ok(RegistryHeartbeatOutput::Ok { available: true })
            }
            None => {
                Ok(RegistryHeartbeatOutput::Ok { available: false })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_concept() {
        let storage = InMemoryStorage::new();
        let handler = RegistryHandlerImpl;
        let result = handler.register(
            RegistryRegisterInput {
                uri: "clef://concepts/user".to_string(),
                transport: json!({"type": "http", "port": 8080}),
            },
            &storage,
        ).await.unwrap();
        match result {
            RegistryRegisterOutput::Ok { concept } => {
                assert_eq!(concept, "user");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_empty_uri() {
        let storage = InMemoryStorage::new();
        let handler = RegistryHandlerImpl;
        let result = handler.register(
            RegistryRegisterInput {
                uri: "".to_string(),
                transport: json!({}),
            },
            &storage,
        ).await.unwrap();
        match result {
            RegistryRegisterOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_deregister() {
        let storage = InMemoryStorage::new();
        let handler = RegistryHandlerImpl;
        handler.register(
            RegistryRegisterInput {
                uri: "clef://concepts/user".to_string(),
                transport: json!({}),
            },
            &storage,
        ).await.unwrap();
        let result = handler.deregister(
            RegistryDeregisterInput { uri: "clef://concepts/user".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RegistryDeregisterOutput::Ok => {}
        }
    }

    #[tokio::test]
    async fn test_heartbeat_registered() {
        let storage = InMemoryStorage::new();
        let handler = RegistryHandlerImpl;
        handler.register(
            RegistryRegisterInput {
                uri: "clef://concepts/user".to_string(),
                transport: json!({}),
            },
            &storage,
        ).await.unwrap();
        let result = handler.heartbeat(
            RegistryHeartbeatInput { uri: "clef://concepts/user".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RegistryHeartbeatOutput::Ok { available } => assert!(available),
        }
    }

    #[tokio::test]
    async fn test_heartbeat_not_registered() {
        let storage = InMemoryStorage::new();
        let handler = RegistryHandlerImpl;
        let result = handler.heartbeat(
            RegistryHeartbeatInput { uri: "clef://concepts/unknown".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RegistryHeartbeatOutput::Ok { available } => assert!(!available),
        }
    }
}
