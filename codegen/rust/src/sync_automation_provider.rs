// SyncAutomationProvider Concept Implementation (Rust)
//
// Automation providers suite — an automation provider that executes
// sync definitions. Manages a lifecycle of Draft -> Validated -> Active -> Suspended
// for user-authored sync definitions, and dispatches execution of
// matching active syncs by action reference.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Register ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RegisterInput {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RegisterOutput {
    #[serde(rename = "ok")]
    Ok { provider_name: String },
}

// ── Define ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DefineInput {
    pub name: String,
    pub source_text: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DefineOutput {
    #[serde(rename = "ok")]
    Ok { sync_def: String },
    #[serde(rename = "parse_error")]
    ParseError { message: String },
    #[serde(rename = "exists")]
    Exists { name: String },
}

// ── Validate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ValidateInput {
    pub sync_def: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ValidateOutput {
    #[serde(rename = "ok")]
    Ok { sync_def: String },
    #[serde(rename = "scope_denied")]
    ScopeDenied {
        sync_def: String,
        action_ref: String,
        reason: String,
    },
    #[serde(rename = "compile_error")]
    CompileError {
        sync_def: String,
        message: String,
    },
}

// ── Activate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActivateInput {
    pub sync_def: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActivateOutput {
    #[serde(rename = "ok")]
    Ok { sync_def: String },
    #[serde(rename = "not_validated")]
    NotValidated { sync_def: String },
}

// ── Suspend ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SuspendInput {
    pub sync_def: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SuspendOutput {
    #[serde(rename = "ok")]
    Ok { sync_def: String },
}

// ── Execute ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecuteInput {
    pub action_ref: String,
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExecuteOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
    #[serde(rename = "notfound")]
    NotFound { action_ref: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct SyncAutomationProviderHandler {
    counter: AtomicU64,
}

impl SyncAutomationProviderHandler {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    pub async fn register(
        &self,
        _input: RegisterInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RegisterOutput> {
        let provider_name = "sync".to_string();

        storage
            .put(
                "automation_provider",
                &provider_name,
                json!({
                    "provider_name": provider_name,
                    "type": "sync",
                    "status": "active",
                }),
            )
            .await?;

        Ok(RegisterOutput::Ok { provider_name })
    }

    pub async fn define(
        &self,
        input: DefineInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineOutput> {
        // Check for existing definition with the same name
        let existing = storage.get("sync_definition", &input.name).await?;
        if existing.is_some() {
            return Ok(DefineOutput::Exists { name: input.name });
        }

        // Validate source_text is non-empty
        if input.source_text.trim().is_empty() {
            return Ok(DefineOutput::ParseError {
                message: "source_text must not be empty".to_string(),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let sync_def = format!("sync-{}-{}", input.name, id);

        storage
            .put(
                "sync_definition",
                &input.name,
                json!({
                    "syncDef": sync_def,
                    "name": input.name,
                    "sourceText": input.source_text,
                    "author": input.author,
                    "status": "draft",
                }),
            )
            .await?;

        // Also index by sync_def id for lifecycle lookups
        storage
            .put(
                "sync_def_index",
                &sync_def,
                json!({
                    "name": input.name,
                    "syncDef": sync_def,
                }),
            )
            .await?;

        Ok(DefineOutput::Ok { sync_def })
    }

    /// Resolve a sync_def id to the definition name stored in the index.
    async fn resolve_name(
        &self,
        sync_def: &str,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<Option<String>> {
        let index = storage.get("sync_def_index", sync_def).await?;
        Ok(index.and_then(|v| v["name"].as_str().map(|s| s.to_string())))
    }

    pub async fn validate(
        &self,
        input: ValidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidateOutput> {
        let name = self.resolve_name(&input.sync_def, storage).await?;
        let name = match name {
            Some(n) => n,
            None => {
                return Ok(ValidateOutput::CompileError {
                    sync_def: input.sync_def,
                    message: "sync definition not found".to_string(),
                });
            }
        };

        let rec = storage.get("sync_definition", &name).await?;
        let mut rec = match rec {
            Some(r) => r,
            None => {
                return Ok(ValidateOutput::CompileError {
                    sync_def: input.sync_def,
                    message: "sync definition not found".to_string(),
                });
            }
        };

        let status = rec["status"].as_str().unwrap_or("");
        if status != "draft" {
            return Ok(ValidateOutput::CompileError {
                sync_def: input.sync_def,
                message: format!("can only validate from draft status, current: {}", status),
            });
        }

        let source = rec["sourceText"].as_str().unwrap_or("");

        // Minimal compile check: source must contain at least one arrow (->)
        if !source.contains("->") {
            return Ok(ValidateOutput::CompileError {
                sync_def: input.sync_def,
                message: "source must contain at least one sync mapping (->)".to_string(),
            });
        }

        rec["status"] = json!("validated");
        storage.put("sync_definition", &name, rec).await?;

        Ok(ValidateOutput::Ok {
            sync_def: input.sync_def,
        })
    }

    pub async fn activate(
        &self,
        input: ActivateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ActivateOutput> {
        let name = self.resolve_name(&input.sync_def, storage).await?;
        let name = match name {
            Some(n) => n,
            None => {
                return Ok(ActivateOutput::NotValidated {
                    sync_def: input.sync_def,
                });
            }
        };

        let rec = storage.get("sync_definition", &name).await?;
        let mut rec = match rec {
            Some(r) => r,
            None => {
                return Ok(ActivateOutput::NotValidated {
                    sync_def: input.sync_def,
                });
            }
        };

        let status = rec["status"].as_str().unwrap_or("");
        if status != "validated" {
            return Ok(ActivateOutput::NotValidated {
                sync_def: input.sync_def,
            });
        }

        rec["status"] = json!("active");
        storage.put("sync_definition", &name, rec).await?;

        Ok(ActivateOutput::Ok {
            sync_def: input.sync_def,
        })
    }

    pub async fn suspend(
        &self,
        input: SuspendInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SuspendOutput> {
        let name = self.resolve_name(&input.sync_def, storage).await?;
        if let Some(name) = name {
            if let Some(mut rec) = storage.get("sync_definition", &name).await? {
                rec["status"] = json!("suspended");
                storage.put("sync_definition", &name, rec).await?;
            }
        }

        Ok(SuspendOutput::Ok {
            sync_def: input.sync_def,
        })
    }

    pub async fn execute(
        &self,
        input: ExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExecuteOutput> {
        // Find an active sync definition that handles this action_ref
        let all_defs = storage
            .find("sync_definition", Some(&json!({ "status": "active" })))
            .await?;

        if all_defs.is_empty() {
            return Ok(ExecuteOutput::NotFound {
                action_ref: input.action_ref,
            });
        }

        // Find first active definition whose source contains the action_ref
        let matching = all_defs.iter().find(|def| {
            let source = def["sourceText"].as_str().unwrap_or("");
            source.contains(&input.action_ref)
        });

        match matching {
            Some(def) => {
                let sync_def = def["syncDef"].as_str().unwrap_or("unknown");
                let result = json!({
                    "actionRef": input.action_ref,
                    "syncDef": sync_def,
                    "status": "executed",
                    "input": input.input,
                });
                Ok(ExecuteOutput::Ok {
                    result: serde_json::to_string(&result)?,
                })
            }
            None => Ok(ExecuteOutput::NotFound {
                action_ref: input.action_ref,
            }),
        }
    }
}

// ── Tests ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    async fn create_and_validate(
        handler: &SyncAutomationProviderHandler,
        storage: &InMemoryStorage,
        name: &str,
    ) -> String {
        let def_result = handler
            .define(
                DefineInput {
                    name: name.into(),
                    source_text: "article.publish -> notification.send".into(),
                    author: "test-author".into(),
                },
                storage,
            )
            .await
            .unwrap();

        let sync_def = match def_result {
            DefineOutput::Ok { sync_def } => sync_def,
            _ => panic!("expected Ok from define"),
        };

        handler
            .validate(ValidateInput { sync_def: sync_def.clone() }, storage)
            .await
            .unwrap();

        sync_def
    }

    #[tokio::test]
    async fn register_returns_sync_provider_name() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let result = handler.register(RegisterInput {}, &storage).await.unwrap();

        match result {
            RegisterOutput::Ok { provider_name } => {
                assert_eq!(provider_name, "sync");
            }
        }
    }

    #[tokio::test]
    async fn define_creates_draft_sync_definition() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let result = handler
            .define(
                DefineInput {
                    name: "on-publish".into(),
                    source_text: "article.publish -> notification.send".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DefineOutput::Ok { sync_def } => {
                assert!(sync_def.contains("on-publish"));
            }
            _ => panic!("expected Ok variant"),
        }

        // Verify draft status
        let rec = storage
            .get("sync_definition", "on-publish")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(rec["status"].as_str().unwrap(), "draft");
    }

    #[tokio::test]
    async fn define_rejects_duplicate_name() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        handler
            .define(
                DefineInput {
                    name: "dup".into(),
                    source_text: "a -> b".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .define(
                DefineInput {
                    name: "dup".into(),
                    source_text: "c -> d".into(),
                    author: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            DefineOutput::Exists { name } => assert_eq!(name, "dup"),
            _ => panic!("expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn define_rejects_empty_source() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let result = handler
            .define(
                DefineInput {
                    name: "empty".into(),
                    source_text: "  ".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, DefineOutput::ParseError { .. }));
    }

    #[tokio::test]
    async fn validate_transitions_draft_to_validated() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let def_result = handler
            .define(
                DefineInput {
                    name: "my-sync".into(),
                    source_text: "a.create -> b.notify".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let sync_def = match def_result {
            DefineOutput::Ok { sync_def } => sync_def,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .validate(ValidateInput { sync_def: sync_def.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, ValidateOutput::Ok { .. }));

        let rec = storage
            .get("sync_definition", "my-sync")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(rec["status"].as_str().unwrap(), "validated");
    }

    #[tokio::test]
    async fn validate_rejects_source_without_arrow() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let def_result = handler
            .define(
                DefineInput {
                    name: "bad-sync".into(),
                    source_text: "no mapping here".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let sync_def = match def_result {
            DefineOutput::Ok { sync_def } => sync_def,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .validate(ValidateInput { sync_def }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, ValidateOutput::CompileError { .. }));
    }

    #[tokio::test]
    async fn activate_transitions_validated_to_active() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let sync_def = create_and_validate(&handler, &storage, "act-sync").await;

        let result = handler
            .activate(ActivateInput { sync_def: sync_def.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, ActivateOutput::Ok { .. }));

        let rec = storage
            .get("sync_definition", "act-sync")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(rec["status"].as_str().unwrap(), "active");
    }

    #[tokio::test]
    async fn activate_rejects_draft_status() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let def_result = handler
            .define(
                DefineInput {
                    name: "still-draft".into(),
                    source_text: "x -> y".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let sync_def = match def_result {
            DefineOutput::Ok { sync_def } => sync_def,
            _ => panic!("expected Ok"),
        };

        let result = handler
            .activate(ActivateInput { sync_def }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, ActivateOutput::NotValidated { .. }));
    }

    #[tokio::test]
    async fn suspend_transitions_to_suspended() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let sync_def = create_and_validate(&handler, &storage, "susp-sync").await;

        handler
            .activate(ActivateInput { sync_def: sync_def.clone() }, &storage)
            .await
            .unwrap();

        let result = handler
            .suspend(SuspendInput { sync_def: sync_def.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, SuspendOutput::Ok { .. }));

        let rec = storage
            .get("sync_definition", "susp-sync")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(rec["status"].as_str().unwrap(), "suspended");
    }

    #[tokio::test]
    async fn execute_runs_active_sync_matching_action_ref() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let sync_def = create_and_validate(&handler, &storage, "exec-sync").await;

        handler
            .activate(ActivateInput { sync_def: sync_def.clone() }, &storage)
            .await
            .unwrap();

        let result = handler
            .execute(
                ExecuteInput {
                    action_ref: "article.publish".into(),
                    input: r#"{"articleId":"a1"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ExecuteOutput::Ok { result } => {
                let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
                assert_eq!(parsed["status"].as_str().unwrap(), "executed");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn execute_returns_notfound_when_no_active_sync() {
        let storage = InMemoryStorage::new();
        let handler = SyncAutomationProviderHandler::new();

        let result = handler
            .execute(
                ExecuteInput {
                    action_ref: "unknown.action".into(),
                    input: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ExecuteOutput::NotFound { .. }));
    }
}
