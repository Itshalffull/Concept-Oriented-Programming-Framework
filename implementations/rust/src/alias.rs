// Alias Concept Implementation (Rust)
//
// Named aliases for entities — add, remove, and resolve aliases
// to their underlying entity identifiers.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- AddAlias ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddAliasInput {
    pub entity_id: String,
    pub alias_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddAliasOutput {
    #[serde(rename = "ok")]
    Ok {
        entity_id: String,
        alias_name: String,
    },
    #[serde(rename = "already_exists")]
    AlreadyExists { alias_name: String },
}

// --- RemoveAlias ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveAliasInput {
    pub entity_id: String,
    pub alias_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RemoveAliasOutput {
    #[serde(rename = "ok")]
    Ok {
        entity_id: String,
        alias_name: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Resolve ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ResolveOutput {
    #[serde(rename = "ok")]
    Ok { entity_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

pub struct AliasHandler;

impl AliasHandler {
    pub async fn add_alias(
        &self,
        input: AddAliasInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddAliasOutput> {
        // Check if alias name is already taken
        let existing = storage.get("alias", &input.alias_name).await?;
        if existing.is_some() {
            return Ok(AddAliasOutput::AlreadyExists {
                alias_name: input.alias_name,
            });
        }

        storage
            .put(
                "alias",
                &input.alias_name,
                json!({
                    "entity_id": input.entity_id,
                    "alias_name": input.alias_name,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;

        Ok(AddAliasOutput::Ok {
            entity_id: input.entity_id,
            alias_name: input.alias_name,
        })
    }

    pub async fn remove_alias(
        &self,
        input: RemoveAliasInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RemoveAliasOutput> {
        let existing = storage.get("alias", &input.alias_name).await?;
        match existing {
            None => Ok(RemoveAliasOutput::NotFound {
                message: format!("alias '{}' not found", input.alias_name),
            }),
            Some(record) => {
                // Verify the alias belongs to the given entity
                let stored_entity = record
                    .get("entity_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if stored_entity != input.entity_id {
                    return Ok(RemoveAliasOutput::NotFound {
                        message: format!(
                            "alias '{}' does not belong to entity '{}'",
                            input.alias_name, input.entity_id
                        ),
                    });
                }

                storage.del("alias", &input.alias_name).await?;
                Ok(RemoveAliasOutput::Ok {
                    entity_id: input.entity_id,
                    alias_name: input.alias_name,
                })
            }
        }
    }

    pub async fn resolve(
        &self,
        input: ResolveInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ResolveOutput> {
        let existing = storage.get("alias", &input.name).await?;
        match existing {
            None => Ok(ResolveOutput::NotFound {
                message: format!("alias '{}' not found", input.name),
            }),
            Some(record) => {
                let entity_id = record
                    .get("entity_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(ResolveOutput::Ok { entity_id })
            }
        }
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- add_alias ---

    #[tokio::test]
    async fn add_alias_creates_new_alias() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandler;

        let result = handler
            .add_alias(
                AddAliasInput {
                    entity_id: "ent1".into(),
                    alias_name: "my-alias".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            AddAliasOutput::Ok {
                entity_id,
                alias_name,
            } if entity_id == "ent1" && alias_name == "my-alias"
        ));
    }

    #[tokio::test]
    async fn add_alias_duplicate_returns_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandler;

        handler
            .add_alias(
                AddAliasInput {
                    entity_id: "ent1".into(),
                    alias_name: "taken".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .add_alias(
                AddAliasInput {
                    entity_id: "ent2".into(),
                    alias_name: "taken".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, AddAliasOutput::AlreadyExists { alias_name } if alias_name == "taken"));
    }

    // --- remove_alias ---

    #[tokio::test]
    async fn remove_alias_removes_existing() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandler;

        handler
            .add_alias(
                AddAliasInput {
                    entity_id: "ent1".into(),
                    alias_name: "removable".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .remove_alias(
                RemoveAliasInput {
                    entity_id: "ent1".into(),
                    alias_name: "removable".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveAliasOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn remove_alias_not_found() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandler;

        let result = handler
            .remove_alias(
                RemoveAliasInput {
                    entity_id: "ent1".into(),
                    alias_name: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveAliasOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn remove_alias_wrong_entity_returns_not_found() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandler;

        handler
            .add_alias(
                AddAliasInput {
                    entity_id: "ent1".into(),
                    alias_name: "owned".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .remove_alias(
                RemoveAliasInput {
                    entity_id: "ent_other".into(),
                    alias_name: "owned".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RemoveAliasOutput::NotFound { .. }));
    }

    // --- resolve ---

    #[tokio::test]
    async fn resolve_finds_existing_alias() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandler;

        handler
            .add_alias(
                AddAliasInput {
                    entity_id: "ent1".into(),
                    alias_name: "lookup".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .resolve(
                ResolveInput {
                    name: "lookup".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ResolveOutput::Ok { entity_id } if entity_id == "ent1"));
    }

    #[tokio::test]
    async fn resolve_not_found_for_missing_alias() {
        let storage = InMemoryStorage::new();
        let handler = AliasHandler;

        let result = handler
            .resolve(
                ResolveInput {
                    name: "missing".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ResolveOutput::NotFound { .. }));
    }
}
