// AutomationTarget Concept Implementation (Rust)
//
// Automation providers suite — generates, validates, and lists
// automation manifest entries from a projection configuration.
// Serves as the code-generation target that produces manifests
// consumable by ManifestAutomationProvider.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Generate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GenerateOutput {
    #[serde(rename = "ok")]
    Ok {
        manifest: String,
        entry_count: u32,
        output_path: String,
    },
    #[serde(rename = "projection_error")]
    ProjectionError {
        projection: String,
        message: String,
    },
}

// ── Validate ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ValidateInput {
    pub manifest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ValidateOutput {
    #[serde(rename = "ok")]
    Ok { manifest: String },
    #[serde(rename = "schema_error")]
    SchemaError { entry: String, message: String },
}

// ── ListEntries ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ListEntriesInput {
    pub manifest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ListEntriesOutput {
    #[serde(rename = "ok")]
    Ok { entries: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct AutomationTargetHandler {
    counter: AtomicU64,
}

impl AutomationTargetHandler {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    pub async fn generate(
        &self,
        input: GenerateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GenerateOutput> {
        if input.projection.is_empty() {
            return Ok(GenerateOutput::ProjectionError {
                projection: input.projection,
                message: "projection must not be empty".to_string(),
            });
        }

        // Parse config to determine output path
        let config_val: serde_json::Value = match serde_json::from_str(&input.config) {
            Ok(v) => v,
            Err(_) => {
                return Ok(GenerateOutput::ProjectionError {
                    projection: input.projection,
                    message: "config must be valid JSON".to_string(),
                });
            }
        };

        let output_path = config_val["outputPath"]
            .as_str()
            .unwrap_or("generated/automation")
            .to_string();

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let manifest_id = format!("manifest-{}", id);

        // Generate entries from the projection
        let entries = vec![
            json!({
                "actionRef": format!("{}.build", input.projection),
                "type": "command",
                "projection": input.projection,
                "schema": { "input": "object", "output": "object" },
            }),
            json!({
                "actionRef": format!("{}.test", input.projection),
                "type": "command",
                "projection": input.projection,
                "schema": { "input": "object", "output": "object" },
            }),
            json!({
                "actionRef": format!("{}.deploy", input.projection),
                "type": "command",
                "projection": input.projection,
                "schema": { "input": "object", "output": "object" },
            }),
        ];

        // Store each entry
        for entry in &entries {
            let action_ref = entry["actionRef"].as_str().unwrap();
            let entry_key = format!("{}:{}", manifest_id, action_ref);
            let mut stored = entry.clone();
            stored["manifest"] = json!(manifest_id);
            storage
                .put("automation_target_entry", &entry_key, stored)
                .await?;
        }

        // Store the manifest record
        storage
            .put(
                "automation_target_manifest",
                &manifest_id,
                json!({
                    "manifest": manifest_id,
                    "projection": input.projection,
                    "entryCount": entries.len(),
                    "outputPath": output_path,
                    "validated": false,
                }),
            )
            .await?;

        Ok(GenerateOutput::Ok {
            manifest: manifest_id,
            entry_count: entries.len() as u32,
            output_path,
        })
    }

    pub async fn validate(
        &self,
        input: ValidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidateOutput> {
        let manifest_rec = storage
            .get("automation_target_manifest", &input.manifest)
            .await?;

        let mut manifest_rec = match manifest_rec {
            Some(r) => r,
            None => {
                return Ok(ValidateOutput::SchemaError {
                    entry: input.manifest.clone(),
                    message: format!("manifest '{}' not found", input.manifest),
                });
            }
        };

        // Validate all entries belonging to this manifest
        let entries = storage
            .find(
                "automation_target_entry",
                Some(&json!({ "manifest": input.manifest })),
            )
            .await?;

        for entry in &entries {
            let action_ref = entry["actionRef"].as_str().unwrap_or("unknown");

            // Validate each entry has required fields
            if entry.get("type").is_none() {
                return Ok(ValidateOutput::SchemaError {
                    entry: action_ref.to_string(),
                    message: "entry missing required 'type' field".to_string(),
                });
            }

            if entry.get("schema").is_none() {
                return Ok(ValidateOutput::SchemaError {
                    entry: action_ref.to_string(),
                    message: "entry missing required 'schema' field".to_string(),
                });
            }
        }

        manifest_rec["validated"] = json!(true);
        storage
            .put("automation_target_manifest", &input.manifest, manifest_rec)
            .await?;

        Ok(ValidateOutput::Ok {
            manifest: input.manifest,
        })
    }

    pub async fn list_entries(
        &self,
        input: ListEntriesInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ListEntriesOutput> {
        let entries = storage
            .find(
                "automation_target_entry",
                Some(&json!({ "manifest": input.manifest })),
            )
            .await?;

        let entries_json = serde_json::to_string(&entries)?;
        Ok(ListEntriesOutput::Ok {
            entries: entries_json,
        })
    }
}

// ── Tests ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn generate_creates_manifest_with_entries() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let result = handler
            .generate(
                GenerateInput {
                    projection: "ci-pipeline".into(),
                    config: r#"{"outputPath":"dist/automation"}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GenerateOutput::Ok {
                manifest,
                entry_count,
                output_path,
            } => {
                assert!(manifest.starts_with("manifest-"));
                assert_eq!(entry_count, 3);
                assert_eq!(output_path, "dist/automation");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn generate_uses_default_output_path() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let result = handler
            .generate(
                GenerateInput {
                    projection: "pipeline".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GenerateOutput::Ok { output_path, .. } => {
                assert_eq!(output_path, "generated/automation");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn generate_rejects_empty_projection() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let result = handler
            .generate(
                GenerateInput {
                    projection: "".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GenerateOutput::ProjectionError { message, .. } => {
                assert!(message.contains("must not be empty"));
            }
            _ => panic!("expected ProjectionError variant"),
        }
    }

    #[tokio::test]
    async fn generate_rejects_invalid_config_json() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let result = handler
            .generate(
                GenerateInput {
                    projection: "pipeline".into(),
                    config: "not-json".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            GenerateOutput::ProjectionError { message, .. } => {
                assert!(message.contains("valid JSON"));
            }
            _ => panic!("expected ProjectionError variant"),
        }
    }

    #[tokio::test]
    async fn validate_marks_manifest_as_validated() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let gen_result = handler
            .generate(
                GenerateInput {
                    projection: "build".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let manifest = match gen_result {
            GenerateOutput::Ok { manifest, .. } => manifest,
            _ => panic!("expected Ok from generate"),
        };

        let result = handler
            .validate(ValidateInput { manifest: manifest.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, ValidateOutput::Ok { .. }));

        // Verify manifest is marked validated
        let rec = storage
            .get("automation_target_manifest", &manifest)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(rec["validated"], json!(true));
    }

    #[tokio::test]
    async fn validate_returns_error_for_unknown_manifest() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let result = handler
            .validate(
                ValidateInput {
                    manifest: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ValidateOutput::SchemaError { .. }));
    }

    #[tokio::test]
    async fn list_entries_returns_generated_entries() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let gen_result = handler
            .generate(
                GenerateInput {
                    projection: "deploy".into(),
                    config: "{}".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let manifest = match gen_result {
            GenerateOutput::Ok { manifest, .. } => manifest,
            _ => panic!("expected Ok from generate"),
        };

        let result = handler
            .list_entries(ListEntriesInput { manifest }, &storage)
            .await
            .unwrap();

        match result {
            ListEntriesOutput::Ok { entries } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&entries).unwrap();
                assert_eq!(parsed.len(), 3);

                // Check that entries contain expected action refs
                let refs: Vec<&str> = parsed
                    .iter()
                    .map(|e| e["actionRef"].as_str().unwrap())
                    .collect();
                assert!(refs.contains(&"deploy.build"));
                assert!(refs.contains(&"deploy.test"));
                assert!(refs.contains(&"deploy.deploy"));
            }
        }
    }

    #[tokio::test]
    async fn list_entries_returns_empty_for_unknown_manifest() {
        let storage = InMemoryStorage::new();
        let handler = AutomationTargetHandler::new();

        let result = handler
            .list_entries(
                ListEntriesInput {
                    manifest: "unknown".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ListEntriesOutput::Ok { entries } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&entries).unwrap();
                assert_eq!(parsed.len(), 0);
            }
        }
    }
}
