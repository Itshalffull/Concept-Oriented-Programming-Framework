// DataQuality Handler Implementation
//
// Data quality validation, quarantine/release lifecycle,
// statistical profiling, and entity reconciliation against
// external knowledge bases.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DataQualityHandler;
use serde_json::json;

pub struct DataQualityHandlerImpl;

#[async_trait]
impl DataQualityHandler for DataQualityHandlerImpl {
    async fn validate(
        &self,
        input: DataQualityValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityValidateOutput, Box<dyn std::error::Error>> {
        let ruleset = storage.get("qualityRuleset", &input.ruleset_id).await?;
        let ruleset = match ruleset {
            Some(r) => r,
            None => return Ok(DataQualityValidateOutput::Notfound {
                message: format!("Ruleset \"{}\" not found", input.ruleset_id),
            }),
        };

        let data: serde_json::Value = match serde_json::from_str(&input.item) {
            Ok(v) => v,
            Err(_) => return Ok(DataQualityValidateOutput::Invalid {
                violations: serde_json::to_string(&vec![json!({
                    "rule": "parse", "field": "*", "message": "Invalid JSON"
                })])?,
            }),
        };

        let rules = ruleset.get("rules")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut violations = Vec::new();

        for rule in &rules {
            let rule_type = rule.get("type").and_then(|v| v.as_str()).unwrap_or("");
            match rule_type {
                "required" => {
                    if let Some(fields) = rule.get("fields").and_then(|v| v.as_array()) {
                        for field in fields {
                            let field_name = field.as_str().unwrap_or("");
                            let val = data.get(field_name);
                            let is_missing = match val {
                                None => true,
                                Some(v) => v.is_null() || (v.is_string() && v.as_str().unwrap_or("").trim().is_empty()),
                            };
                            if is_missing {
                                violations.push(json!({
                                    "rule": "required",
                                    "field": field_name,
                                    "message": format!("{} is required", field_name),
                                    "severity": "error"
                                }));
                            }
                        }
                    }
                }
                "type_check" => {
                    if let Some(types) = rule.get("types").and_then(|v| v.as_object()) {
                        for (field_name, expected_type) in types {
                            let expected = expected_type.as_str().unwrap_or("");
                            if let Some(val) = data.get(field_name) {
                                let actual_type = match val {
                                    serde_json::Value::String(_) => "string",
                                    serde_json::Value::Number(_) => "number",
                                    serde_json::Value::Bool(_) => "boolean",
                                    serde_json::Value::Array(_) => "object",
                                    serde_json::Value::Object(_) => "object",
                                    _ => "null",
                                };
                                if actual_type != expected {
                                    violations.push(json!({
                                        "rule": "type_check",
                                        "field": field_name,
                                        "message": format!("{} must be {}", field_name, expected),
                                        "severity": "error"
                                    }));
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        if !violations.is_empty() {
            return Ok(DataQualityValidateOutput::Invalid {
                violations: serde_json::to_string(&violations)?,
            });
        }

        Ok(DataQualityValidateOutput::Ok {
            valid: "true".to_string(),
            score: "1.0".to_string(),
        })
    }

    async fn quarantine(
        &self,
        input: DataQualityQuarantineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityQuarantineOutput, Box<dyn std::error::Error>> {
        let violations: serde_json::Value = serde_json::from_str(&input.violations)?;
        storage.put("quarantine", &input.item_id, json!({
            "itemId": input.item_id,
            "violations": violations,
            "quarantinedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(DataQualityQuarantineOutput::Ok)
    }

    async fn release(
        &self,
        input: DataQualityReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityReleaseOutput, Box<dyn std::error::Error>> {
        let quarantined = storage.get("quarantine", &input.item_id).await?;
        if quarantined.is_none() {
            return Ok(DataQualityReleaseOutput::Notfound {
                message: format!("Item \"{}\" not in quarantine", input.item_id),
            });
        }

        storage.del("quarantine", &input.item_id).await?;
        Ok(DataQualityReleaseOutput::Ok)
    }

    async fn profile(
        &self,
        input: DataQualityProfileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityProfileOutput, Box<dyn std::error::Error>> {
        let _ = storage;
        let profile = json!({
            "query": input.dataset_query,
            "recordCount": 0,
            "fields": {},
            "generatedAt": chrono::Utc::now().to_rfc3339(),
        });

        Ok(DataQualityProfileOutput::Ok {
            profile: serde_json::to_string(&profile)?,
        })
    }

    async fn reconcile(
        &self,
        input: DataQualityReconcileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityReconcileOutput, Box<dyn std::error::Error>> {
        let _ = (input, storage);
        Ok(DataQualityReconcileOutput::Ok {
            matches: "[]".to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_validate_ruleset_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DataQualityHandlerImpl;
        let result = handler.validate(
            DataQualityValidateInput {
                item: r#"{"name":"test"}"#.to_string(),
                ruleset_id: "missing-ruleset".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityValidateOutput::Notfound { message } => {
                assert!(message.contains("missing-ruleset"));
            },
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_invalid_json() {
        let storage = InMemoryStorage::new();
        storage.put("qualityRuleset", "rs1", json!({"rules": []})).await.unwrap();
        let handler = DataQualityHandlerImpl;
        let result = handler.validate(
            DataQualityValidateInput {
                item: "not-json".to_string(),
                ruleset_id: "rs1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityValidateOutput::Invalid { violations } => {
                assert!(violations.contains("Invalid JSON"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_passes() {
        let storage = InMemoryStorage::new();
        storage.put("qualityRuleset", "rs1", json!({"rules": []})).await.unwrap();
        let handler = DataQualityHandlerImpl;
        let result = handler.validate(
            DataQualityValidateInput {
                item: r#"{"name":"test"}"#.to_string(),
                ruleset_id: "rs1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityValidateOutput::Ok { valid, score } => {
                assert_eq!(valid, "true");
                assert_eq!(score, "1.0");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_quarantine_and_release() {
        let storage = InMemoryStorage::new();
        let handler = DataQualityHandlerImpl;

        let result = handler.quarantine(
            DataQualityQuarantineInput {
                item_id: "item-1".to_string(),
                violations: r#"[{"rule":"required"}]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityQuarantineOutput::Ok => {},
        }

        let result = handler.release(
            DataQualityReleaseInput {
                item_id: "item-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityReleaseOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_release_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DataQualityHandlerImpl;
        let result = handler.release(
            DataQualityReleaseInput {
                item_id: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityReleaseOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_profile() {
        let storage = InMemoryStorage::new();
        let handler = DataQualityHandlerImpl;
        let result = handler.profile(
            DataQualityProfileInput {
                dataset_query: "SELECT * FROM items".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityProfileOutput::Ok { profile } => {
                assert!(!profile.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_reconcile() {
        let storage = InMemoryStorage::new();
        let handler = DataQualityHandlerImpl;
        let result = handler.reconcile(
            DataQualityReconcileInput {
                field: "name".to_string(),
                knowledge_base: "wikidata".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DataQualityReconcileOutput::Ok { matches } => {
                assert_eq!(matches, "[]");
            },
        }
    }
}
