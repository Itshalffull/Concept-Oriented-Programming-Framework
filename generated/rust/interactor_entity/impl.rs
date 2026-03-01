// InteractorEntity -- persistent entity layer for interactor registrations.
// Stores interactors, provides category-based lookup, widget matching,
// field classification, and coverage reporting.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::InteractorEntityHandler;
use serde_json::json;

pub struct InteractorEntityHandlerImpl;

#[async_trait]
impl InteractorEntityHandler for InteractorEntityHandlerImpl {
    async fn register(
        &self,
        input: InteractorEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityRegisterOutput, Box<dyn std::error::Error>> {
        let entity_id = format!("ie-{}", input.name.to_lowercase().replace(' ', "-"));

        storage.put("interactor-entity", &entity_id, json!({
            "entityId": entity_id,
            "name": input.name,
            "category": input.category,
            "properties": input.properties,
            "registeredAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(InteractorEntityRegisterOutput::Ok {
            entity: entity_id,
        })
    }

    async fn find_by_category(
        &self,
        input: InteractorEntityFindByCategoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityFindByCategoryOutput, Box<dyn std::error::Error>> {
        let all_entities = storage.find("interactor-entity", None).await?;

        let filtered: Vec<serde_json::Value> = all_entities.into_iter()
            .filter(|entity| {
                entity.get("category").and_then(|v| v.as_str()) == Some(&input.category)
            })
            .map(|entity| {
                json!({
                    "entityId": entity.get("entityId").and_then(|v| v.as_str()).unwrap_or(""),
                    "name": entity.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                    "category": entity.get("category").and_then(|v| v.as_str()).unwrap_or(""),
                })
            })
            .collect();

        Ok(InteractorEntityFindByCategoryOutput::Ok {
            interactors: serde_json::to_string(&filtered)?,
        })
    }

    async fn matching_widgets(
        &self,
        input: InteractorEntityMatchingWidgetsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityMatchingWidgetsOutput, Box<dyn std::error::Error>> {
        let entity = storage.get("interactor-entity", &input.interactor).await?;

        let category = entity.as_ref()
            .and_then(|e| e.get("category").and_then(|v| v.as_str()))
            .unwrap_or("");
        let properties_str = entity.as_ref()
            .and_then(|e| e.get("properties").and_then(|v| v.as_str()))
            .unwrap_or("{}");

        let context: serde_json::Value = serde_json::from_str(&input.context)
            .unwrap_or_else(|_| json!({}));

        // Look up widget affordances that match this interactor's category
        let affordances = storage.find("affordance", Some(&json!({
            "category": category,
        }))).await?;

        let widgets: Vec<serde_json::Value> = affordances.iter()
            .map(|aff| {
                json!({
                    "widget": aff.get("widget").and_then(|v| v.as_str()).unwrap_or(""),
                    "category": category,
                    "score": aff.get("specificity").and_then(|v| v.as_f64()).unwrap_or(0.5),
                })
            })
            .collect();

        Ok(InteractorEntityMatchingWidgetsOutput::Ok {
            widgets: serde_json::to_string(&widgets)?,
        })
    }

    async fn classified_fields(
        &self,
        input: InteractorEntityClassifiedFieldsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityClassifiedFieldsOutput, Box<dyn std::error::Error>> {
        let entity = storage.get("interactor-entity", &input.interactor).await?;

        let properties_str = entity.as_ref()
            .and_then(|e| e.get("properties").and_then(|v| v.as_str()))
            .unwrap_or("{}");

        let properties: serde_json::Value = serde_json::from_str(properties_str)
            .unwrap_or_else(|_| json!({}));

        // Classify each property field
        let mut fields = Vec::new();
        if let Some(obj) = properties.as_object() {
            for (key, value) in obj {
                let field_type = match value {
                    serde_json::Value::String(_) => "text",
                    serde_json::Value::Number(_) => "numeric",
                    serde_json::Value::Bool(_) => "boolean",
                    serde_json::Value::Array(_) => "collection",
                    serde_json::Value::Object(_) => "composite",
                    _ => "unknown",
                };
                fields.push(json!({
                    "field": key,
                    "type": field_type,
                    "classification": field_type,
                }));
            }
        }

        Ok(InteractorEntityClassifiedFieldsOutput::Ok {
            fields: serde_json::to_string(&fields)?,
        })
    }

    async fn coverage_report(
        &self,
        _input: InteractorEntityCoverageReportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityCoverageReportOutput, Box<dyn std::error::Error>> {
        let all_entities = storage.find("interactor-entity", None).await?;

        let categories = ["selection", "edit", "control", "output", "navigation", "composition"];
        let mut coverage = serde_json::Map::new();

        for category in &categories {
            let count = all_entities.iter()
                .filter(|e| e.get("category").and_then(|v| v.as_str()) == Some(category))
                .count();
            coverage.insert(category.to_string(), json!(count));
        }

        let total = all_entities.len();
        let categories_with_entries = coverage.values()
            .filter(|v| v.as_u64().unwrap_or(0) > 0)
            .count();

        let report = json!({
            "total": total,
            "categoryCoverage": coverage,
            "coveredCategories": categories_with_entries,
            "totalCategories": categories.len(),
            "coveragePercent": if categories.len() > 0 {
                (categories_with_entries as f64 / categories.len() as f64) * 100.0
            } else {
                0.0
            },
        });

        Ok(InteractorEntityCoverageReportOutput::Ok {
            report: serde_json::to_string(&report)?,
        })
    }

    async fn get(
        &self,
        input: InteractorEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityGetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("interactor-entity", &input.interactor).await?;
        match existing {
            Some(record) => Ok(InteractorEntityGetOutput::Ok {
                interactor: input.interactor,
                name: record.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                category: record.get("category").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                properties: record.get("properties").and_then(|v| v.as_str()).unwrap_or("{}").to_string(),
            }),
            None => Ok(InteractorEntityGetOutput::Notfound),
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
        let handler = InteractorEntityHandlerImpl;
        let result = handler.register(
            InteractorEntityRegisterInput {
                name: "Text Input".to_string(),
                category: "edit".to_string(),
                properties: r#"{"dataType": "string"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityRegisterOutput::Ok { entity } => {
                assert!(!entity.is_empty());
                assert!(entity.starts_with("ie-"));
            },
        }
    }

    #[tokio::test]
    async fn test_find_by_category_empty() {
        let storage = InMemoryStorage::new();
        let handler = InteractorEntityHandlerImpl;
        let result = handler.find_by_category(
            InteractorEntityFindByCategoryInput { category: "selection".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityFindByCategoryOutput::Ok { interactors } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&interactors).unwrap();
                assert!(parsed.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_register_then_find_by_category() {
        let storage = InMemoryStorage::new();
        let handler = InteractorEntityHandlerImpl;
        handler.register(
            InteractorEntityRegisterInput {
                name: "Dropdown".to_string(),
                category: "selection".to_string(),
                properties: r#"{}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.register(
            InteractorEntityRegisterInput {
                name: "Checkbox".to_string(),
                category: "control".to_string(),
                properties: r#"{}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.find_by_category(
            InteractorEntityFindByCategoryInput { category: "selection".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityFindByCategoryOutput::Ok { interactors } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&interactors).unwrap();
                assert_eq!(parsed.len(), 1);
            },
        }
    }

    #[tokio::test]
    async fn test_matching_widgets() {
        let storage = InMemoryStorage::new();
        let handler = InteractorEntityHandlerImpl;
        handler.register(
            InteractorEntityRegisterInput {
                name: "Text Field".to_string(),
                category: "edit".to_string(),
                properties: r#"{"dataType": "string"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.matching_widgets(
            InteractorEntityMatchingWidgetsInput {
                interactor: "ie-text-field".to_string(),
                context: r#"{}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityMatchingWidgetsOutput::Ok { widgets } => {
                assert!(!widgets.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_classified_fields() {
        let storage = InMemoryStorage::new();
        let handler = InteractorEntityHandlerImpl;
        handler.register(
            InteractorEntityRegisterInput {
                name: "Rich Editor".to_string(),
                category: "edit".to_string(),
                properties: r#"{"dataType": "string", "maxLength": 500, "multiLine": true}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.classified_fields(
            InteractorEntityClassifiedFieldsInput {
                interactor: "ie-rich-editor".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityClassifiedFieldsOutput::Ok { fields } => {
                assert!(!fields.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_coverage_report_empty() {
        let storage = InMemoryStorage::new();
        let handler = InteractorEntityHandlerImpl;
        let result = handler.coverage_report(
            InteractorEntityCoverageReportInput {},
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityCoverageReportOutput::Ok { report } => {
                let parsed: serde_json::Value = serde_json::from_str(&report).unwrap();
                assert_eq!(parsed["total"].as_u64().unwrap(), 0);
            },
        }
    }

    #[tokio::test]
    async fn test_get_success() {
        let storage = InMemoryStorage::new();
        let handler = InteractorEntityHandlerImpl;
        handler.register(
            InteractorEntityRegisterInput {
                name: "Toggle".to_string(),
                category: "control".to_string(),
                properties: r#"{"dataType": "boolean"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            InteractorEntityGetInput { interactor: "ie-toggle".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityGetOutput::Ok { name, category, .. } => {
                assert_eq!(name, "Toggle");
                assert_eq!(category, "control");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_notfound() {
        let storage = InMemoryStorage::new();
        let handler = InteractorEntityHandlerImpl;
        let result = handler.get(
            InteractorEntityGetInput { interactor: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            InteractorEntityGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
