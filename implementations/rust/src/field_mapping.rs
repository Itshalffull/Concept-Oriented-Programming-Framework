// FieldMapping Concept Implementation (Rust)
//
// Data integration kit — source-to-destination field translation.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMappingMapInput {
    pub mapping_id: String,
    pub source_field: String,
    pub dest_field: String,
    pub transform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FieldMappingMapOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMappingApplyInput {
    pub record: String,
    pub mapping_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FieldMappingApplyOutput {
    #[serde(rename = "ok")]
    Ok { mapped: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMappingReverseInput {
    pub record: String,
    pub mapping_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FieldMappingReverseOutput {
    #[serde(rename = "ok")]
    Ok { reversed: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMappingAutoDiscoverInput {
    pub source_schema: String,
    pub dest_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FieldMappingAutoDiscoverOutput {
    #[serde(rename = "ok")]
    Ok {
        mapping_id: String,
        suggestions: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMappingValidateInput {
    pub mapping_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum FieldMappingValidateOutput {
    #[serde(rename = "ok")]
    Ok { warnings: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

pub struct FieldMappingHandler;

impl FieldMappingHandler {
    pub async fn map(
        &self,
        input: FieldMappingMapInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FieldMappingMapOutput> {
        let existing = storage.get("field_mapping", &input.mapping_id).await?;
        match existing {
            None => Ok(FieldMappingMapOutput::Notfound {
                message: format!("Mapping \"{}\" not found", input.mapping_id),
            }),
            Some(mut record) => {
                let rules = record["rules"].as_array_mut().unwrap_or(&mut vec![]);
                let mut new_rules: Vec<serde_json::Value> = rules.clone();
                new_rules.push(json!({
                    "source_field": input.source_field,
                    "dest_field": input.dest_field,
                    "transform": input.transform,
                }));
                record["rules"] = json!(new_rules);
                storage.put("field_mapping", &input.mapping_id, record).await?;
                Ok(FieldMappingMapOutput::Ok)
            }
        }
    }

    pub async fn apply(
        &self,
        input: FieldMappingApplyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FieldMappingApplyOutput> {
        let existing = storage.get("field_mapping", &input.mapping_id).await?;
        match existing {
            None => Ok(FieldMappingApplyOutput::Notfound {
                message: format!("Mapping \"{}\" not found", input.mapping_id),
            }),
            Some(record) => {
                let source: Result<serde_json::Value, _> = serde_json::from_str(&input.record);
                let source = match source {
                    Ok(v) => v,
                    Err(_) => {
                        return Ok(FieldMappingApplyOutput::Error {
                            message: "Invalid JSON record".into(),
                        })
                    }
                };

                let rules = record["rules"].as_array().cloned().unwrap_or_default();
                let mut result = serde_json::Map::new();

                for rule in &rules {
                    let src = rule["source_field"].as_str().unwrap_or("");
                    let dst = rule["dest_field"].as_str().unwrap_or("");
                    if let Some(val) = source.get(src) {
                        result.insert(dst.to_string(), val.clone());
                    }
                }

                Ok(FieldMappingApplyOutput::Ok {
                    mapped: serde_json::Value::Object(result).to_string(),
                })
            }
        }
    }

    pub async fn reverse(
        &self,
        input: FieldMappingReverseInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FieldMappingReverseOutput> {
        let existing = storage.get("field_mapping", &input.mapping_id).await?;
        match existing {
            None => Ok(FieldMappingReverseOutput::Notfound {
                message: format!("Mapping \"{}\" not found", input.mapping_id),
            }),
            Some(record) => {
                let dest: serde_json::Value =
                    serde_json::from_str(&input.record).unwrap_or(json!({}));
                let rules = record["rules"].as_array().cloned().unwrap_or_default();
                let mut result = serde_json::Map::new();

                for rule in &rules {
                    let src = rule["source_field"].as_str().unwrap_or("");
                    let dst = rule["dest_field"].as_str().unwrap_or("");
                    if let Some(val) = dest.get(dst) {
                        result.insert(src.to_string(), val.clone());
                    }
                }

                Ok(FieldMappingReverseOutput::Ok {
                    reversed: serde_json::Value::Object(result).to_string(),
                })
            }
        }
    }

    pub async fn auto_discover(
        &self,
        input: FieldMappingAutoDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FieldMappingAutoDiscoverOutput> {
        let mapping_id = format!("map-{}", chrono::Utc::now().timestamp_millis());

        let src_fields: Vec<String> = input
            .source_schema
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();
        let dst_fields: Vec<String> = input
            .dest_schema
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        let mut suggestions = Vec::new();
        let mut rules = Vec::new();
        for src in &src_fields {
            let src_norm = src.to_lowercase().replace(['_', '-'], "");
            for dst in &dst_fields {
                if dst.to_lowercase().replace(['_', '-'], "") == src_norm {
                    suggestions.push(json!({"src": src, "dest": dst}));
                    rules.push(json!({"source_field": src, "dest_field": dst, "transform": ""}));
                }
            }
        }

        storage
            .put(
                "field_mapping",
                &mapping_id,
                json!({
                    "mapping_id": mapping_id,
                    "source_schema": input.source_schema,
                    "dest_schema": input.dest_schema,
                    "rules": rules,
                }),
            )
            .await?;

        Ok(FieldMappingAutoDiscoverOutput::Ok {
            mapping_id,
            suggestions: serde_json::Value::Array(suggestions).to_string(),
        })
    }

    pub async fn validate(
        &self,
        input: FieldMappingValidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FieldMappingValidateOutput> {
        let existing = storage.get("field_mapping", &input.mapping_id).await?;
        match existing {
            None => Ok(FieldMappingValidateOutput::Notfound {
                message: format!("Mapping \"{}\" not found", input.mapping_id),
            }),
            Some(record) => {
                let rules = record["rules"].as_array().cloned().unwrap_or_default();
                let mut warnings = Vec::new();
                if rules.is_empty() {
                    warnings.push("No mapping rules defined".to_string());
                }
                Ok(FieldMappingValidateOutput::Ok {
                    warnings: json!(warnings).to_string(),
                })
            }
        }
    }
}
