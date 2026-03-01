// Interactor -- classifies field types into abstract interaction categories for widget selection.
// Categories: selection, edit, control, output, navigation, composition.
// Scoring considers data type, cardinality, mutability, and intent matching.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::InteractorHandler;
use serde_json::json;

pub struct InteractorHandlerImpl;

const VALID_CATEGORIES: &[&str] = &["selection", "edit", "control", "output", "navigation", "composition"];

#[async_trait]
impl InteractorHandler for InteractorHandlerImpl {
    async fn define(
        &self,
        input: InteractorDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorDefineOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("interactor", &input.interactor).await?;
        if existing.is_some() {
            return Ok(InteractorDefineOutput::Duplicate {
                message: "An interactor with this identity already exists".to_string(),
            });
        }

        if !VALID_CATEGORIES.contains(&input.category.as_str()) {
            return Ok(InteractorDefineOutput::Duplicate {
                message: format!(
                    "Invalid category \"{}\". Must be one of: {}",
                    input.category,
                    VALID_CATEGORIES.join(", ")
                ),
            });
        }

        let parsed_props: serde_json::Value = serde_json::from_str(&input.properties)
            .unwrap_or_else(|_| json!({}));

        let normalized_props = json!({
            "dataType": parsed_props.get("dataType").and_then(|v| v.as_str()).unwrap_or("string"),
            "cardinality": parsed_props.get("cardinality").and_then(|v| v.as_str()).unwrap_or("one"),
            "optionCount": parsed_props.get("optionCount"),
            "optionSource": parsed_props.get("optionSource"),
            "domain": parsed_props.get("domain"),
            "comparison": parsed_props.get("comparison"),
            "mutable": parsed_props.get("mutable").and_then(|v| v.as_bool()).unwrap_or(true),
            "multiLine": parsed_props.get("multiLine").and_then(|v| v.as_bool()).unwrap_or(false),
        });

        storage.put("interactor", &input.interactor, json!({
            "interactor": input.interactor,
            "name": input.name,
            "category": input.category,
            "properties": serde_json::to_string(&normalized_props)?,
        })).await?;

        Ok(InteractorDefineOutput::Ok {
            interactor: input.interactor,
        })
    }

    async fn classify(
        &self,
        input: InteractorClassifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorClassifyOutput, Box<dyn std::error::Error>> {
        let all_interactors = storage.find("interactor", None).await?;

        let constraints: serde_json::Value = input.constraints.as_deref()
            .and_then(|c| serde_json::from_str(c).ok())
            .unwrap_or_else(|| json!({}));

        let mut candidates: Vec<(String, f64)> = Vec::new();

        for entry in &all_interactors {
            let props_str = entry.get("properties").and_then(|v| v.as_str()).unwrap_or("{}");
            let props: serde_json::Value = serde_json::from_str(props_str).unwrap_or_else(|_| json!({}));

            let mut confidence: f64 = 0.0;

            // Score based on data type match
            if props.get("dataType").and_then(|v| v.as_str()) == Some(&input.field_type) {
                confidence += 0.4;
            }

            // Score based on cardinality match
            if let Some(c) = constraints.get("cardinality").and_then(|v| v.as_str()) {
                if props.get("cardinality").and_then(|v| v.as_str()) == Some(c) {
                    confidence += 0.2;
                }
            }

            // Score based on mutability match
            if let Some(m) = constraints.get("mutable").and_then(|v| v.as_bool()) {
                if props.get("mutable").and_then(|v| v.as_bool()) == Some(m) {
                    confidence += 0.1;
                }
            }

            // Score based on intent match against category
            if let Some(ref intent) = input.intent {
                let category = entry.get("category").and_then(|v| v.as_str()).unwrap_or("");
                if category == intent {
                    confidence += 0.3;
                }
            }

            if confidence > 0.0 {
                let interactor_id = entry.get("interactor")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                candidates.push((interactor_id, confidence.min(1.0)));
            }
        }

        if candidates.is_empty() {
            return Ok(InteractorClassifyOutput::Ambiguous {
                interactor: input.interactor,
                candidates: "[]".to_string(),
            });
        }

        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // If top candidate is clearly ahead, return it
        if candidates.len() == 1 || candidates[0].1 > candidates[1].1 + 0.1 {
            return Ok(InteractorClassifyOutput::Ok {
                interactor: candidates[0].0.clone(),
                confidence: candidates[0].1,
            });
        }

        let candidates_json: Vec<serde_json::Value> = candidates.iter()
            .map(|(id, conf)| json!({ "interactor": id, "confidence": conf }))
            .collect();

        Ok(InteractorClassifyOutput::Ambiguous {
            interactor: input.interactor,
            candidates: serde_json::to_string(&candidates_json)?,
        })
    }

    async fn get(
        &self,
        input: InteractorGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorGetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("interactor", &input.interactor).await?;
        match existing {
            Some(record) => Ok(InteractorGetOutput::Ok {
                interactor: input.interactor,
                name: record.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                category: record.get("category").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                properties: record.get("properties").and_then(|v| v.as_str()).unwrap_or("{}").to_string(),
            }),
            None => Ok(InteractorGetOutput::Notfound {
                message: "Interactor not found".to_string(),
            }),
        }
    }

    async fn list(
        &self,
        input: InteractorListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorListOutput, Box<dyn std::error::Error>> {
        let all_interactors = storage.find("interactor", None).await?;

        let filtered: Vec<serde_json::Value> = all_interactors.into_iter()
            .filter(|entry| {
                if let Some(ref category) = input.category {
                    entry.get("category").and_then(|v| v.as_str()) == Some(category.as_str())
                } else {
                    true
                }
            })
            .map(|entry| {
                json!({
                    "interactor": entry.get("interactor").and_then(|v| v.as_str()).unwrap_or(""),
                    "name": entry.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                    "category": entry.get("category").and_then(|v| v.as_str()).unwrap_or(""),
                })
            })
            .collect();

        Ok(InteractorListOutput::Ok {
            interactors: serde_json::to_string(&filtered)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_success() {
        let storage = InMemoryStorage::new();
        let handler = InteractorHandlerImpl;
        let result = handler.define(
            InteractorDefineInput {
                interactor: "text-input".to_string(),
                name: "Text Input".to_string(),
                category: "edit".to_string(),
                properties: r#"{"dataType": "string", "mutable": true}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InteractorDefineOutput::Ok { interactor } => {
                assert_eq!(interactor, "text-input");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = InteractorHandlerImpl;
        handler.define(
            InteractorDefineInput {
                interactor: "text-input".to_string(),
                name: "Text Input".to_string(),
                category: "edit".to_string(),
                properties: r#"{}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.define(
            InteractorDefineInput {
                interactor: "text-input".to_string(),
                name: "Text Input 2".to_string(),
                category: "edit".to_string(),
                properties: r#"{}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InteractorDefineOutput::Duplicate { message } => {
                assert!(message.contains("already exists"));
            },
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_define_invalid_category() {
        let storage = InMemoryStorage::new();
        let handler = InteractorHandlerImpl;
        let result = handler.define(
            InteractorDefineInput {
                interactor: "bad-cat".to_string(),
                name: "Bad Category".to_string(),
                category: "invalid-category".to_string(),
                properties: r#"{}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InteractorDefineOutput::Duplicate { message } => {
                assert!(message.contains("Invalid category"));
            },
            _ => panic!("Expected Duplicate variant for invalid category"),
        }
    }

    #[tokio::test]
    async fn test_classify_ambiguous_no_interactors() {
        let storage = InMemoryStorage::new();
        let handler = InteractorHandlerImpl;
        let result = handler.classify(
            InteractorClassifyInput {
                interactor: "test".to_string(),
                field_type: "string".to_string(),
                constraints: None,
                intent: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            InteractorClassifyOutput::Ambiguous { .. } => {},
            _ => panic!("Expected Ambiguous variant"),
        }
    }

    #[tokio::test]
    async fn test_get_success() {
        let storage = InMemoryStorage::new();
        let handler = InteractorHandlerImpl;
        handler.define(
            InteractorDefineInput {
                interactor: "select-box".to_string(),
                name: "Select Box".to_string(),
                category: "selection".to_string(),
                properties: r#"{"dataType": "string"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            InteractorGetInput { interactor: "select-box".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InteractorGetOutput::Ok { interactor, name, category, .. } => {
                assert_eq!(interactor, "select-box");
                assert_eq!(name, "Select Box");
                assert_eq!(category, "selection");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_notfound() {
        let storage = InMemoryStorage::new();
        let handler = InteractorHandlerImpl;
        let result = handler.get(
            InteractorGetInput { interactor: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InteractorGetOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_list_empty() {
        let storage = InMemoryStorage::new();
        let handler = InteractorHandlerImpl;
        let result = handler.list(
            InteractorListInput { category: None },
            &storage,
        ).await.unwrap();
        match result {
            InteractorListOutput::Ok { interactors } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&interactors).unwrap();
                assert!(parsed.is_empty());
            },
        }
    }
}
