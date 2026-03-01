// FieldMapping -- bidirectional field mapping between source and destination
// schemas with auto-discovery, transform application, and validation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FieldMappingHandler;
use serde_json::json;

pub struct FieldMappingHandlerImpl;

#[async_trait]
impl FieldMappingHandler for FieldMappingHandlerImpl {
    async fn map(
        &self,
        input: FieldMappingMapInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingMapOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("fieldMapping", &input.mapping_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(FieldMappingMapOutput::Notfound {
                    message: format!("Mapping \"{}\" not found", input.mapping_id),
                });
            }
        };

        let mut rules: Vec<serde_json::Value> = record["rules"]
            .as_array()
            .cloned()
            .unwrap_or_default();

        rules.push(json!({
            "sourceField": input.source_field,
            "destField": input.dest_field,
            "transform": input.transform,
        }));

        let mut updated = record.clone();
        updated["rules"] = json!(rules);
        storage.put("fieldMapping", &input.mapping_id, updated).await?;

        Ok(FieldMappingMapOutput::Ok)
    }

    async fn apply(
        &self,
        input: FieldMappingApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingApplyOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("fieldMapping", &input.mapping_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(FieldMappingApplyOutput::Notfound {
                    message: format!("Mapping \"{}\" not found", input.mapping_id),
                });
            }
        };

        let source_data: serde_json::Value = match serde_json::from_str(&input.record) {
            Ok(v) => v,
            Err(_) => {
                return Ok(FieldMappingApplyOutput::Error {
                    message: "Invalid JSON record".to_string(),
                });
            }
        };

        let rules = record["rules"].as_array().cloned().unwrap_or_default();
        let mut result = serde_json::Map::new();

        for rule in &rules {
            let source_field = rule["sourceField"].as_str().unwrap_or("");
            let dest_field = rule["destField"].as_str().unwrap_or("");
            if let Some(value) = source_data.get(source_field) {
                result.insert(dest_field.to_string(), value.clone());
            }
        }

        Ok(FieldMappingApplyOutput::Ok {
            mapped: serde_json::to_string(&result)?,
        })
    }

    async fn reverse(
        &self,
        input: FieldMappingReverseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingReverseOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("fieldMapping", &input.mapping_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(FieldMappingReverseOutput::Notfound {
                    message: format!("Mapping \"{}\" not found", input.mapping_id),
                });
            }
        };

        let dest_data: serde_json::Value = match serde_json::from_str(&input.record) {
            Ok(v) => v,
            Err(_) => {
                return Ok(FieldMappingReverseOutput::Notfound {
                    message: "Invalid JSON record".to_string(),
                });
            }
        };

        let rules = record["rules"].as_array().cloned().unwrap_or_default();
        let mut result = serde_json::Map::new();

        for rule in &rules {
            let source_field = rule["sourceField"].as_str().unwrap_or("");
            let dest_field = rule["destField"].as_str().unwrap_or("");
            if let Some(value) = dest_data.get(dest_field) {
                result.insert(source_field.to_string(), value.clone());
            }
        }

        Ok(FieldMappingReverseOutput::Ok {
            reversed: serde_json::to_string(&result)?,
        })
    }

    async fn auto_discover(
        &self,
        input: FieldMappingAutoDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingAutoDiscoverOutput, Box<dyn std::error::Error>> {
        let mapping_id = format!("map-{}", chrono::Utc::now().timestamp_millis());

        // Parse source and dest field lists
        let src_fields: Vec<String> = serde_json::from_str(&input.source_schema)
            .unwrap_or_else(|_| {
                input.source_schema.split(',').map(|f| f.trim().to_string()).collect()
            });
        let dst_fields: Vec<String> = serde_json::from_str(&input.dest_schema)
            .unwrap_or_else(|_| {
                input.dest_schema.split(',').map(|f| f.trim().to_string()).collect()
            });

        // Auto-discover by normalized name similarity
        let mut suggestions = Vec::new();
        let mut rules = Vec::new();

        for src in &src_fields {
            let normalized_src = src.to_lowercase().replace(&['-', '_'][..], "");
            for dst in &dst_fields {
                let normalized_dst = dst.to_lowercase().replace(&['-', '_'][..], "");
                if normalized_src == normalized_dst {
                    suggestions.push(json!({"src": src, "dest": dst}));
                    rules.push(json!({
                        "sourceField": src,
                        "destField": dst,
                        "transform": "",
                    }));
                }
            }
        }

        storage.put("fieldMapping", &mapping_id, json!({
            "mappingId": mapping_id,
            "sourceSchema": input.source_schema,
            "destSchema": input.dest_schema,
            "rules": rules,
        })).await?;

        Ok(FieldMappingAutoDiscoverOutput::Ok {
            mapping_id,
            suggestions: serde_json::to_string(&suggestions)?,
        })
    }

    async fn validate(
        &self,
        input: FieldMappingValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingValidateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("fieldMapping", &input.mapping_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(FieldMappingValidateOutput::Notfound {
                    message: format!("Mapping \"{}\" not found", input.mapping_id),
                });
            }
        };

        let rules = record["rules"].as_array().cloned().unwrap_or_default();
        let mut warnings = Vec::new();

        if rules.is_empty() {
            warnings.push("No mapping rules defined".to_string());
        }

        Ok(FieldMappingValidateOutput::Ok {
            warnings: serde_json::to_string(&warnings)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_map_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FieldMappingHandlerImpl;
        let result = handler.map(
            FieldMappingMapInput {
                mapping_id: "nonexistent".to_string(),
                source_field: "name".to_string(),
                dest_field: "full_name".to_string(),
                transform: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FieldMappingMapOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_auto_discover() {
        let storage = InMemoryStorage::new();
        let handler = FieldMappingHandlerImpl;
        let result = handler.auto_discover(
            FieldMappingAutoDiscoverInput {
                source_schema: r#"["name","email","age"]"#.to_string(),
                dest_schema: r#"["name","email_address","age"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FieldMappingAutoDiscoverOutput::Ok { mapping_id, suggestions } => {
                assert!(!mapping_id.is_empty());
                assert!(suggestions.contains("name"));
                assert!(suggestions.contains("age"));
            },
        }
    }

    #[tokio::test]
    async fn test_apply_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FieldMappingHandlerImpl;
        let result = handler.apply(
            FieldMappingApplyInput {
                mapping_id: "nonexistent".to_string(),
                record: r#"{"name":"test"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FieldMappingApplyOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = FieldMappingHandlerImpl;
        // Create a mapping first
        let discover_result = handler.auto_discover(
            FieldMappingAutoDiscoverInput {
                source_schema: r#"["name"]"#.to_string(),
                dest_schema: r#"["name"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let mapping_id = match discover_result {
            FieldMappingAutoDiscoverOutput::Ok { mapping_id, .. } => mapping_id,
        };
        let result = handler.apply(
            FieldMappingApplyInput {
                mapping_id,
                record: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FieldMappingApplyOutput::Error { message } => {
                assert!(message.contains("Invalid JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_reverse_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FieldMappingHandlerImpl;
        let result = handler.reverse(
            FieldMappingReverseInput {
                mapping_id: "nonexistent".to_string(),
                record: r#"{"name":"test"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FieldMappingReverseOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FieldMappingHandlerImpl;
        let result = handler.validate(
            FieldMappingValidateInput {
                mapping_id: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FieldMappingValidateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_with_rules() {
        let storage = InMemoryStorage::new();
        let handler = FieldMappingHandlerImpl;
        let discover_result = handler.auto_discover(
            FieldMappingAutoDiscoverInput {
                source_schema: r#"["name","age"]"#.to_string(),
                dest_schema: r#"["name","age"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let mapping_id = match discover_result {
            FieldMappingAutoDiscoverOutput::Ok { mapping_id, .. } => mapping_id,
        };
        let result = handler.apply(
            FieldMappingApplyInput {
                mapping_id,
                record: r#"{"name":"Alice","age":30}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FieldMappingApplyOutput::Ok { mapped } => {
                assert!(mapped.contains("Alice"));
                assert!(mapped.contains("30"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
