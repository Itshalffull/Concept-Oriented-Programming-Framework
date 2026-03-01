// VariantEntity handler implementation
// Action return variant as a first-class branching point in sync chains.
// Enables dead-variant detection and sync coverage analysis.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::VariantEntityHandler;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("variant-entity-{}", id)
}

pub struct VariantEntityHandlerImpl;

#[async_trait]
impl VariantEntityHandler for VariantEntityHandlerImpl {
    async fn register(
        &self,
        input: VariantEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityRegisterOutput, Box<dyn std::error::Error>> {
        let action = &input.action;
        let tag = &input.tag;
        let fields = &input.fields;

        let id = next_id();
        let symbol = format!("clef/variant/{}/{}", action, tag);

        storage.put("variant-entity", &id, json!({
            "id": id,
            "action": action,
            "tag": tag,
            "symbol": symbol,
            "fields": fields,
            "description": "",
        })).await?;

        Ok(VariantEntityRegisterOutput::Ok { variant: id })
    }

    async fn matching_syncs(
        &self,
        input: VariantEntityMatchingSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityMatchingSyncsOutput, Box<dyn std::error::Error>> {
        let variant_id = &input.variant;

        let record = storage.get("variant-entity", variant_id).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(VariantEntityMatchingSyncsOutput::Ok { syncs: "[]".to_string() }),
        };

        let tag = record.get("tag").and_then(|v| v.as_str()).unwrap_or("");
        let action_ref = record.get("action").and_then(|v| v.as_str()).unwrap_or("");

        // Search all syncs for when-patterns that match this variant's tag
        let all_syncs = storage.find("sync-entity", None).await?;
        let matching: Vec<&Value> = all_syncs.iter().filter(|s| {
            let when_str = s.get("whenPatterns").and_then(|v| v.as_str()).unwrap_or("[]");
            if let Ok(when) = serde_json::from_str::<Vec<Value>>(when_str) {
                when.iter().any(|w| {
                    let action_name = w.get("action").and_then(|v| v.as_str()).unwrap_or("");
                    if !action_ref.is_empty() && !action_ref.contains(action_name) {
                        return false;
                    }
                    let output_fields = w.get("outputFields").and_then(|v| v.as_array());
                    match output_fields {
                        None => true,
                        Some(fields) => fields.iter().any(|f| {
                            let match_obj = f.get("match");
                            match match_obj {
                                Some(m) => {
                                    let match_type = m.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                    match_type == "wildcard" ||
                                    (match_type == "literal" && m.get("value").and_then(|v| v.as_str()) == Some(tag))
                                }
                                None => false,
                            }
                        }),
                    }
                })
            } else {
                false
            }
        }).collect();

        Ok(VariantEntityMatchingSyncsOutput::Ok {
            syncs: serde_json::to_string(&matching)?,
        })
    }

    async fn is_dead(
        &self,
        input: VariantEntityIsDeadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityIsDeadOutput, Box<dyn std::error::Error>> {
        let variant_id = &input.variant;

        let record = storage.get("variant-entity", variant_id).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(VariantEntityIsDeadOutput::Dead {
                no_matching_syncs: "true".to_string(),
                no_runtime_occurrences: "true".to_string(),
            }),
        };

        let tag = record.get("tag").and_then(|v| v.as_str()).unwrap_or("");
        let symbol = record.get("symbol").and_then(|v| v.as_str()).unwrap_or("");

        // Count matching syncs
        let all_syncs = storage.find("sync-entity", None).await?;
        let mut sync_count: i64 = 0;
        for s in &all_syncs {
            let when_str = s.get("whenPatterns").and_then(|v| v.as_str()).unwrap_or("[]");
            if let Ok(when) = serde_json::from_str::<Vec<Value>>(when_str) {
                let matches = when.iter().any(|w| {
                    let output_fields = w.get("outputFields").and_then(|v| v.as_array());
                    match output_fields {
                        None => false,
                        Some(fields) => fields.iter().any(|f| {
                            let m = f.get("match");
                            match m {
                                Some(m) => {
                                    let mt = m.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                    mt == "wildcard" || (mt == "literal" && m.get("value").and_then(|v| v.as_str()) == Some(tag))
                                }
                                None => false,
                            }
                        }),
                    }
                });
                if matches { sync_count += 1; }
            }
        }

        // Check for runtime occurrences
        let runtime_entries = storage.find("runtime-coverage", Some(&json!({"symbol": symbol}))).await?;
        let runtime_count = runtime_entries.len() as i64;

        if sync_count == 0 || runtime_count == 0 {
            return Ok(VariantEntityIsDeadOutput::Dead {
                no_matching_syncs: if sync_count == 0 { "true" } else { "false" }.to_string(),
                no_runtime_occurrences: if runtime_count == 0 { "true" } else { "false" }.to_string(),
            });
        }

        Ok(VariantEntityIsDeadOutput::Alive { sync_count, runtime_count })
    }

    async fn get(
        &self,
        input: VariantEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityGetOutput, Box<dyn std::error::Error>> {
        let variant_id = &input.variant;

        let record = storage.get("variant-entity", variant_id).await?;
        match record {
            Some(r) => Ok(VariantEntityGetOutput::Ok {
                variant: r.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                action: r.get("action").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                tag: r.get("tag").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                fields: r.get("fields").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }),
            None => Ok(VariantEntityGetOutput::Notfound),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = VariantEntityHandlerImpl;
        let result = handler.register(
            VariantEntityRegisterInput {
                action: "createUser".to_string(),
                tag: "Ok".to_string(),
                fields: r#"["user"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VariantEntityRegisterOutput::Ok { variant } => {
                assert!(!variant.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_matching_syncs_no_variant() {
        let storage = InMemoryStorage::new();
        let handler = VariantEntityHandlerImpl;
        let result = handler.matching_syncs(
            VariantEntityMatchingSyncsInput {
                variant: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VariantEntityMatchingSyncsOutput::Ok { syncs } => {
                assert_eq!(syncs, "[]");
            },
        }
    }

    #[tokio::test]
    async fn test_is_dead_nonexistent() {
        let storage = InMemoryStorage::new();
        let handler = VariantEntityHandlerImpl;
        let result = handler.is_dead(
            VariantEntityIsDeadInput {
                variant: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VariantEntityIsDeadOutput::Dead { no_matching_syncs, no_runtime_occurrences } => {
                assert_eq!(no_matching_syncs, "true");
                assert_eq!(no_runtime_occurrences, "true");
            },
            _ => panic!("Expected Dead variant"),
        }
    }

    #[tokio::test]
    async fn test_get_success() {
        let storage = InMemoryStorage::new();
        let handler = VariantEntityHandlerImpl;
        let reg = handler.register(
            VariantEntityRegisterInput {
                action: "createUser".to_string(),
                tag: "Ok".to_string(),
                fields: r#"["user"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let variant_id = match reg {
            VariantEntityRegisterOutput::Ok { variant } => variant,
        };
        let result = handler.get(
            VariantEntityGetInput { variant: variant_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            VariantEntityGetOutput::Ok { variant, action, tag, .. } => {
                assert_eq!(variant, variant_id);
                assert_eq!(action, "createUser");
                assert_eq!(tag, "Ok");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = VariantEntityHandlerImpl;
        let result = handler.get(
            VariantEntityGetInput { variant: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            VariantEntityGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
