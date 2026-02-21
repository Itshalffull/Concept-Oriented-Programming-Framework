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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── set tests ──────────────────────────────────────────

    #[tokio::test]
    async fn set_returns_ok_with_node_id_and_key() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        let result = handler
            .set(
                SetInput {
                    node_id: "n1".into(),
                    key: "color".into(),
                    value: serde_json::json!("blue"),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            SetOutput::Ok { node_id, key } => {
                assert_eq!(node_id, "n1");
                assert_eq!(key, "color");
            }
        }
    }

    #[tokio::test]
    async fn set_stores_value_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        handler
            .set(
                SetInput {
                    node_id: "n1".into(),
                    key: "size".into(),
                    value: serde_json::json!(42),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("property", "n1:size").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["value"], serde_json::json!(42));
    }

    // ── get tests ──────────────────────────────────────────

    #[tokio::test]
    async fn get_returns_value_after_set() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        handler
            .set(
                SetInput {
                    node_id: "n1".into(),
                    key: "title".into(),
                    value: serde_json::json!("Hello"),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get(
                GetInput {
                    node_id: "n1".into(),
                    key: "title".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetOutput::Ok { node_id, key, value } => {
                assert_eq!(node_id, "n1");
                assert_eq!(key, "title");
                assert_eq!(value, serde_json::json!("Hello"));
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn get_returns_notfound_when_missing() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        let result = handler
            .get(
                GetInput {
                    node_id: "n1".into(),
                    key: "missing".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, GetOutput::NotFound { .. }));
    }

    // ── delete tests ───────────────────────────────────────

    #[tokio::test]
    async fn delete_removes_existing_property() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        handler
            .set(
                SetInput {
                    node_id: "n1".into(),
                    key: "temp".into(),
                    value: serde_json::json!("val"),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .delete(
                DeleteInput {
                    node_id: "n1".into(),
                    key: "temp".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::Ok { .. }));

        let get_result = handler
            .get(
                GetInput {
                    node_id: "n1".into(),
                    key: "temp".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(get_result, GetOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn delete_returns_notfound_when_missing() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        let result = handler
            .delete(
                DeleteInput {
                    node_id: "n1".into(),
                    key: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::NotFound { .. }));
    }

    // ── define_type tests ──────────────────────────────────

    #[tokio::test]
    async fn define_type_stores_type_definition() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        let result = handler
            .define_type(
                DefineTypeInput {
                    key: "email".into(),
                    prop_type: "string".into(),
                    constraints: serde_json::json!({"format": "email"}),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DefineTypeOutput::Ok { key } => assert_eq!(key, "email"),
        }

        let record = storage.get("property_type", "email").await.unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn define_type_returns_ok_for_different_types() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        let r1 = handler
            .define_type(
                DefineTypeInput {
                    key: "age".into(),
                    prop_type: "number".into(),
                    constraints: serde_json::json!({"min": 0}),
                },
                &storage,
            )
            .await
            .unwrap();

        let r2 = handler
            .define_type(
                DefineTypeInput {
                    key: "active".into(),
                    prop_type: "boolean".into(),
                    constraints: serde_json::json!({}),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(r1, DefineTypeOutput::Ok { ref key } if key == "age"));
        assert!(matches!(r2, DefineTypeOutput::Ok { ref key } if key == "active"));
    }

    // ── list_all tests ─────────────────────────────────────

    #[tokio::test]
    async fn list_all_returns_all_properties_for_node() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        handler
            .set(
                SetInput {
                    node_id: "n1".into(),
                    key: "a".into(),
                    value: serde_json::json!(1),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .set(
                SetInput {
                    node_id: "n1".into(),
                    key: "b".into(),
                    value: serde_json::json!(2),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .list_all(
                ListAllInput {
                    node_id: "n1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ListAllOutput::Ok { node_id, properties } => {
                assert_eq!(node_id, "n1");
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&properties).unwrap();
                assert_eq!(parsed.len(), 2);
            }
        }
    }

    #[tokio::test]
    async fn list_all_returns_empty_for_unknown_node() {
        let storage = InMemoryStorage::new();
        let handler = PropertyHandler;

        let result = handler
            .list_all(
                ListAllInput {
                    node_id: "unknown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ListAllOutput::Ok { properties, .. } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&properties).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }
}
