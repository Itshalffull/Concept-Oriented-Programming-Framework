// DataSource Concept Implementation (Rust)
//
// Data integration kit — register, authenticate, and monitor external data systems.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Register ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceRegisterInput {
    pub name: String,
    pub uri: String,
    pub credentials: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataSourceRegisterOutput {
    #[serde(rename = "ok")]
    Ok { source_id: String },
    #[serde(rename = "exists")]
    Exists { message: String },
}

// ── Connect ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceConnectInput {
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataSourceConnectOutput {
    #[serde(rename = "ok")]
    Ok { message: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── Discover ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceDiscoverInput {
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataSourceDiscoverOutput {
    #[serde(rename = "ok")]
    Ok { raw_schema: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// ── HealthCheck ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceHealthCheckInput {
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataSourceHealthCheckOutput {
    #[serde(rename = "ok")]
    Ok { status: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

// ── Deactivate ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceDeactivateInput {
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataSourceDeactivateOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

// ── Handler ──────────────────────────────────────────────

pub struct DataSourceHandler;

impl DataSourceHandler {
    pub async fn register(
        &self,
        input: DataSourceRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataSourceRegisterOutput> {
        let all = storage.find("data_source", None).await?;
        for entry in &all {
            if entry["name"].as_str() == Some(&input.name) {
                return Ok(DataSourceRegisterOutput::Exists {
                    message: format!("Source \"{}\" already registered", input.name),
                });
            }
        }

        let source_id = format!("src-{}", chrono::Utc::now().timestamp_millis());
        storage
            .put(
                "data_source",
                &source_id,
                json!({
                    "source_id": source_id,
                    "name": input.name,
                    "uri": input.uri,
                    "credentials": input.credentials,
                    "discovered_schema": null,
                    "status": "active",
                    "last_health_check": null,
                    "metadata": {},
                }),
            )
            .await?;

        Ok(DataSourceRegisterOutput::Ok { source_id })
    }

    pub async fn connect(
        &self,
        input: DataSourceConnectInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataSourceConnectOutput> {
        let existing = storage.get("data_source", &input.source_id).await?;
        match existing {
            None => Ok(DataSourceConnectOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
            Some(mut record) => {
                record["status"] = json!("active");
                record["last_health_check"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("data_source", &input.source_id, record).await?;
                Ok(DataSourceConnectOutput::Ok {
                    message: "connected".into(),
                })
            }
        }
    }

    pub async fn discover(
        &self,
        input: DataSourceDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataSourceDiscoverOutput> {
        let existing = storage.get("data_source", &input.source_id).await?;
        match existing {
            None => Ok(DataSourceDiscoverOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
            Some(mut record) => {
                let raw_schema = json!({"streams": [], "discovered_at": chrono::Utc::now().to_rfc3339()}).to_string();
                record["discovered_schema"] = json!(raw_schema);
                record["status"] = json!("active");
                storage.put("data_source", &input.source_id, record).await?;
                Ok(DataSourceDiscoverOutput::Ok { raw_schema })
            }
        }
    }

    pub async fn health_check(
        &self,
        input: DataSourceHealthCheckInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataSourceHealthCheckOutput> {
        let existing = storage.get("data_source", &input.source_id).await?;
        match existing {
            None => Ok(DataSourceHealthCheckOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
            Some(mut record) => {
                let status = record["status"].as_str().unwrap_or("unknown").to_string();
                record["last_health_check"] = json!(chrono::Utc::now().to_rfc3339());
                storage.put("data_source", &input.source_id, record).await?;
                Ok(DataSourceHealthCheckOutput::Ok { status })
            }
        }
    }

    pub async fn deactivate(
        &self,
        input: DataSourceDeactivateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataSourceDeactivateOutput> {
        let existing = storage.get("data_source", &input.source_id).await?;
        match existing {
            None => Ok(DataSourceDeactivateOutput::Notfound {
                message: format!("Source \"{}\" not found", input.source_id),
            }),
            Some(mut record) => {
                record["status"] = json!("inactive");
                storage.put("data_source", &input.source_id, record).await?;
                Ok(DataSourceDeactivateOutput::Ok)
            }
        }
    }
}

// ── Tests ────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn register_creates_source() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandler;
        let result = handler
            .register(
                DataSourceRegisterInput {
                    name: "test_api".into(),
                    uri: "https://api.example.com".into(),
                    credentials: "token:abc".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, DataSourceRegisterOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn register_rejects_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandler;
        handler
            .register(
                DataSourceRegisterInput {
                    name: "test_api".into(),
                    uri: "https://api.example.com".into(),
                    credentials: "token:abc".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        let result = handler
            .register(
                DataSourceRegisterInput {
                    name: "test_api".into(),
                    uri: "https://other.example.com".into(),
                    credentials: "token:xyz".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, DataSourceRegisterOutput::Exists { .. }));
    }

    #[tokio::test]
    async fn connect_returns_notfound_for_missing() {
        let storage = InMemoryStorage::new();
        let handler = DataSourceHandler;
        let result = handler
            .connect(DataSourceConnectInput { source_id: "nope".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, DataSourceConnectOutput::Notfound { .. }));
    }
}
