// ProgressiveSchema -- captures freeform content and progressively detects
// structure through suggestion-based refinement, promoting items from
// freeform to typed properties to full schema conformance.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProgressiveSchemaHandler;
use serde_json::json;

pub struct ProgressiveSchemaHandlerImpl;

#[async_trait]
impl ProgressiveSchemaHandler for ProgressiveSchemaHandlerImpl {
    async fn capture_freeform(
        &self,
        input: ProgressiveSchemaCaptureFreeformInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaCaptureFreeformOutput, Box<dyn std::error::Error>> {
        let item_id = format!("ps-{}", chrono::Utc::now().timestamp_millis());

        storage.put("progressiveItem", &item_id, json!({
            "itemId": item_id,
            "content": input.content,
            "formality": "freeform",
            "detectedStructure": [],
            "schema": null,
            "promotionHistory": [],
        })).await?;

        Ok(ProgressiveSchemaCaptureFreeformOutput::Ok { item_id })
    }

    async fn detect_structure(
        &self,
        input: ProgressiveSchemaDetectStructureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaDetectStructureOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("progressiveItem", &input.item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ProgressiveSchemaDetectStructureOutput::Notfound {
                    message: format!("Item \"{}\" not found", input.item_id),
                });
            }
        };

        let content = record["content"].as_str().unwrap_or("");
        let mut suggestions: Vec<serde_json::Value> = Vec::new();
        let mut sug_idx = 0;

        // Date detection: YYYY-MM-DD
        let date_re = regex::Regex::new(r"\b(\d{4}-\d{2}-\d{2})\b").unwrap();
        for cap in date_re.captures_iter(content) {
            sug_idx += 1;
            suggestions.push(json!({
                "suggestionId": format!("sug-{}", sug_idx),
                "detectorId": "date_detector",
                "field": "date",
                "value": &cap[1],
                "type": "date",
                "confidence": 0.95,
                "status": "pending",
            }));
        }

        // Tag detection: #tag-name
        let tag_re = regex::Regex::new(r"#([\w-]+)").unwrap();
        for cap in tag_re.captures_iter(content) {
            sug_idx += 1;
            suggestions.push(json!({
                "suggestionId": format!("sug-{}", sug_idx),
                "detectorId": "tag_detector",
                "field": "tag",
                "value": &cap[1],
                "type": "tag",
                "confidence": 0.9,
                "status": "pending",
            }));
        }

        // URL detection
        let url_re = regex::Regex::new(r"https?://[^\s]+").unwrap();
        for mat in url_re.find_iter(content) {
            sug_idx += 1;
            suggestions.push(json!({
                "suggestionId": format!("sug-{}", sug_idx),
                "detectorId": "url_detector",
                "field": "url",
                "value": mat.as_str(),
                "type": "url",
                "confidence": 0.99,
                "status": "pending",
            }));
        }

        // Key:value detection
        let kv_re = regex::Regex::new(r"(?m)^(\w[\w\s]*?):\s+(.+)$").unwrap();
        for cap in kv_re.captures_iter(content) {
            sug_idx += 1;
            let field = cap[1].trim().to_lowercase().replace(' ', "_");
            suggestions.push(json!({
                "suggestionId": format!("sug-{}", sug_idx),
                "detectorId": "kv_detector",
                "field": field,
                "value": cap[2].trim(),
                "type": "string",
                "confidence": 0.7,
                "status": "pending",
            }));
        }

        let formality = if suggestions.is_empty() {
            record["formality"].as_str().unwrap_or("freeform")
        } else {
            "inline_metadata"
        };

        let mut updated = record.clone();
        updated["detectedStructure"] = json!(suggestions);
        updated["formality"] = json!(formality);
        storage.put("progressiveItem", &input.item_id, updated).await?;

        Ok(ProgressiveSchemaDetectStructureOutput::Ok {
            suggestions: serde_json::to_string(&suggestions)?,
        })
    }

    async fn accept_suggestion(
        &self,
        input: ProgressiveSchemaAcceptSuggestionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaAcceptSuggestionOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("progressiveItem", &input.item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ProgressiveSchemaAcceptSuggestionOutput::Notfound {
                    message: format!("Item \"{}\" not found", input.item_id),
                });
            }
        };

        let mut suggestions = record["detectedStructure"].as_array().cloned().unwrap_or_default();
        let found = suggestions.iter_mut().find(|s| {
            s["suggestionId"].as_str() == Some(&input.suggestion_id)
        });

        match found {
            Some(suggestion) => {
                suggestion["status"] = json!("accepted");
            }
            None => {
                return Ok(ProgressiveSchemaAcceptSuggestionOutput::Notfound {
                    message: format!("Suggestion \"{}\" not found", input.suggestion_id),
                });
            }
        }

        let has_accepted = suggestions.iter().any(|s| s["status"].as_str() == Some("accepted"));
        let formality = if has_accepted { "typed_properties" } else {
            record["formality"].as_str().unwrap_or("freeform")
        };

        let mut updated = record.clone();
        updated["detectedStructure"] = json!(suggestions);
        updated["formality"] = json!(formality);
        storage.put("progressiveItem", &input.item_id, updated).await?;

        Ok(ProgressiveSchemaAcceptSuggestionOutput::Ok)
    }

    async fn reject_suggestion(
        &self,
        input: ProgressiveSchemaRejectSuggestionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaRejectSuggestionOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("progressiveItem", &input.item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ProgressiveSchemaRejectSuggestionOutput::Notfound {
                    message: format!("Item \"{}\" not found", input.item_id),
                });
            }
        };

        let mut suggestions = record["detectedStructure"].as_array().cloned().unwrap_or_default();
        let found = suggestions.iter_mut().find(|s| {
            s["suggestionId"].as_str() == Some(&input.suggestion_id)
        });

        match found {
            Some(suggestion) => {
                suggestion["status"] = json!("rejected");
            }
            None => {
                return Ok(ProgressiveSchemaRejectSuggestionOutput::Notfound {
                    message: format!("Suggestion \"{}\" not found", input.suggestion_id),
                });
            }
        }

        let mut updated = record.clone();
        updated["detectedStructure"] = json!(suggestions);
        storage.put("progressiveItem", &input.item_id, updated).await?;

        Ok(ProgressiveSchemaRejectSuggestionOutput::Ok)
    }

    async fn promote(
        &self,
        input: ProgressiveSchemaPromoteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaPromoteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("progressiveItem", &input.item_id).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ProgressiveSchemaPromoteOutput::Notfound {
                    message: format!("Item \"{}\" not found", input.item_id),
                });
            }
        };

        let suggestions = record["detectedStructure"].as_array().cloned().unwrap_or_default();
        let accepted_count = suggestions.iter()
            .filter(|s| s["status"].as_str() == Some("accepted"))
            .count();

        let mut history = record["promotionHistory"].as_array().cloned().unwrap_or_default();
        let from_formality = record["formality"].as_str().unwrap_or("freeform").to_string();
        history.push(json!({
            "from": from_formality,
            "to": "schema_conformant",
        }));

        let mut updated = record.clone();
        updated["schema"] = json!(input.target_schema);
        updated["formality"] = json!("schema_conformant");
        updated["promotionHistory"] = json!(history);
        storage.put("progressiveItem", &input.item_id, updated).await?;

        let result = json!({
            "schema": input.target_schema,
            "fields": accepted_count,
        });

        Ok(ProgressiveSchemaPromoteOutput::Ok {
            result: serde_json::to_string(&result)?,
        })
    }

    async fn infer_schema(
        &self,
        input: ProgressiveSchemaInferSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaInferSchemaOutput, Box<dyn std::error::Error>> {
        let item_ids: Vec<String> = serde_json::from_str(&input.items)
            .unwrap_or_else(|_| {
                input.items.split(',').map(|id| id.trim().to_string()).collect()
            });

        if item_ids.is_empty() {
            return Ok(ProgressiveSchemaInferSchemaOutput::Error {
                message: "No items provided for schema inference".to_string(),
            });
        }

        // Collect all accepted suggestions across items to find common fields
        let mut field_counts: std::collections::HashMap<String, (String, usize)> =
            std::collections::HashMap::new();

        for id in &item_ids {
            let item = storage.get("progressiveItem", id).await?;
            if let Some(record) = item {
                let suggestions = record["detectedStructure"].as_array().cloned().unwrap_or_default();
                for s in &suggestions {
                    if s["status"].as_str() == Some("accepted") {
                        let field = s["field"].as_str().unwrap_or("").to_string();
                        let field_type = s["type"].as_str().unwrap_or("string").to_string();
                        let entry = field_counts.entry(field).or_insert((field_type, 0));
                        entry.1 += 1;
                    }
                }
            }
        }

        let threshold = (item_ids.len() as f64 * 0.5) as usize;
        let proposed_fields: Vec<serde_json::Value> = field_counts
            .iter()
            .filter(|(_, (_, count))| *count >= threshold)
            .map(|(name, (field_type, _))| json!({"name": name, "type": field_type}))
            .collect();

        Ok(ProgressiveSchemaInferSchemaOutput::Ok {
            proposed_schema: json!({"fields": proposed_fields}).to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_capture_freeform() {
        let storage = InMemoryStorage::new();
        let handler = ProgressiveSchemaHandlerImpl;
        let result = handler.capture_freeform(
            ProgressiveSchemaCaptureFreeformInput { content: "Some freeform text".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProgressiveSchemaCaptureFreeformOutput::Ok { item_id } => {
                assert!(!item_id.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_detect_structure_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProgressiveSchemaHandlerImpl;
        let result = handler.detect_structure(
            ProgressiveSchemaDetectStructureInput { item_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProgressiveSchemaDetectStructureOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_accept_suggestion_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProgressiveSchemaHandlerImpl;
        let result = handler.accept_suggestion(
            ProgressiveSchemaAcceptSuggestionInput {
                item_id: "nonexistent".to_string(),
                suggestion_id: "sug-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProgressiveSchemaAcceptSuggestionOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_reject_suggestion_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProgressiveSchemaHandlerImpl;
        let result = handler.reject_suggestion(
            ProgressiveSchemaRejectSuggestionInput {
                item_id: "nonexistent".to_string(),
                suggestion_id: "sug-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProgressiveSchemaRejectSuggestionOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_promote_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProgressiveSchemaHandlerImpl;
        let result = handler.promote(
            ProgressiveSchemaPromoteInput {
                item_id: "nonexistent".to_string(),
                target_schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProgressiveSchemaPromoteOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_infer_schema_empty() {
        let storage = InMemoryStorage::new();
        let handler = ProgressiveSchemaHandlerImpl;
        let result = handler.infer_schema(
            ProgressiveSchemaInferSchemaInput { items: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProgressiveSchemaInferSchemaOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }
}
