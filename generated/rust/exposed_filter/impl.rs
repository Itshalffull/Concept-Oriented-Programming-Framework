// ExposedFilter -- interactive filter and sort controls for end users,
// allowing them to modify query parameters through the UI.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ExposedFilterHandler;
use serde_json::json;

pub struct ExposedFilterHandlerImpl;

#[async_trait]
impl ExposedFilterHandler for ExposedFilterHandlerImpl {
    async fn expose(
        &self,
        input: ExposedFilterExposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterExposeOutput, Box<dyn std::error::Error>> {
        // Check if filter already exists
        let existing = storage.get("exposedFilter", &input.filter).await?;
        if existing.is_some() {
            return Ok(ExposedFilterExposeOutput::Exists {
                filter: input.filter,
            });
        }

        storage.put("exposedFilter", &input.filter, json!({
            "filter": input.filter,
            "fieldName": input.field_name,
            "operator": input.operator,
            "defaultValue": input.default_value,
            "userInput": input.default_value,
        })).await?;

        Ok(ExposedFilterExposeOutput::Ok {
            filter: input.filter,
        })
    }

    async fn collect_input(
        &self,
        input: ExposedFilterCollectInputInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterCollectInputOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("exposedFilter", &input.filter).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ExposedFilterCollectInputOutput::Notfound {
                    filter: input.filter,
                });
            }
        };

        let mut updated = record.clone();
        updated["userInput"] = json!(input.value);
        storage.put("exposedFilter", &input.filter, updated).await?;

        Ok(ExposedFilterCollectInputOutput::Ok {
            filter: input.filter,
        })
    }

    async fn apply_to_query(
        &self,
        input: ExposedFilterApplyToQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterApplyToQueryOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("exposedFilter", &input.filter).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ExposedFilterApplyToQueryOutput::Notfound {
                    filter: input.filter,
                });
            }
        };

        let field_name = record["fieldName"].as_str().unwrap_or("");
        let operator = record["operator"].as_str().unwrap_or("");
        let user_input = record["userInput"].as_str().unwrap_or("");

        let query_mod = format!("{} {} '{}'", field_name, operator, user_input);

        Ok(ExposedFilterApplyToQueryOutput::Ok { query_mod })
    }

    async fn reset_to_defaults(
        &self,
        input: ExposedFilterResetToDefaultsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterResetToDefaultsOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("exposedFilter", &input.filter).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(ExposedFilterResetToDefaultsOutput::Notfound {
                    filter: input.filter,
                });
            }
        };

        let default_value = record["defaultValue"].as_str().unwrap_or("").to_string();
        let mut updated = record.clone();
        updated["userInput"] = json!(default_value);
        storage.put("exposedFilter", &input.filter, updated).await?;

        Ok(ExposedFilterResetToDefaultsOutput::Ok {
            filter: input.filter,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_expose_success() {
        let storage = InMemoryStorage::new();
        let handler = ExposedFilterHandlerImpl;
        let result = handler.expose(
            ExposedFilterExposeInput {
                filter: "status-filter".to_string(),
                field_name: "status".to_string(),
                operator: "=".to_string(),
                default_value: "active".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExposedFilterExposeOutput::Ok { filter } => {
                assert_eq!(filter, "status-filter");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_expose_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = ExposedFilterHandlerImpl;
        handler.expose(
            ExposedFilterExposeInput {
                filter: "f1".to_string(),
                field_name: "status".to_string(),
                operator: "=".to_string(),
                default_value: "active".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.expose(
            ExposedFilterExposeInput {
                filter: "f1".to_string(),
                field_name: "status".to_string(),
                operator: "=".to_string(),
                default_value: "active".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExposedFilterExposeOutput::Exists { filter } => {
                assert_eq!(filter, "f1");
            },
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_collect_input_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ExposedFilterHandlerImpl;
        let result = handler.collect_input(
            ExposedFilterCollectInputInput {
                filter: "nonexistent".to_string(),
                value: "test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExposedFilterCollectInputOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_to_query_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ExposedFilterHandlerImpl;
        let result = handler.apply_to_query(
            ExposedFilterApplyToQueryInput {
                filter: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExposedFilterApplyToQueryOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_reset_to_defaults_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ExposedFilterHandlerImpl;
        let result = handler.reset_to_defaults(
            ExposedFilterResetToDefaultsInput {
                filter: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExposedFilterResetToDefaultsOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_to_query_success() {
        let storage = InMemoryStorage::new();
        let handler = ExposedFilterHandlerImpl;
        handler.expose(
            ExposedFilterExposeInput {
                filter: "f1".to_string(),
                field_name: "status".to_string(),
                operator: "=".to_string(),
                default_value: "active".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.apply_to_query(
            ExposedFilterApplyToQueryInput {
                filter: "f1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ExposedFilterApplyToQueryOutput::Ok { query_mod } => {
                assert!(query_mod.contains("status"));
                assert!(query_mod.contains("active"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
