// PageAsRecord Concept Implementation (Rust)
//
// Treats pages as structured records with properties, body children,
// and schema attachments.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- SetProperty ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetPropertyInput {
    pub node_id: String,
    pub name: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetPropertyOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- GetProperty ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetPropertyInput {
    pub node_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetPropertyOutput {
    #[serde(rename = "ok")]
    Ok {
        node_id: String,
        name: String,
        value: serde_json::Value,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- AppendToBody ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppendToBodyInput {
    pub node_id: String,
    pub child_node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AppendToBodyOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- AttachToSchema ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachToSchemaInput {
    pub node_id: String,
    pub schema_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AttachToSchemaOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
}

// --- DetachFromSchema ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetachFromSchemaInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DetachFromSchemaOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

pub struct PageAsRecordHandler;

impl PageAsRecordHandler {
    /// Ensures a page record exists, creating it if needed. Returns the record.
    async fn ensure_record(
        &self,
        node_id: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<serde_json::Value> {
        let existing = storage.get("page_record", node_id).await?;
        match existing {
            Some(record) => Ok(record),
            None => {
                let record = json!({
                    "node_id": node_id,
                    "properties": {},
                    "body": [],
                    "schema_id": null,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                    "updated_at": chrono::Utc::now().to_rfc3339(),
                });
                storage.put("page_record", node_id, record.clone()).await?;
                Ok(record)
            }
        }
    }

    pub async fn set_property(
        &self,
        input: SetPropertyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetPropertyOutput> {
        let existing = storage.get("page_record", &input.node_id).await?;
        match existing {
            None => Ok(SetPropertyOutput::NotFound {
                message: format!("page record '{}' not found", input.node_id),
            }),
            Some(mut record) => {
                if record["properties"].is_null() {
                    record["properties"] = json!({});
                }
                record["properties"][&input.name] = input.value;
                record["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("page_record", &input.node_id, record)
                    .await?;
                Ok(SetPropertyOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn get_property(
        &self,
        input: GetPropertyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetPropertyOutput> {
        let existing = storage.get("page_record", &input.node_id).await?;
        match existing {
            None => Ok(GetPropertyOutput::NotFound {
                message: format!("page record '{}' not found", input.node_id),
            }),
            Some(record) => {
                let props = &record["properties"];
                if props.is_null() || props.get(&input.name).is_none() {
                    return Ok(GetPropertyOutput::NotFound {
                        message: format!(
                            "property '{}' not found on page '{}'",
                            input.name, input.node_id
                        ),
                    });
                }
                Ok(GetPropertyOutput::Ok {
                    node_id: input.node_id,
                    name: input.name.clone(),
                    value: props[&input.name].clone(),
                })
            }
        }
    }

    pub async fn append_to_body(
        &self,
        input: AppendToBodyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AppendToBodyOutput> {
        let existing = storage.get("page_record", &input.node_id).await?;
        match existing {
            None => Ok(AppendToBodyOutput::NotFound {
                message: format!("page record '{}' not found", input.node_id),
            }),
            Some(mut record) => {
                let body = record["body"]
                    .as_array_mut()
                    .map(|a| {
                        a.push(json!(input.child_node_id));
                    });
                if body.is_none() {
                    record["body"] = json!([input.child_node_id]);
                }
                record["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("page_record", &input.node_id, record)
                    .await?;
                Ok(AppendToBodyOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }

    pub async fn attach_to_schema(
        &self,
        input: AttachToSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AttachToSchemaOutput> {
        let mut record = self.ensure_record(&input.node_id, storage).await?;
        record["schema_id"] = json!(input.schema_id);
        record["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
        storage
            .put("page_record", &input.node_id, record)
            .await?;
        Ok(AttachToSchemaOutput::Ok {
            node_id: input.node_id,
        })
    }

    pub async fn detach_from_schema(
        &self,
        input: DetachFromSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DetachFromSchemaOutput> {
        let existing = storage.get("page_record", &input.node_id).await?;
        match existing {
            None => Ok(DetachFromSchemaOutput::NotFound {
                message: format!("page record '{}' not found", input.node_id),
            }),
            Some(mut record) => {
                record["schema_id"] = serde_json::Value::Null;
                record["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("page_record", &input.node_id, record)
                    .await?;
                Ok(DetachFromSchemaOutput::Ok {
                    node_id: input.node_id,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    /// Helper to create a page record in storage.
    async fn seed_page(storage: &InMemoryStorage, node_id: &str) {
        storage
            .put(
                "page_record",
                node_id,
                json!({
                    "node_id": node_id,
                    "properties": {},
                    "body": [],
                    "schema_id": null,
                    "created_at": "2025-01-01T00:00:00Z",
                    "updated_at": "2025-01-01T00:00:00Z",
                }),
            )
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn set_property_on_existing_page() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        seed_page(&storage, "page1").await;

        let result = handler
            .set_property(
                SetPropertyInput {
                    node_id: "page1".into(),
                    name: "title".into(),
                    value: json!("Hello World"),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            SetPropertyOutput::Ok { node_id } => assert_eq!(node_id, "page1"),
            SetPropertyOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn set_property_page_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        let result = handler
            .set_property(
                SetPropertyInput {
                    node_id: "missing".into(),
                    name: "title".into(),
                    value: json!("Test"),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, SetPropertyOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn get_property_existing() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        seed_page(&storage, "page1").await;
        handler
            .set_property(
                SetPropertyInput {
                    node_id: "page1".into(),
                    name: "status".into(),
                    value: json!("published"),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_property(
                GetPropertyInput { node_id: "page1".into(), name: "status".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            GetPropertyOutput::Ok { node_id, name, value } => {
                assert_eq!(node_id, "page1");
                assert_eq!(name, "status");
                assert_eq!(value, json!("published"));
            }
            GetPropertyOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn get_property_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        seed_page(&storage, "page1").await;

        let result = handler
            .get_property(
                GetPropertyInput { node_id: "page1".into(), name: "nonexistent".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, GetPropertyOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn append_to_body() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        seed_page(&storage, "page1").await;

        let result = handler
            .append_to_body(
                AppendToBodyInput { node_id: "page1".into(), child_node_id: "block1".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            AppendToBodyOutput::Ok { node_id } => assert_eq!(node_id, "page1"),
            AppendToBodyOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn append_to_body_page_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        let result = handler
            .append_to_body(
                AppendToBodyInput { node_id: "missing".into(), child_node_id: "block1".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, AppendToBodyOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn attach_to_schema_creates_if_needed() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        let result = handler
            .attach_to_schema(
                AttachToSchemaInput { node_id: "new_page".into(), schema_id: "article".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            AttachToSchemaOutput::Ok { node_id } => assert_eq!(node_id, "new_page"),
        }
    }

    #[tokio::test]
    async fn detach_from_schema() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        handler
            .attach_to_schema(
                AttachToSchemaInput { node_id: "page1".into(), schema_id: "article".into() },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .detach_from_schema(
                DetachFromSchemaInput { node_id: "page1".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            DetachFromSchemaOutput::Ok { node_id } => assert_eq!(node_id, "page1"),
            DetachFromSchemaOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn detach_from_schema_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PageAsRecordHandler;
        let result = handler
            .detach_from_schema(
                DetachFromSchemaInput { node_id: "missing".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, DetachFromSchemaOutput::NotFound { .. }));
    }
}
