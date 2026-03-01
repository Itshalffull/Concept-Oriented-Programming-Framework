// Connector -- configure and manage data source connections
// Supports protocol-agnostic read/write operations with connection testing and stream discovery.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ConnectorHandler;
use serde_json::json;

pub struct ConnectorHandlerImpl;

#[async_trait]
impl ConnectorHandler for ConnectorHandlerImpl {
    async fn configure(
        &self,
        input: ConnectorConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorConfigureOutput, Box<dyn std::error::Error>> {
        // Validate config is valid JSON
        let parsed_config: serde_json::Value = match serde_json::from_str(&input.config) {
            Ok(v) => v,
            Err(_) => {
                return Ok(ConnectorConfigureOutput::Error {
                    message: "Invalid JSON configuration".to_string(),
                });
            }
        };

        // Generate a unique connector ID
        let counter = storage.get("connector_meta", "counter").await?;
        let next_id = match counter {
            Some(val) => val["value"].as_i64().unwrap_or(0) + 1,
            None => 1,
        };
        storage.put("connector_meta", "counter", json!({ "value": next_id })).await?;

        let connector_id = format!("conn-{}", next_id);

        storage.put("connector", &connector_id, json!({
            "connectorId": connector_id,
            "sourceId": input.source_id,
            "protocolId": input.protocol_id,
            "config": parsed_config,
            "status": "idle",
        })).await?;

        Ok(ConnectorConfigureOutput::Ok { connector_id })
    }

    async fn read(
        &self,
        input: ConnectorReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorReadOutput, Box<dyn std::error::Error>> {
        let connector = storage.get("connector", &input.connector_id).await?;
        let record = match connector {
            Some(r) => r,
            None => {
                return Ok(ConnectorReadOutput::Notfound {
                    message: format!("Connector '{}' not found", input.connector_id),
                });
            }
        };

        // Mark as reading
        let mut reading = record.clone();
        reading["status"] = json!("reading");
        storage.put("connector", &input.connector_id, reading).await?;

        // Record the read request for the protocol provider to handle
        let read_id = format!("read-{}", input.connector_id);
        storage.put("connectorRead", &read_id, json!({
            "connectorId": input.connector_id,
            "query": input.query,
            "options": input.options,
            "protocolId": record["protocolId"],
        })).await?;

        // Reset status to idle
        let mut idle = record.clone();
        idle["status"] = json!("idle");
        storage.put("connector", &input.connector_id, idle).await?;

        Ok(ConnectorReadOutput::Ok {
            data: "[]".to_string(),
        })
    }

    async fn write(
        &self,
        input: ConnectorWriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorWriteOutput, Box<dyn std::error::Error>> {
        let connector = storage.get("connector", &input.connector_id).await?;
        let record = match connector {
            Some(r) => r,
            None => {
                return Ok(ConnectorWriteOutput::Notfound {
                    message: format!("Connector '{}' not found", input.connector_id),
                });
            }
        };

        // Mark as writing
        let mut writing = record.clone();
        writing["status"] = json!("writing");
        storage.put("connector", &input.connector_id, writing).await?;

        // Record the write request for the protocol provider
        let write_id = format!("write-{}", input.connector_id);
        storage.put("connectorWrite", &write_id, json!({
            "connectorId": input.connector_id,
            "data": input.data,
            "options": input.options,
            "protocolId": record["protocolId"],
        })).await?;

        // Reset status
        let mut idle = record.clone();
        idle["status"] = json!("idle");
        storage.put("connector", &input.connector_id, idle).await?;

        Ok(ConnectorWriteOutput::Ok {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
        })
    }

    async fn test(
        &self,
        input: ConnectorTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorTestOutput, Box<dyn std::error::Error>> {
        let connector = storage.get("connector", &input.connector_id).await?;
        if connector.is_none() {
            return Ok(ConnectorTestOutput::Notfound {
                message: format!("Connector '{}' not found", input.connector_id),
            });
        }

        // Protocol provider would actually test the connection here
        Ok(ConnectorTestOutput::Ok {
            message: "connected".to_string(),
        })
    }

    async fn discover(
        &self,
        input: ConnectorDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorDiscoverOutput, Box<dyn std::error::Error>> {
        let connector = storage.get("connector", &input.connector_id).await?;
        if connector.is_none() {
            return Ok(ConnectorDiscoverOutput::Notfound {
                message: format!("Connector '{}' not found", input.connector_id),
            });
        }

        // Protocol provider would discover available streams here
        Ok(ConnectorDiscoverOutput::Ok {
            streams: "[]".to_string(),
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
        let handler = ConnectorHandlerImpl;
        let result = handler.configure(
            ConnectorConfigureInput {
                source_id: "src-1".to_string(),
                protocol_id: "http".to_string(),
                config: r#"{"url":"http://example.com"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorConfigureOutput::Ok { connector_id } => {
                assert!(connector_id.starts_with("conn-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_configure_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandlerImpl;
        let result = handler.configure(
            ConnectorConfigureInput {
                source_id: "src-1".to_string(),
                protocol_id: "http".to_string(),
                config: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorConfigureOutput::Error { message } => {
                assert!(message.contains("Invalid JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_read_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandlerImpl;
        let result = handler.read(
            ConnectorReadInput {
                connector_id: "nonexistent".to_string(),
                query: "SELECT *".to_string(),
                options: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorReadOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_write_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandlerImpl;
        let result = handler.write(
            ConnectorWriteInput {
                connector_id: "nonexistent".to_string(),
                data: "{}".to_string(),
                options: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorWriteOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_test_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandlerImpl;
        let result = handler.test(
            ConnectorTestInput { connector_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorTestOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_discover_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandlerImpl;
        let result = handler.discover(
            ConnectorDiscoverInput { connector_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ConnectorDiscoverOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
