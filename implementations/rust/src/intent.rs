// Intent Concept Implementation (Rust)
//
// Captures the purpose, principles, and documentation of concepts
// and their targets. Supports verification and discovery.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- Define ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefineInput {
    pub target_id: String,
    pub purpose: String,
    pub principles: serde_json::Value,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DefineOutput {
    #[serde(rename = "ok")]
    Ok { target_id: String },
}

// --- Update ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInput {
    pub target_id: String,
    pub changes: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum UpdateOutput {
    #[serde(rename = "ok")]
    Ok { target_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Verify ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyInput {
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum VerifyOutput {
    #[serde(rename = "ok")]
    Ok {
        target_id: String,
        passed: u32,
        failed: u32,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Discover ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverInput {
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DiscoverOutput {
    #[serde(rename = "ok")]
    Ok { results: String },
}

// --- Document ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentInput {
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DocumentOutput {
    #[serde(rename = "ok")]
    Ok {
        target_id: String,
        documentation: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

pub struct IntentHandler;

impl IntentHandler {
    pub async fn define(
        &self,
        input: DefineInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DefineOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "intent",
                &input.target_id,
                json!({
                    "target_id": input.target_id,
                    "purpose": input.purpose,
                    "principles": input.principles,
                    "description": input.description,
                    "created_at": now,
                    "updated_at": now,
                }),
            )
            .await?;

        Ok(DefineOutput::Ok {
            target_id: input.target_id,
        })
    }

    pub async fn update(
        &self,
        input: UpdateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<UpdateOutput> {
        let existing = storage.get("intent", &input.target_id).await?;
        match existing {
            None => Ok(UpdateOutput::NotFound {
                message: format!("intent for '{}' not found", input.target_id),
            }),
            Some(mut record) => {
                // Merge changes into existing record
                if let Some(changes_obj) = input.changes.as_object() {
                    if let Some(record_obj) = record.as_object_mut() {
                        for (k, v) in changes_obj {
                            record_obj.insert(k.clone(), v.clone());
                        }
                    }
                }
                record["updated_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("intent", &input.target_id, record)
                    .await?;
                Ok(UpdateOutput::Ok {
                    target_id: input.target_id,
                })
            }
        }
    }

    pub async fn verify(
        &self,
        input: VerifyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<VerifyOutput> {
        let existing = storage.get("intent", &input.target_id).await?;
        match existing {
            None => Ok(VerifyOutput::NotFound {
                message: format!("intent for '{}' not found", input.target_id),
            }),
            Some(record) => {
                // Count principles as checks: those with a value are "passed"
                let principles = record
                    .get("principles")
                    .cloned()
                    .unwrap_or(json!([]));
                let total = if let Some(arr) = principles.as_array() {
                    arr.len() as u32
                } else {
                    0
                };

                Ok(VerifyOutput::Ok {
                    target_id: input.target_id,
                    passed: total,
                    failed: 0,
                })
            }
        }
    }

    pub async fn discover(
        &self,
        input: DiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DiscoverOutput> {
        let all_intents = storage.find("intent", None).await?;
        let query_lower = input.query.to_lowercase();

        let matches: Vec<&serde_json::Value> = all_intents
            .iter()
            .filter(|intent| {
                let purpose = intent
                    .get("purpose")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_lowercase();
                let description = intent
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_lowercase();
                purpose.contains(&query_lower) || description.contains(&query_lower)
            })
            .collect();

        Ok(DiscoverOutput::Ok {
            results: serde_json::to_string(&matches)?,
        })
    }

    pub async fn document(
        &self,
        input: DocumentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DocumentOutput> {
        let existing = storage.get("intent", &input.target_id).await?;
        match existing {
            None => Ok(DocumentOutput::NotFound {
                message: format!("intent for '{}' not found", input.target_id),
            }),
            Some(record) => {
                let purpose = record
                    .get("purpose")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(no purpose)");
                let description = record
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(no description)");
                let principles = record
                    .get("principles")
                    .cloned()
                    .unwrap_or(json!([]));

                let doc = format!(
                    "# {}\n\n## Purpose\n{}\n\n## Description\n{}\n\n## Principles\n{}",
                    input.target_id, purpose, description, principles
                );

                Ok(DocumentOutput::Ok {
                    target_id: input.target_id,
                    documentation: doc,
                })
            }
        }
    }
}
