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
