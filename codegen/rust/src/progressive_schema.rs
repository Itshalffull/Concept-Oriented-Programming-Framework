// ProgressiveSchema Concept Implementation (Rust)
//
// Data integration kit — freeform-to-structured emergence via detection.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveSchemaCaptureFreeformInput {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaCaptureFreeformOutput {
    #[serde(rename = "ok")]
    Ok { item_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveSchemaDetectStructureInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaDetectStructureOutput {
    #[serde(rename = "ok")]
    Ok { suggestions: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveSchemaAcceptSuggestionInput {
    pub item_id: String,
    pub suggestion_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaAcceptSuggestionOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveSchemaRejectSuggestionInput {
    pub item_id: String,
    pub suggestion_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaRejectSuggestionOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveSchemaPromoteInput {
    pub item_id: String,
    pub target_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaPromoteOutput {
    #[serde(rename = "ok")]
    Ok { result: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "incomplete")]
    Incomplete { gaps: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveSchemaInferSchemaInput {
    pub items: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ProgressiveSchemaInferSchemaOutput {
    #[serde(rename = "ok")]
    Ok { proposed_schema: String },
    #[serde(rename = "error")]
    Error { message: String },
}

pub struct ProgressiveSchemaHandler;

impl ProgressiveSchemaHandler {
    pub async fn capture_freeform(
        &self,
        input: ProgressiveSchemaCaptureFreeformInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProgressiveSchemaCaptureFreeformOutput> {
        let item_id = format!("ps-{}", chrono::Utc::now().timestamp_millis());
        storage
            .put(
                "progressive_item",
                &item_id,
                json!({
                    "item_id": item_id,
                    "content": input.content,
                    "formality": "freeform",
                    "detected_structure": [],
                    "schema": null,
                    "promotion_history": [],
                }),
            )
            .await?;
        Ok(ProgressiveSchemaCaptureFreeformOutput::Ok { item_id })
    }

    pub async fn detect_structure(
        &self,
        input: ProgressiveSchemaDetectStructureInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProgressiveSchemaDetectStructureOutput> {
        let existing = storage.get("progressive_item", &input.item_id).await?;
        match existing {
            None => Ok(ProgressiveSchemaDetectStructureOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
            Some(mut record) => {
                let content = record["content"].as_str().unwrap_or("").to_string();
                let mut suggestions = Vec::new();
                let mut idx = 0u32;

                // Date detection
                let date_re = regex::Regex::new(r"\b(\d{4}-\d{2}-\d{2})\b").unwrap();
                for cap in date_re.captures_iter(&content) {
                    idx += 1;
                    suggestions.push(json!({
                        "suggestion_id": format!("sug-{}", idx),
                        "detector_id": "date_detector",
                        "field": "date",
                        "value": &cap[1],
                        "type": "date",
                        "confidence": 0.95,
                        "status": "pending",
                    }));
                }

                // Tag detection
                let tag_re = regex::Regex::new(r"#([\w-]+)").unwrap();
                for cap in tag_re.captures_iter(&content) {
                    idx += 1;
                    suggestions.push(json!({
                        "suggestion_id": format!("sug-{}", idx),
                        "detector_id": "tag_detector",
                        "field": "tag",
                        "value": &cap[1],
                        "type": "tag",
                        "confidence": 0.9,
                        "status": "pending",
                    }));
                }

                // URL detection
                let url_re = regex::Regex::new(r"https?://[^\s]+").unwrap();
                for mat in url_re.find_iter(&content) {
                    idx += 1;
                    suggestions.push(json!({
                        "suggestion_id": format!("sug-{}", idx),
                        "detector_id": "url_detector",
                        "field": "url",
                        "value": mat.as_str(),
                        "type": "url",
                        "confidence": 0.99,
                        "status": "pending",
                    }));
                }

                let formality = if suggestions.is_empty() {
                    "freeform"
                } else {
                    "inline_metadata"
                };
                record["detected_structure"] = json!(suggestions);
                record["formality"] = json!(formality);
                storage
                    .put("progressive_item", &input.item_id, record)
                    .await?;

                Ok(ProgressiveSchemaDetectStructureOutput::Ok {
                    suggestions: json!(suggestions).to_string(),
                })
            }
        }
    }

    pub async fn accept_suggestion(
        &self,
        input: ProgressiveSchemaAcceptSuggestionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProgressiveSchemaAcceptSuggestionOutput> {
        let existing = storage.get("progressive_item", &input.item_id).await?;
        match existing {
            None => Ok(ProgressiveSchemaAcceptSuggestionOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
            Some(mut record) => {
                let suggestions = record["detected_structure"]
                    .as_array_mut()
                    .cloned()
                    .unwrap_or_default();
                let mut found = false;
                let mut updated = suggestions.clone();
                for s in updated.iter_mut() {
                    if s["suggestion_id"].as_str() == Some(&input.suggestion_id) {
                        s["status"] = json!("accepted");
                        found = true;
                    }
                }
                if !found {
                    return Ok(ProgressiveSchemaAcceptSuggestionOutput::Notfound {
                        message: format!("Suggestion \"{}\" not found", input.suggestion_id),
                    });
                }
                record["detected_structure"] = json!(updated);
                record["formality"] = json!("typed_properties");
                storage
                    .put("progressive_item", &input.item_id, record)
                    .await?;
                Ok(ProgressiveSchemaAcceptSuggestionOutput::Ok)
            }
        }
    }

    pub async fn reject_suggestion(
        &self,
        input: ProgressiveSchemaRejectSuggestionInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProgressiveSchemaRejectSuggestionOutput> {
        let existing = storage.get("progressive_item", &input.item_id).await?;
        match existing {
            None => Ok(ProgressiveSchemaRejectSuggestionOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
            Some(mut record) => {
                let suggestions = record["detected_structure"]
                    .as_array_mut()
                    .cloned()
                    .unwrap_or_default();
                let mut found = false;
                let mut updated = suggestions.clone();
                for s in updated.iter_mut() {
                    if s["suggestion_id"].as_str() == Some(&input.suggestion_id) {
                        s["status"] = json!("rejected");
                        found = true;
                    }
                }
                if !found {
                    return Ok(ProgressiveSchemaRejectSuggestionOutput::Notfound {
                        message: format!("Suggestion \"{}\" not found", input.suggestion_id),
                    });
                }
                record["detected_structure"] = json!(updated);
                storage
                    .put("progressive_item", &input.item_id, record)
                    .await?;
                Ok(ProgressiveSchemaRejectSuggestionOutput::Ok)
            }
        }
    }

    pub async fn promote(
        &self,
        input: ProgressiveSchemaPromoteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProgressiveSchemaPromoteOutput> {
        let existing = storage.get("progressive_item", &input.item_id).await?;
        match existing {
            None => Ok(ProgressiveSchemaPromoteOutput::Notfound {
                message: format!("Item \"{}\" not found", input.item_id),
            }),
            Some(mut record) => {
                let suggestions = record["detected_structure"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();
                let accepted_count = suggestions
                    .iter()
                    .filter(|s| s["status"].as_str() == Some("accepted"))
                    .count();

                let mut history = record["promotion_history"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();
                history.push(json!({
                    "from": record["formality"],
                    "to": "schema_conformant",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }));

                record["schema"] = json!(input.target_schema);
                record["formality"] = json!("schema_conformant");
                record["promotion_history"] = json!(history);
                storage
                    .put("progressive_item", &input.item_id, record)
                    .await?;

                Ok(ProgressiveSchemaPromoteOutput::Ok {
                    result: json!({"schema": input.target_schema, "fields": accepted_count}).to_string(),
                })
            }
        }
    }

    pub async fn infer_schema(
        &self,
        input: ProgressiveSchemaInferSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProgressiveSchemaInferSchemaOutput> {
        let item_ids: Vec<String> = input
            .items
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        if item_ids.is_empty() {
            return Ok(ProgressiveSchemaInferSchemaOutput::Error {
                message: "No items provided".into(),
            });
        }

        let mut field_counts: std::collections::HashMap<String, (String, usize)> =
            std::collections::HashMap::new();

        for id in &item_ids {
            if let Some(item) = storage.get("progressive_item", id).await? {
                let suggestions = item["detected_structure"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();
                for s in &suggestions {
                    if s["status"].as_str() == Some("accepted") {
                        let field = s["field"].as_str().unwrap_or("").to_string();
                        let ftype = s["type"].as_str().unwrap_or("string").to_string();
                        let entry = field_counts.entry(field).or_insert((ftype, 0));
                        entry.1 += 1;
                    }
                }
            }
        }

        let threshold = (item_ids.len() as f64 * 0.5) as usize;
        let proposed_fields: Vec<_> = field_counts
            .iter()
            .filter(|(_, (_, count))| *count >= threshold)
            .map(|(name, (ftype, _))| json!({"name": name, "type": ftype}))
            .collect();

        Ok(ProgressiveSchemaInferSchemaOutput::Ok {
            proposed_schema: json!({"fields": proposed_fields}).to_string(),
        })
    }
}
