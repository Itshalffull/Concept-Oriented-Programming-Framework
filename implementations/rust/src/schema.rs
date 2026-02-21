// Schema Concept Implementation (Rust)
//
// Manages schema definitions, field inheritance, and entity assignment.
// See Architecture doc Sections on schema and field management.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── DefineSchema ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefineSchemaInput {
    pub name: String,
    pub fields: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DefineSchemaOutput {
    #[serde(rename = "ok")]
    Ok { schema_id: String },
}

// ── AddField ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddFieldInput {
    pub schema_id: String,
    pub field_def: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddFieldOutput {
    #[serde(rename = "ok")]
    Ok { schema_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── ExtendSchema ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtendSchemaInput {
    pub child_id: String,
    pub parent_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ExtendSchemaOutput {
    #[serde(rename = "ok")]
    Ok { child_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── ApplyTo ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyToInput {
    pub node_id: String,
    pub schema_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ApplyToOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "schema_notfound")]
    SchemaNotFound { message: String },
}

// ── RemoveFrom ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveFromInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveFromOutput {
    #[serde(rename = "ok")]
    Ok { node_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetEffectiveFields ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetEffectiveFieldsInput {
    pub schema_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetEffectiveFieldsOutput {
    #[serde(rename = "ok")]
    Ok { schema_id: String, fields: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct SchemaHandler;

impl SchemaHandler {
    pub async fn define_schema(
        &self,
        input: DefineSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineSchemaOutput> {
        let schema_id = format!("schema_{}", input.name.to_lowercase().replace(' ', "_"));

        storage
            .put(
                "schema",
                &schema_id,
                json!({
                    "schema_id": schema_id,
                    "name": input.name,
                    "fields": serde_json::from_str::<serde_json::Value>(&input.fields)
                        .unwrap_or(json!([])),
                    "parent_id": null,
                }),
            )
            .await?;

        Ok(DefineSchemaOutput::Ok { schema_id })
    }

    pub async fn add_field(
        &self,
        input: AddFieldInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddFieldOutput> {
        let existing = storage.get("schema", &input.schema_id).await?;

        match existing {
            None => Ok(AddFieldOutput::NotFound {
                message: format!("Schema '{}' not found", input.schema_id),
            }),
            Some(mut schema) => {
                let field_def: serde_json::Value =
                    serde_json::from_str(&input.field_def).unwrap_or(json!({}));

                let fields = schema["fields"].as_array_mut();
                match fields {
                    Some(arr) => arr.push(field_def),
                    None => schema["fields"] = json!([field_def]),
                }

                storage.put("schema", &input.schema_id, schema).await?;

                Ok(AddFieldOutput::Ok {
                    schema_id: input.schema_id,
                })
            }
        }
    }

    pub async fn extend_schema(
        &self,
        input: ExtendSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExtendSchemaOutput> {
        let child = storage.get("schema", &input.child_id).await?;
        let parent = storage.get("schema", &input.parent_id).await?;

        if child.is_none() {
            return Ok(ExtendSchemaOutput::NotFound {
                message: format!("Child schema '{}' not found", input.child_id),
            });
        }
        if parent.is_none() {
            return Ok(ExtendSchemaOutput::NotFound {
                message: format!("Parent schema '{}' not found", input.parent_id),
            });
        }

        let mut child_schema = child.unwrap();
        child_schema["parent_id"] = json!(input.parent_id);
        storage.put("schema", &input.child_id, child_schema).await?;

        Ok(ExtendSchemaOutput::Ok {
            child_id: input.child_id,
        })
    }

    pub async fn apply_to(
        &self,
        input: ApplyToInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ApplyToOutput> {
        let schema = storage.get("schema", &input.schema_id).await?;

        if schema.is_none() {
            return Ok(ApplyToOutput::SchemaNotFound {
                message: format!("Schema '{}' not found", input.schema_id),
            });
        }

        storage
            .put(
                "schema_assignment",
                &input.node_id,
                json!({ "node_id": input.node_id, "schema_id": input.schema_id }),
            )
            .await?;

        Ok(ApplyToOutput::Ok {
            node_id: input.node_id,
        })
    }

    pub async fn remove_from(
        &self,
        input: RemoveFromInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveFromOutput> {
        let existing = storage.get("schema_assignment", &input.node_id).await?;

        if existing.is_none() {
            return Ok(RemoveFromOutput::NotFound {
                message: format!("No schema assignment for node '{}'", input.node_id),
            });
        }

        storage.del("schema_assignment", &input.node_id).await?;

        Ok(RemoveFromOutput::Ok {
            node_id: input.node_id,
        })
    }

    pub async fn get_effective_fields(
        &self,
        input: GetEffectiveFieldsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetEffectiveFieldsOutput> {
        let schema = storage.get("schema", &input.schema_id).await?;

        match schema {
            None => Ok(GetEffectiveFieldsOutput::NotFound {
                message: format!("Schema '{}' not found", input.schema_id),
            }),
            Some(record) => {
                let mut all_fields: Vec<serde_json::Value> = vec![];

                // Collect inherited fields by walking parent chain
                let mut current = Some(record.clone());
                while let Some(s) = current {
                    if let Some(fields) = s["fields"].as_array() {
                        all_fields.extend(fields.iter().cloned());
                    }
                    let parent_id = s["parent_id"].as_str().map(String::from);
                    current = match parent_id {
                        Some(pid) => storage.get("schema", &pid).await?,
                        None => None,
                    };
                }

                Ok(GetEffectiveFieldsOutput::Ok {
                    schema_id: input.schema_id,
                    fields: serde_json::to_string(&all_fields)?,
                })
            }
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── define_schema tests ────────────────────────────────

    #[tokio::test]
    async fn define_schema_returns_deterministic_id() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        let result = handler
            .define_schema(
                DefineSchemaInput {
                    name: "Article".into(),
                    fields: r#"[{"name":"title","type":"string"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DefineSchemaOutput::Ok { schema_id } => {
                assert_eq!(schema_id, "schema_article");
            }
        }
    }

    #[tokio::test]
    async fn define_schema_stores_in_storage() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "User".into(),
                    fields: r#"[{"name":"email","type":"string"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("schema", "schema_user").await.unwrap();
        assert!(record.is_some());
        let record = record.unwrap();
        assert_eq!(record["name"].as_str().unwrap(), "User");
    }

    // ── add_field tests ────────────────────────────────────

    #[tokio::test]
    async fn add_field_appends_field_to_schema() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Post".into(),
                    fields: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .add_field(
                AddFieldInput {
                    schema_id: "schema_post".into(),
                    field_def: r#"{"name":"body","type":"text"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddFieldOutput::Ok { .. }));

        let record = storage.get("schema", "schema_post").await.unwrap().unwrap();
        let fields = record["fields"].as_array().unwrap();
        assert_eq!(fields.len(), 1);
    }

    #[tokio::test]
    async fn add_field_returns_notfound_for_missing_schema() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        let result = handler
            .add_field(
                AddFieldInput {
                    schema_id: "nonexistent".into(),
                    field_def: r#"{"name":"x"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddFieldOutput::NotFound { .. }));
    }

    // ── extend_schema tests ────────────────────────────────

    #[tokio::test]
    async fn extend_schema_sets_parent_id() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Base".into(),
                    fields: r#"[{"name":"id","type":"string"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Child".into(),
                    fields: r#"[{"name":"extra","type":"string"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .extend_schema(
                ExtendSchemaInput {
                    child_id: "schema_child".into(),
                    parent_id: "schema_base".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ExtendSchemaOutput::Ok { .. }));

        let child = storage.get("schema", "schema_child").await.unwrap().unwrap();
        assert_eq!(child["parent_id"].as_str().unwrap(), "schema_base");
    }

    #[tokio::test]
    async fn extend_schema_returns_notfound_when_parent_missing() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Orphan".into(),
                    fields: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .extend_schema(
                ExtendSchemaInput {
                    child_id: "schema_orphan".into(),
                    parent_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ExtendSchemaOutput::NotFound { .. }));
    }

    // ── apply_to tests ─────────────────────────────────────

    #[tokio::test]
    async fn apply_to_assigns_schema_to_node() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Task".into(),
                    fields: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .apply_to(
                ApplyToInput {
                    node_id: "node_1".into(),
                    schema_id: "schema_task".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ApplyToOutput::Ok { .. }));

        let assignment = storage
            .get("schema_assignment", "node_1")
            .await
            .unwrap();
        assert!(assignment.is_some());
    }

    #[tokio::test]
    async fn apply_to_returns_schema_notfound_when_missing() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        let result = handler
            .apply_to(
                ApplyToInput {
                    node_id: "node_1".into(),
                    schema_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ApplyToOutput::SchemaNotFound { .. }));
    }

    // ── remove_from tests ──────────────────────────────────

    #[tokio::test]
    async fn remove_from_deletes_assignment() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Temp".into(),
                    fields: "[]".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .apply_to(
                ApplyToInput {
                    node_id: "node_2".into(),
                    schema_id: "schema_temp".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .remove_from(
                RemoveFromInput {
                    node_id: "node_2".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveFromOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn remove_from_returns_notfound_when_no_assignment() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        let result = handler
            .remove_from(
                RemoveFromInput {
                    node_id: "unassigned".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveFromOutput::NotFound { .. }));
    }

    // ── get_effective_fields tests ─────────────────────────

    #[tokio::test]
    async fn get_effective_fields_includes_inherited_fields() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Parent".into(),
                    fields: r#"[{"name":"id","type":"string"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .define_schema(
                DefineSchemaInput {
                    name: "Derived".into(),
                    fields: r#"[{"name":"extra","type":"number"}]"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .extend_schema(
                ExtendSchemaInput {
                    child_id: "schema_derived".into(),
                    parent_id: "schema_parent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_effective_fields(
                GetEffectiveFieldsInput {
                    schema_id: "schema_derived".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GetEffectiveFieldsOutput::Ok { fields, .. } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&fields).unwrap();
                assert_eq!(parsed.len(), 2);
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn get_effective_fields_returns_notfound_for_missing_schema() {
        let storage = InMemoryStorage::new();
        let handler = SchemaHandler;

        let result = handler
            .get_effective_fields(
                GetEffectiveFieldsInput {
                    schema_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            GetEffectiveFieldsOutput::NotFound { .. }
        ));
    }
}
