// DataQuality Concept Implementation (Rust)
//
// Data integration kit — validation gating and quarantine.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataQualityValidateInput {
    pub item: String,
    pub ruleset_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataQualityValidateOutput {
    #[serde(rename = "ok")]
    Ok { valid: String, score: String },
    #[serde(rename = "invalid")]
    Invalid { violations: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataQualityQuarantineInput {
    pub item_id: String,
    pub violations: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataQualityQuarantineOutput {
    #[serde(rename = "ok")]
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataQualityReleaseInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataQualityReleaseOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataQualityProfileInput {
    pub dataset_query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataQualityProfileOutput {
    #[serde(rename = "ok")]
    Ok { profile: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataQualityReconcileInput {
    pub field: String,
    pub knowledge_base: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataQualityReconcileOutput {
    #[serde(rename = "ok")]
    Ok { matches: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataQualityDeduplicateInput {
    pub query: String,
    pub strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DataQualityDeduplicateOutput {
    #[serde(rename = "ok")]
    Ok { clusters: String },
}

pub struct DataQualityHandler;

impl DataQualityHandler {
    pub async fn validate(
        &self,
        input: DataQualityValidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataQualityValidateOutput> {
        let ruleset = storage.get("quality_ruleset", &input.ruleset_id).await?;
        if ruleset.is_none() {
            return Ok(DataQualityValidateOutput::Notfound {
                message: format!("Ruleset \"{}\" not found", input.ruleset_id),
            });
        }

        let data: Result<serde_json::Value, _> = serde_json::from_str(&input.item);
        if data.is_err() {
            return Ok(DataQualityValidateOutput::Invalid {
                violations: json!([{"rule": "parse", "field": "*", "message": "Invalid JSON"}])
                    .to_string(),
            });
        }
        let data = data.unwrap();

        let ruleset = ruleset.unwrap();
        let rules = ruleset["rules"].as_array().cloned().unwrap_or_default();
        let mut violations = Vec::new();

        for rule in &rules {
            let rule_type = rule["type"].as_str().unwrap_or("");
            if rule_type == "required" {
                if let Some(fields) = rule["fields"].as_array() {
                    for field in fields {
                        let fname = field.as_str().unwrap_or("");
                        let val = data.get(fname);
                        let is_empty = match val {
                            None => true,
                            Some(v) => v.is_null() || v.as_str().map(|s| s.trim().is_empty()).unwrap_or(false),
                        };
                        if is_empty {
                            violations.push(json!({
                                "rule": "required",
                                "field": fname,
                                "message": format!("{} is required", fname),
                                "severity": "error",
                            }));
                        }
                    }
                }
            }
        }

        if !violations.is_empty() {
            return Ok(DataQualityValidateOutput::Invalid {
                violations: json!(violations).to_string(),
            });
        }

        Ok(DataQualityValidateOutput::Ok {
            valid: "true".into(),
            score: "1.0".into(),
        })
    }

    pub async fn quarantine(
        &self,
        input: DataQualityQuarantineInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataQualityQuarantineOutput> {
        storage
            .put(
                "quarantine",
                &input.item_id,
                json!({
                    "item_id": input.item_id,
                    "violations": input.violations,
                    "quarantined_at": chrono::Utc::now().to_rfc3339(),
                }),
            )
            .await?;
        Ok(DataQualityQuarantineOutput::Ok)
    }

    pub async fn release(
        &self,
        input: DataQualityReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DataQualityReleaseOutput> {
        let existing = storage.get("quarantine", &input.item_id).await?;
        match existing {
            None => Ok(DataQualityReleaseOutput::Notfound {
                message: format!("Item \"{}\" not in quarantine", input.item_id),
            }),
            Some(_) => {
                storage.del("quarantine", &input.item_id).await?;
                Ok(DataQualityReleaseOutput::Ok)
            }
        }
    }

    pub async fn profile(
        &self,
        input: DataQualityProfileInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<DataQualityProfileOutput> {
        let profile = json!({
            "query": input.dataset_query,
            "record_count": 0,
            "fields": {},
            "generated_at": chrono::Utc::now().to_rfc3339(),
        });
        Ok(DataQualityProfileOutput::Ok {
            profile: profile.to_string(),
        })
    }

    pub async fn reconcile(
        &self,
        _input: DataQualityReconcileInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<DataQualityReconcileOutput> {
        Ok(DataQualityReconcileOutput::Ok {
            matches: "[]".into(),
        })
    }

    pub async fn deduplicate(
        &self,
        _input: DataQualityDeduplicateInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<DataQualityDeduplicateOutput> {
        Ok(DataQualityDeduplicateOutput::Ok {
            clusters: "[]".into(),
        })
    }
}
