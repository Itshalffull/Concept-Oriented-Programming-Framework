// Property Concept Implementation (Rust)
//
// Key-value property storage for nodes, with typed property definitions.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- Set ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetInput {
    pub node_id: String,
    pub key: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SetOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, key: String },
}

// --- Get ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetInput {
    pub node_id: String,
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetOutput {
    #[serde(rename = "ok")]
    Ok {
        node_id: String,
        key: String,
        value: serde_json::Value,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Delete ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteInput {
    pub node_id: String,
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeleteOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String, key: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- DefineType ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefineTypeInput {
    pub key: String,
    pub prop_type: String,
    pub constraints: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DefineTypeOutput {
    #[serde(rename = "ok")]
    Ok { key: String },
}

// --- ListAll ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAllInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ListAllOutput {
    #[serde(rename = "ok")]
    Ok {
        node_id: String,
        properties: String,
    },
}

pub struct PropertyHandler;

impl PropertyHandler {
    pub async fn set(
        &self,
        input: SetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetOutput> {
        let compound_key = format!("{}:{}", input.node_id, input.key);
        storage
            .put(
                "property",
                &compound_key,
                json!({
                    "node_id": input.node_id,
                    "key": input.key,
                    "value": input.value,
                    "updated_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(SetOutput::Ok {
            node_id: input.node_id,
            key: input.key,
        })
    }

    pub async fn get(
        &self,
        input: GetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetOutput> {
        let compound_key = format!("{}:{}", input.node_id, input.key);
        let existing = storage.get("property", &compound_key).await?;
        match existing {
            None => Ok(GetOutput::NotFound {
                message: format!(
                    "property '{}' not found on node '{}'",
                    input.key, input.node_id
                ),
            }),
            Some(record) => {
                let value = record
                    .get("value")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                Ok(GetOutput::Ok {
                    node_id: input.node_id,
                    key: input.key,
                    value,
                })
            }
        }
    }

    pub async fn delete(
        &self,
        input: DeleteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DeleteOutput> {
        let compound_key = format!("{}:{}", input.node_id, input.key);
        let existing = storage.get("property", &compound_key).await?;
        match existing {
            None => Ok(DeleteOutput::NotFound {
                message: format!(
                    "property '{}' not found on node '{}'",
                    input.key, input.node_id
                ),
            }),
            Some(_) => {
                storage.del("property", &compound_key).await?;
                Ok(DeleteOutput::Ok {
                    node_id: input.node_id,
                    key: input.key,
                })
            }
        }
    }

    pub async fn define_type(
        &self,
        input: DefineTypeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineTypeOutput> {
        storage
            .put(
                "property_type",
                &input.key,
                json!({
                    "key": input.key,
                    "prop_type": input.prop_type,
                    "constraints": input.constraints,
                    "defined_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(DefineTypeOutput::Ok { key: input.key })
    }

    pub async fn list_all(
        &self,
        input: ListAllInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ListAllOutput> {
        let all_props = storage
            .find("property", Some(&json!({ "node_id": input.node_id })))
            .await?;
        let properties_json = serde_json::to_string(&all_props)?;
        Ok(ListAllOutput::Ok {
            node_id: input.node_id,
            properties: properties_json,
        })
    }
}
