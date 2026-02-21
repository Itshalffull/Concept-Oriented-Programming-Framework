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
