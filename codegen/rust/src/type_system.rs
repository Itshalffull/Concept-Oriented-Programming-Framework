// TypeSystem Concept Implementation (Rust)
//
// Type registration, resolution, and validation for the concept framework.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- RegisterType ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterTypeInput {
    pub type_id: String,
    pub definition: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RegisterTypeOutput {
    #[serde(rename = "ok")]
    Ok { type_id: String },
    #[serde(rename = "already_exists")]
    AlreadyExists { type_id: String },
}

// --- Resolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveInput {
    pub type_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ResolveOutput {
    #[serde(rename = "ok")]
    Ok {
        type_id: String,
        definition: serde_json::Value,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Validate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateInput {
    pub value: serde_json::Value,
    pub type_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ValidateOutput {
    #[serde(rename = "ok")]
    Ok { valid: bool },
    #[serde(rename = "invalid")]
    Invalid { type_id: String, errors: String },
}

pub struct TypeSystemHandler;

impl TypeSystemHandler {
    pub async fn register_type(
        &self,
        input: RegisterTypeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RegisterTypeOutput> {
        let existing = storage.get("type_def", &input.type_id).await?;
        if existing.is_some() {
            return Ok(RegisterTypeOutput::AlreadyExists {
                type_id: input.type_id,
            });
        }

        storage
            .put(
                "type_def",
                &input.type_id,
                json!({
                    "type_id": input.type_id,
                    "definition": input.definition,
                    "registered_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(RegisterTypeOutput::Ok {
            type_id: input.type_id,
        })
    }

    pub async fn resolve(
        &self,
        input: ResolveInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ResolveOutput> {
        let existing = storage.get("type_def", &input.type_path).await?;
        match existing {
            None => Ok(ResolveOutput::NotFound {
                message: format!("type '{}' not found", input.type_path),
            }),
            Some(record) => {
                let type_id = record
                    .get("type_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let definition = record
                    .get("definition")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                Ok(ResolveOutput::Ok {
                    type_id,
                    definition,
                })
            }
        }
    }

    pub async fn validate(
        &self,
        input: ValidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidateOutput> {
        let existing = storage.get("type_def", &input.type_id).await?;
        match existing {
            None => Ok(ValidateOutput::Invalid {
                type_id: input.type_id,
                errors: "type not found".to_string(),
            }),
            Some(record) => {
                let definition = record
                    .get("definition")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);

                // Basic validation: check if the value's JSON type matches the expected type
                let mut errors: Vec<String> = Vec::new();

                if let Some(expected_type) = definition.get("type").and_then(|v| v.as_str()) {
                    let actual_type = match &input.value {
                        serde_json::Value::String(_) => "string",
                        serde_json::Value::Number(_) => "number",
                        serde_json::Value::Bool(_) => "boolean",
                        serde_json::Value::Array(_) => "array",
                        serde_json::Value::Object(_) => "object",
                        serde_json::Value::Null => "null",
                    };
                    if expected_type != actual_type {
                        errors.push(format!(
                            "expected type '{}', got '{}'",
                            expected_type, actual_type
                        ));
                    }
                }

                if errors.is_empty() {
                    Ok(ValidateOutput::Ok { valid: true })
                } else {
                    Ok(ValidateOutput::Invalid {
                        type_id: input.type_id,
                        errors: serde_json::to_string(&errors)?,
                    })
                }
            }
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // ── register_type tests ────────────────────────────────

    #[tokio::test]
    async fn register_type_returns_ok() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        let result = handler
            .register_type(
                RegisterTypeInput {
                    type_id: "string".into(),
                    definition: serde_json::json!({"type": "string"}),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RegisterTypeOutput::Ok { ref type_id } if type_id == "string"));
    }

    #[tokio::test]
    async fn register_type_returns_already_exists_on_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        handler
            .register_type(
                RegisterTypeInput {
                    type_id: "number".into(),
                    definition: serde_json::json!({"type": "number"}),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .register_type(
                RegisterTypeInput {
                    type_id: "number".into(),
                    definition: serde_json::json!({"type": "number"}),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            RegisterTypeOutput::AlreadyExists { ref type_id } if type_id == "number"
        ));
    }

    #[tokio::test]
    async fn register_type_stores_definition() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        handler
            .register_type(
                RegisterTypeInput {
                    type_id: "email".into(),
                    definition: serde_json::json!({"type": "string", "format": "email"}),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("type_def", "email").await.unwrap();
        assert!(record.is_some());
    }

    // ── resolve tests ──────────────────────────────────────

    #[tokio::test]
    async fn resolve_returns_type_definition() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        handler
            .register_type(
                RegisterTypeInput {
                    type_id: "boolean".into(),
                    definition: serde_json::json!({"type": "boolean"}),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .resolve(
                ResolveInput {
                    type_path: "boolean".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ResolveOutput::Ok { type_id, definition } => {
                assert_eq!(type_id, "boolean");
                assert_eq!(definition["type"].as_str().unwrap(), "boolean");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn resolve_returns_notfound_for_missing_type() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        let result = handler
            .resolve(
                ResolveInput {
                    type_path: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ResolveOutput::NotFound { .. }));
    }

    // ── validate tests ─────────────────────────────────────

    #[tokio::test]
    async fn validate_returns_valid_for_matching_type() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        handler
            .register_type(
                RegisterTypeInput {
                    type_id: "str_type".into(),
                    definition: serde_json::json!({"type": "string"}),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .validate(
                ValidateInput {
                    value: serde_json::json!("hello"),
                    type_id: "str_type".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ValidateOutput::Ok { valid: true }));
    }

    #[tokio::test]
    async fn validate_returns_invalid_for_type_mismatch() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        handler
            .register_type(
                RegisterTypeInput {
                    type_id: "num_type".into(),
                    definition: serde_json::json!({"type": "number"}),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .validate(
                ValidateInput {
                    value: serde_json::json!("not a number"),
                    type_id: "num_type".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ValidateOutput::Invalid { .. }));
    }

    #[tokio::test]
    async fn validate_returns_invalid_for_unregistered_type() {
        let storage = InMemoryStorage::new();
        let handler = TypeSystemHandler;

        let result = handler
            .validate(
                ValidateInput {
                    value: serde_json::json!("test"),
                    type_id: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ValidateOutput::Invalid { .. }));
    }
}
