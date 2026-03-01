use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SchemaEvolutionHandler;
use serde_json::json;

pub struct SchemaEvolutionHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("schema-evolution-{}-{}", t.as_secs(), t.subsec_nanos())
}

const VALID_MODES: &[&str] = &["backward", "forward", "full", "none"];

/// Check compatibility between two JSON-encoded schemas under a given mode.
fn check_compatibility(old_schema: &str, new_schema: &str, mode: &str) -> (bool, Vec<String>) {
    let old_fields: Vec<serde_json::Value> = serde_json::from_str(old_schema).unwrap_or_default();
    let new_fields: Vec<serde_json::Value> = serde_json::from_str(new_schema).unwrap_or_default();

    let mut reasons = Vec::new();

    let old_map: std::collections::HashMap<String, &serde_json::Value> = old_fields.iter()
        .filter_map(|f| f.get("name").and_then(|v| v.as_str()).map(|n| (n.to_string(), f)))
        .collect();
    let new_map: std::collections::HashMap<String, &serde_json::Value> = new_fields.iter()
        .filter_map(|f| f.get("name").and_then(|v| v.as_str()).map(|n| (n.to_string(), f)))
        .collect();

    if mode == "backward" || mode == "full" {
        for (name, field) in &new_map {
            if !old_map.contains_key(name) {
                let required = field.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
                let has_default = field.get("default").is_some();
                if required && !has_default {
                    reasons.push(format!("New required field '{}' without default breaks backward compatibility", name));
                }
            }
        }
    }

    if mode == "forward" || mode == "full" {
        for (name, field) in &old_map {
            if !new_map.contains_key(name) {
                let required = field.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
                if required {
                    reasons.push(format!("Removed required field '{}' breaks forward compatibility", name));
                }
            }
        }
    }

    if mode != "none" {
        for (name, new_field) in &new_map {
            if let Some(old_field) = old_map.get(name) {
                let old_type = old_field.get("type").and_then(|v| v.as_str()).unwrap_or("");
                let new_type = new_field.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if old_type != new_type {
                    reasons.push(format!("Type change for field '{}': '{}' -> '{}'", name, old_type, new_type));
                }
            }
        }
    }

    (reasons.is_empty(), reasons)
}

#[async_trait]
impl SchemaEvolutionHandler for SchemaEvolutionHandlerImpl {
    async fn register(
        &self,
        input: SchemaEvolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionRegisterOutput, Box<dyn std::error::Error>> {
        if !VALID_MODES.contains(&input.compatibility.as_str()) {
            return Ok(SchemaEvolutionRegisterOutput::InvalidCompatibility {
                message: format!("Compatibility mode '{}' is not valid. Allowed: {:?}", input.compatibility, VALID_MODES),
            });
        }

        let schema_str = String::from_utf8_lossy(&input.schema).to_string();
        let existing = storage.find("schema-evolution", Some(&json!({"subject": input.subject}))).await?;

        let mut next_version = 1i64;
        let mut latest_schema: Option<String> = None;
        let mut latest_compat: Option<String> = None;

        for entry in &existing {
            let v = entry.get("version").and_then(|v| v.as_i64()).unwrap_or(0);
            if v >= next_version {
                next_version = v + 1;
                latest_schema = entry.get("schema").and_then(|v| v.as_str()).map(String::from);
                latest_compat = entry.get("compatibility").and_then(|v| v.as_str()).map(String::from);
            }
        }

        if let Some(prev_schema) = &latest_schema {
            let mode = latest_compat.as_deref().unwrap_or(&input.compatibility);
            let (compatible, reasons) = check_compatibility(prev_schema, &schema_str, mode);
            if !compatible {
                return Ok(SchemaEvolutionRegisterOutput::Incompatible { reasons });
            }
        }

        let schema_id = next_id();
        storage.put("schema-evolution", &schema_id, json!({
            "id": schema_id,
            "subject": input.subject,
            "version": next_version,
            "schema": schema_str,
            "compatibility": input.compatibility
        })).await?;

        Ok(SchemaEvolutionRegisterOutput::Ok {
            version: next_version,
            schema_id,
        })
    }

    async fn check(
        &self,
        input: SchemaEvolutionCheckInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionCheckOutput, Box<dyn std::error::Error>> {
        let old = String::from_utf8_lossy(&input.old_schema).to_string();
        let new = String::from_utf8_lossy(&input.new_schema).to_string();
        let (compatible, reasons) = check_compatibility(&old, &new, &input.mode);

        if compatible {
            Ok(SchemaEvolutionCheckOutput::Compatible)
        } else {
            Ok(SchemaEvolutionCheckOutput::Incompatible { reasons })
        }
    }

    async fn upcast(
        &self,
        input: SchemaEvolutionUpcastInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionUpcastOutput, Box<dyn std::error::Error>> {
        let all = storage.find("schema-evolution", Some(&json!({"subject": input.subject}))).await?;

        let from = all.iter().find(|s| s.get("version").and_then(|v| v.as_i64()) == Some(input.from_version));
        if from.is_none() {
            return Ok(SchemaEvolutionUpcastOutput::NotFound {
                message: format!("Subject '{}' version {} not found", input.subject, input.from_version),
            });
        }

        let to = all.iter().find(|s| s.get("version").and_then(|v| v.as_i64()) == Some(input.to_version));
        if to.is_none() {
            return Ok(SchemaEvolutionUpcastOutput::NotFound {
                message: format!("Subject '{}' version {} not found", input.subject, input.to_version),
            });
        }

        if input.from_version > input.to_version {
            return Ok(SchemaEvolutionUpcastOutput::NoPath {
                message: format!("Cannot downcast from version {} to {}", input.from_version, input.to_version),
            });
        }

        let data_str = String::from_utf8_lossy(&input.data).to_string();
        let mut data_obj: serde_json::Value = serde_json::from_str(&data_str).unwrap_or(json!({}));

        // Apply default values from target schema
        let to_schema_str = to.unwrap().get("schema").and_then(|v| v.as_str()).unwrap_or("[]");
        let target_fields: Vec<serde_json::Value> = serde_json::from_str(to_schema_str).unwrap_or_default();

        for field in &target_fields {
            let name = field.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if !data_obj.get(name).is_some() {
                if let Some(default) = field.get("default") {
                    data_obj[name] = default.clone();
                }
            }
        }

        Ok(SchemaEvolutionUpcastOutput::Ok {
            transformed: serde_json::to_vec(&data_obj)?,
        })
    }

    async fn resolve(
        &self,
        input: SchemaEvolutionResolveInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionResolveOutput, Box<dyn std::error::Error>> {
        let reader_str = String::from_utf8_lossy(&input.reader_schema).to_string();
        let writer_str = String::from_utf8_lossy(&input.writer_schema).to_string();

        let reader_fields: Vec<serde_json::Value> = serde_json::from_str(&reader_str).unwrap_or_default();
        let writer_fields: Vec<serde_json::Value> = serde_json::from_str(&writer_str).unwrap_or_default();

        if reader_fields.is_empty() && writer_fields.is_empty() {
            return Ok(SchemaEvolutionResolveOutput::Incompatible {
                reasons: vec!["Unable to parse one or both schemas".to_string()],
            });
        }

        let reader_names: std::collections::HashSet<String> = reader_fields.iter()
            .filter_map(|f| f.get("name").and_then(|v| v.as_str()).map(String::from))
            .collect();

        let mut merged = reader_fields.clone();
        for field in &writer_fields {
            let name = field.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if !reader_names.contains(name) {
                let mut f = field.clone();
                f["required"] = json!(false);
                merged.push(f);
            }
        }

        Ok(SchemaEvolutionResolveOutput::Ok {
            resolved: serde_json::to_vec(&merged)?,
        })
    }

    async fn get_schema(
        &self,
        input: SchemaEvolutionGetSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionGetSchemaOutput, Box<dyn std::error::Error>> {
        let all = storage.find("schema-evolution", Some(&json!({"subject": input.subject}))).await?;
        let found = all.iter().find(|s| s.get("version").and_then(|v| v.as_i64()) == Some(input.version));

        match found {
            Some(entry) => Ok(SchemaEvolutionGetSchemaOutput::Ok {
                schema: entry.get("schema")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .as_bytes()
                    .to_vec(),
                compatibility: entry.get("compatibility")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            }),
            None => Ok(SchemaEvolutionGetSchemaOutput::NotFound {
                message: format!("Subject '{}' version {} not found", input.subject, input.version),
            }),
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
        let handler = SchemaEvolutionHandlerImpl;
        let result = handler.register(
            SchemaEvolutionRegisterInput {
                subject: "user".to_string(),
                schema: b"[]".to_vec(),
                compatibility: "backward".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SchemaEvolutionRegisterOutput::Ok { version, schema_id } => {
                assert_eq!(version, 1);
                assert!(schema_id.starts_with("schema-evolution-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_invalid_compatibility() {
        let storage = InMemoryStorage::new();
        let handler = SchemaEvolutionHandlerImpl;
        let result = handler.register(
            SchemaEvolutionRegisterInput {
                subject: "user".to_string(),
                schema: b"[]".to_vec(),
                compatibility: "invalid".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SchemaEvolutionRegisterOutput::InvalidCompatibility { .. } => {},
            _ => panic!("Expected InvalidCompatibility variant"),
        }
    }

    #[tokio::test]
    async fn test_check_compatible() {
        let storage = InMemoryStorage::new();
        let handler = SchemaEvolutionHandlerImpl;
        let result = handler.check(
            SchemaEvolutionCheckInput {
                old_schema: b"[]".to_vec(),
                new_schema: b"[]".to_vec(),
                mode: "backward".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SchemaEvolutionCheckOutput::Compatible => {},
            _ => panic!("Expected Compatible variant"),
        }
    }

    #[tokio::test]
    async fn test_upcast_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SchemaEvolutionHandlerImpl;
        let result = handler.upcast(
            SchemaEvolutionUpcastInput {
                subject: "missing".to_string(),
                from_version: 1,
                to_version: 2,
                data: b"{}".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SchemaEvolutionUpcastOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_schema_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SchemaEvolutionHandlerImpl;
        let result = handler.get_schema(
            SchemaEvolutionGetSchemaInput {
                subject: "missing".to_string(),
                version: 1,
            },
            &storage,
        ).await.unwrap();
        match result {
            SchemaEvolutionGetSchemaOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }
}
