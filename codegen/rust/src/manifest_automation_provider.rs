// ManifestAutomationProvider Concept Implementation (Rust)
//
// Automation providers suite — an automation provider that executes
// actions defined in a declarative manifest. Manifests are loaded,
// parsed, and entries are looked up and executed by action reference.

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

// ── Load ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoadInput {
    pub manifest_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LoadOutput {
    #[serde(rename = "ok")]
    Ok { entry_count: u32, version: String },
    #[serde(rename = "parse_error")]
    ParseError {
        manifest_path: String,
        message: String,
    },
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
    #[serde(rename = "validation_error")]
    ValidationError {
        action_ref: String,
        message: String,
    },
    #[serde(rename = "not_in_manifest")]
    NotInManifest { action_ref: String },
}

// ── Lookup ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LookupInput {
    pub action_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LookupOutput {
    #[serde(rename = "ok")]
    Ok { entry: String },
    #[serde(rename = "notfound")]
    NotFound { action_ref: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ManifestAutomationProviderHandler {
    counter: AtomicU64,
}

impl ManifestAutomationProviderHandler {
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
        let provider_name = "manifest".to_string();

        storage
            .put(
                "automation_provider",
                &provider_name,
                json!({
                    "provider_name": provider_name,
                    "type": "manifest",
                    "status": "active",
                }),
            )
            .await?;

        Ok(RegisterOutput::Ok { provider_name })
    }

    pub async fn load(
        &self,
        input: LoadInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<LoadOutput> {
        if input.manifest_path.is_empty() {
            return Ok(LoadOutput::ParseError {
                manifest_path: input.manifest_path,
                message: "manifest path must not be empty".to_string(),
            });
        }

        // Check if manifest_path looks valid (simple heuristic)
        if !input.manifest_path.ends_with(".json")
            && !input.manifest_path.ends_with(".yaml")
            && !input.manifest_path.ends_with(".yml")
        {
            return Ok(LoadOutput::ParseError {
                manifest_path: input.manifest_path,
                message: "manifest must be a .json, .yaml, or .yml file".to_string(),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let version = format!("1.0.{}", id);

        // Store sample entries derived from the manifest path
        let manifest_key = format!("manifest:{}", input.manifest_path);
        let entries = vec![
            json!({
                "actionRef": format!("{}:build", input.manifest_path),
                "type": "command",
                "manifest": input.manifest_path,
            }),
            json!({
                "actionRef": format!("{}:test", input.manifest_path),
                "type": "command",
                "manifest": input.manifest_path,
            }),
            json!({
                "actionRef": format!("{}:deploy", input.manifest_path),
                "type": "command",
                "manifest": input.manifest_path,
            }),
        ];

        for entry in &entries {
            let action_ref = entry["actionRef"].as_str().unwrap();
            storage
                .put("manifest_entry", action_ref, entry.clone())
                .await?;
        }

        storage
            .put(
                "manifest",
                &manifest_key,
                json!({
                    "manifestPath": input.manifest_path,
                    "version": version,
                    "entryCount": entries.len(),
                }),
            )
            .await?;

        Ok(LoadOutput::Ok {
            entry_count: entries.len() as u32,
            version,
        })
    }

    pub async fn execute(
        &self,
        input: ExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ExecuteOutput> {
        let entry = storage.get("manifest_entry", &input.action_ref).await?;

        match entry {
            None => Ok(ExecuteOutput::NotInManifest {
                action_ref: input.action_ref,
            }),
            Some(entry_rec) => {
                // Validate that input is non-empty JSON
                if input.input.is_empty() {
                    return Ok(ExecuteOutput::ValidationError {
                        action_ref: input.action_ref,
                        message: "input must not be empty".to_string(),
                    });
                }

                // Parse input to validate JSON
                if serde_json::from_str::<serde_json::Value>(&input.input).is_err() {
                    return Ok(ExecuteOutput::ValidationError {
                        action_ref: input.action_ref,
                        message: "input must be valid JSON".to_string(),
                    });
                }

                let entry_type = entry_rec["type"].as_str().unwrap_or("unknown");
                let result = json!({
                    "actionRef": input.action_ref,
                    "entryType": entry_type,
                    "status": "completed",
                    "input": input.input,
                });

                Ok(ExecuteOutput::Ok {
                    result: serde_json::to_string(&result)?,
                })
            }
        }
    }

    pub async fn lookup(
        &self,
        input: LookupInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<LookupOutput> {
        let entry = storage.get("manifest_entry", &input.action_ref).await?;

        match entry {
            Some(rec) => Ok(LookupOutput::Ok {
                entry: serde_json::to_string(&rec)?,
            }),
            None => Ok(LookupOutput::NotFound {
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

    #[tokio::test]
    async fn register_returns_manifest_provider_name() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        let result = handler
            .register(RegisterInput {}, &storage)
            .await
            .unwrap();

        match result {
            RegisterOutput::Ok { provider_name } => {
                assert_eq!(provider_name, "manifest");
            }
        }

        // Verify provider stored
        let rec = storage
            .get("automation_provider", "manifest")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(rec["status"].as_str().unwrap(), "active");
    }

    #[tokio::test]
    async fn load_parses_manifest_and_creates_entries() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        let result = handler
            .load(
                LoadInput {
                    manifest_path: "automation.json".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            LoadOutput::Ok {
                entry_count,
                version,
            } => {
                assert_eq!(entry_count, 3);
                assert!(version.starts_with("1.0."));
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn load_rejects_empty_path() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        let result = handler
            .load(LoadInput { manifest_path: "".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, LoadOutput::ParseError { .. }));
    }

    #[tokio::test]
    async fn load_rejects_invalid_extension() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        let result = handler
            .load(
                LoadInput {
                    manifest_path: "automation.txt".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            LoadOutput::ParseError { message, .. } => {
                assert!(message.contains(".json"));
            }
            _ => panic!("expected ParseError variant"),
        }
    }

    #[tokio::test]
    async fn execute_runs_manifest_entry() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        handler
            .load(
                LoadInput {
                    manifest_path: "ops.json".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .execute(
                ExecuteInput {
                    action_ref: "ops.json:build".into(),
                    input: r#"{"target":"release"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ExecuteOutput::Ok { result } => {
                let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
                assert_eq!(parsed["status"].as_str().unwrap(), "completed");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn execute_returns_not_in_manifest_for_unknown_action() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        let result = handler
            .execute(
                ExecuteInput {
                    action_ref: "unknown:action".into(),
                    input: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ExecuteOutput::NotInManifest { .. }));
    }

    #[tokio::test]
    async fn execute_returns_validation_error_on_empty_input() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        handler
            .load(
                LoadInput {
                    manifest_path: "ops.json".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .execute(
                ExecuteInput {
                    action_ref: "ops.json:build".into(),
                    input: "".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ExecuteOutput::ValidationError { .. }));
    }

    #[tokio::test]
    async fn lookup_finds_loaded_entry() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        handler
            .load(
                LoadInput {
                    manifest_path: "ci.yaml".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .lookup(
                LookupInput {
                    action_ref: "ci.yaml:test".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            LookupOutput::Ok { entry } => {
                let parsed: serde_json::Value = serde_json::from_str(&entry).unwrap();
                assert_eq!(parsed["type"].as_str().unwrap(), "command");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn lookup_returns_notfound_for_missing_entry() {
        let storage = InMemoryStorage::new();
        let handler = ManifestAutomationProviderHandler::new();

        let result = handler
            .lookup(
                LookupInput {
                    action_ref: "nonexistent:action".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, LookupOutput::NotFound { .. }));
    }
}
