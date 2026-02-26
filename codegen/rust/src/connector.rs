// Connector Concept Implementation (Rust)
//
// Data integration kit — uniform read/write interface to diverse external systems.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Configure ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorConfigureInput {
    pub source_id: String,
    pub protocol_id: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConnectorConfigureOutput {
    #[serde(rename = "ok")]
    Ok { connector_id: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Read ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorReadInput {
    pub connector_id: String,
    pub query: String,
    pub options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConnectorReadOutput {
    #[serde(rename = "ok")]
    Ok { data: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Write ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorWriteInput {
    pub connector_id: String,
    pub data: String,
    pub options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConnectorWriteOutput {
    #[serde(rename = "ok")]
    Ok {
        created: u64,
        updated: u64,
        skipped: u64,
        errors: u64,
    },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Test ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorTestInput {
    pub connector_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConnectorTestOutput {
    #[serde(rename = "ok")]
    Ok { message: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Discover ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDiscoverInput {
    pub connector_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ConnectorDiscoverOutput {
    #[serde(rename = "ok")]
    Ok { streams: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Handler ──────────────────────────────────────────────

pub struct ConnectorHandler;

impl ConnectorHandler {
    pub async fn configure(
        &self,
        input: ConnectorConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConnectorConfigureOutput> {
        let parsed: serde_json::Value = match serde_json::from_str(&input.config) {
            Ok(v) => v,
            Err(_) => {
                return Ok(ConnectorConfigureOutput::Error {
                    message: "Invalid JSON configuration".into(),
                })
            }
        };

        let connector_id = format!("conn-{}", chrono::Utc::now().timestamp_millis());
        storage
            .put(
                "connector",
                &connector_id,
                json!({
                    "connector_id": connector_id,
                    "source_id": input.source_id,
                    "protocol_id": input.protocol_id,
                    "config": parsed,
                    "status": "idle",
                }),
            )
            .await?;

        Ok(ConnectorConfigureOutput::Ok { connector_id })
    }

    pub async fn read(
        &self,
        input: ConnectorReadInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConnectorReadOutput> {
        let existing = storage.get("connector", &input.connector_id).await?;
        match existing {
            None => Ok(ConnectorReadOutput::Notfound {
                message: format!("Connector \"{}\" not found", input.connector_id),
            }),
            Some(_record) => {
                // Plugin-dispatched to connector_protocol provider
                Ok(ConnectorReadOutput::Ok { data: "[]".into() })
            }
        }
    }

    pub async fn write(
        &self,
        input: ConnectorWriteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConnectorWriteOutput> {
        let existing = storage.get("connector", &input.connector_id).await?;
        match existing {
            None => Ok(ConnectorWriteOutput::Notfound {
                message: format!("Connector \"{}\" not found", input.connector_id),
            }),
            Some(_record) => {
                // Plugin-dispatched to connector_protocol provider
                Ok(ConnectorWriteOutput::Ok {
                    created: 0,
                    updated: 0,
                    skipped: 0,
                    errors: 0,
                })
            }
        }
    }

    pub async fn test(
        &self,
        input: ConnectorTestInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConnectorTestOutput> {
        let existing = storage.get("connector", &input.connector_id).await?;
        match existing {
            None => Ok(ConnectorTestOutput::Notfound {
                message: format!("Connector \"{}\" not found", input.connector_id),
            }),
            Some(_) => Ok(ConnectorTestOutput::Ok {
                message: "connected".into(),
            }),
        }
    }

    pub async fn discover(
        &self,
        input: ConnectorDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ConnectorDiscoverOutput> {
        let existing = storage.get("connector", &input.connector_id).await?;
        match existing {
            None => Ok(ConnectorDiscoverOutput::Notfound {
                message: format!("Connector \"{}\" not found", input.connector_id),
            }),
            Some(_) => Ok(ConnectorDiscoverOutput::Ok {
                streams: "[]".into(),
            }),
        }
    }
}

// ── Tests ────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn configure_creates_connector() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandler;
        let result = handler
            .configure(
                ConnectorConfigureInput {
                    source_id: "src-1".into(),
                    protocol_id: "rest".into(),
                    config: r#"{"base_url":"https://api.example.com"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ConnectorConfigureOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn configure_rejects_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandler;
        let result = handler
            .configure(
                ConnectorConfigureInput {
                    source_id: "src-1".into(),
                    protocol_id: "rest".into(),
                    config: "not json".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ConnectorConfigureOutput::Error { .. }));
    }

    #[tokio::test]
    async fn read_returns_notfound_for_missing() {
        let storage = InMemoryStorage::new();
        let handler = ConnectorHandler;
        let result = handler
            .read(
                ConnectorReadInput {
                    connector_id: "nope".into(),
                    query: "{}".into(),
                    options: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ConnectorReadOutput::Notfound { .. }));
    }
}
