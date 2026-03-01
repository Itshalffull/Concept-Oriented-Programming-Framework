// DataSource Handler Implementation
//
// Data source registration, connection testing, schema discovery,
// health checks, and deactivation lifecycle.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DataSourceHandler;
use serde_json::json;

pub struct DataSourceHandlerImpl;

fn generate_source_id() -> String {
    format!("src-{}", chrono::Utc::now().timestamp_millis())
}

#[async_trait]
impl DataSourceHandler for DataSourceHandlerImpl {
    async fn register(
        &self,
        input: DataSourceRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceRegisterOutput, Box<dyn std::error::Error>> {
        // Check for duplicates by name
        let existing = storage.find("dataSource", None).await?;
        for source in &existing {
            if source.get("name").and_then(|v| v.as_str()) == Some(&input.name) {
                return Ok(DataSourceRegisterOutput::Exists {
                    message: format!("Source \"{}\" already registered", input.name),
                });
            }
        }

        let source_id = generate_source_id();
        storage.put("dataSource", &source_id, json!({
            "sourceId": source_id,
            "name": input.name,
            "uri": input.uri,
            "credentials": input.credentials,
            "discoveredSchema": null,
            "status": "active",
            "lastHealthCheck": null,
            "metadata": {},
        })).await?;

        Ok(DataSourceRegisterOutput::Ok { source_id })
    }

    async fn connect(
        &self,
        input: DataSourceConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceConnectOutput, Box<dyn std::error::Error>> {
        let source = storage.get("dataSource", &input.source_id).await?;
        let source = match source {
            Some(s) => s,
            None => return Ok(DataSourceConnectOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
        };

        let mut updated = source.clone();
        updated["status"] = json!("active");
        updated["lastHealthCheck"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("dataSource", &input.source_id, updated).await?;

        Ok(DataSourceConnectOutput::Ok {
            message: "connected".to_string(),
        })
    }

    async fn discover(
        &self,
        input: DataSourceDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceDiscoverOutput, Box<dyn std::error::Error>> {
        let source = storage.get("dataSource", &input.source_id).await?;
        let source = match source {
            Some(s) => s,
            None => return Ok(DataSourceDiscoverOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
        };

        let raw_schema = json!({
            "streams": [],
            "discoveredAt": chrono::Utc::now().to_rfc3339(),
        });
        let raw_schema_str = serde_json::to_string(&raw_schema)?;

        let mut updated = source.clone();
        updated["status"] = json!("active");
        updated["discoveredSchema"] = json!(raw_schema_str);
        storage.put("dataSource", &input.source_id, updated).await?;

        Ok(DataSourceDiscoverOutput::Ok { raw_schema: raw_schema_str })
    }

    async fn health_check(
        &self,
        input: DataSourceHealthCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceHealthCheckOutput, Box<dyn std::error::Error>> {
        let source = storage.get("dataSource", &input.source_id).await?;
        let source = match source {
            Some(s) => s,
            None => return Ok(DataSourceHealthCheckOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
        };

        let status = source.get("status").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
        let mut updated = source.clone();
        updated["lastHealthCheck"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("dataSource", &input.source_id, updated).await?;

        Ok(DataSourceHealthCheckOutput::Ok { status })
    }

    async fn deactivate(
        &self,
        input: DataSourceDeactivateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceDeactivateOutput, Box<dyn std::error::Error>> {
        let source = storage.get("dataSource", &input.source_id).await?;
        let source = match source {
            Some(s) => s,
            None => return Ok(DataSourceDeactivateOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
        };

        let mut updated = source.clone();
        updated["status"] = json!("inactive");
        storage.put("dataSource", &input.source_id, updated).await?;

        Ok(DataSourceDeactivateOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandlerImpl;
        let result = handler.register(
            DataSourceRegisterInput {
                name: "test-db".to_string(),
                uri: "postgres://localhost/test".to_string(),
                credentials: "secret".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataSourceRegisterOutput::Ok { source_id } => {
                assert!(!source_id.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandlerImpl;
        handler.register(
            DataSourceRegisterInput {
                name: "test-db".to_string(),
                uri: "postgres://localhost/test".to_string(),
                credentials: "secret".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            DataSourceRegisterInput {
                name: "test-db".to_string(),
                uri: "postgres://localhost/test2".to_string(),
                credentials: "secret2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataSourceRegisterOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_connect_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandlerImpl;
        let result = handler.connect(
            DataSourceConnectInput {
                source_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataSourceConnectOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_discover_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandlerImpl;
        let result = handler.discover(
            DataSourceDiscoverInput {
                source_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataSourceDiscoverOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_health_check_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandlerImpl;
        let result = handler.health_check(
            DataSourceHealthCheckInput {
                source_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataSourceHealthCheckOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_deactivate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandlerImpl;
        let result = handler.deactivate(
            DataSourceDeactivateInput {
                source_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataSourceDeactivateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
