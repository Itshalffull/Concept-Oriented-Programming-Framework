// Widget handler implementation
// Catalog of registered UI component definitions with AST representations
// and category organization.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetHandler;
use serde_json::{json, Value};

pub struct WidgetHandlerImpl;

#[async_trait]
impl WidgetHandler for WidgetHandlerImpl {
    async fn register(
        &self,
        input: WidgetRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetRegisterOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;
        let name = &input.name;
        let ast = &input.ast;
        let category = &input.category;

        let existing = storage.get("widget", widget).await?;
        if existing.is_some() {
            return Ok(WidgetRegisterOutput::Duplicate {
                message: "A widget with this identity already exists".to_string(),
            });
        }

        // Validate the AST is parseable JSON
        if serde_json::from_str::<Value>(ast).is_err() {
            return Ok(WidgetRegisterOutput::Invalid {
                message: "Widget AST must be valid JSON".to_string(),
            });
        }

        let cat = if category.is_empty() { "general" } else { category.as_str() };

        storage.put("widget", widget, json!({
            "widget": widget,
            "name": name,
            "category": cat,
            "ast": ast,
            "version": 1,
        })).await?;

        Ok(WidgetRegisterOutput::Ok { widget: widget.clone() })
    }

    async fn get(
        &self,
        input: WidgetGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetGetOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;

        let existing = storage.get("widget", widget).await?;
        match existing {
            Some(rec) => Ok(WidgetGetOutput::Ok {
                widget: widget.clone(),
                ast: rec.get("ast").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                name: rec.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }),
            None => Ok(WidgetGetOutput::Notfound {
                message: "Widget not found".to_string(),
            }),
        }
    }

    async fn list(
        &self,
        input: WidgetListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetListOutput, Box<dyn std::error::Error>> {
        let category = input.category.as_deref();

        let results = storage.find("widget", None).await?;

        let filtered: Vec<&Value> = if let Some(cat) = category {
            results.iter()
                .filter(|w| w.get("category").and_then(|v| v.as_str()) == Some(cat))
                .collect()
        } else {
            results.iter().collect()
        };

        let widgets: Vec<Value> = filtered.iter().map(|w| {
            json!({
                "widget": w.get("widget").and_then(|v| v.as_str()).unwrap_or(""),
                "name": w.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "category": w.get("category").and_then(|v| v.as_str()).unwrap_or(""),
                "version": w.get("version").and_then(|v| v.as_i64()).unwrap_or(0),
            })
        }).collect();

        Ok(WidgetListOutput::Ok {
            widgets: serde_json::to_string(&widgets)?,
        })
    }

    async fn unregister(
        &self,
        input: WidgetUnregisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetUnregisterOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;

        let existing = storage.get("widget", widget).await?;
        if existing.is_none() {
            return Ok(WidgetUnregisterOutput::Notfound {
                message: "Widget not found".to_string(),
            });
        }

        storage.put("widget", widget, json!({"__deleted": true})).await?;

        Ok(WidgetUnregisterOutput::Ok { widget: widget.clone() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetHandlerImpl;
        let result = handler.register(
            WidgetRegisterInput {
                widget: "btn-1".to_string(),
                name: "Button".to_string(),
                ast: r#"{"type":"button","children":[]}"#.to_string(),
                category: "interaction".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetRegisterOutput::Ok { widget } => {
                assert_eq!(widget, "btn-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = WidgetHandlerImpl;
        handler.register(
            WidgetRegisterInput {
                widget: "btn-1".to_string(),
                name: "Button".to_string(),
                ast: r#"{"type":"button"}"#.to_string(),
                category: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            WidgetRegisterInput {
                widget: "btn-1".to_string(),
                name: "Button".to_string(),
                ast: r#"{"type":"button"}"#.to_string(),
                category: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetRegisterOutput::Duplicate { .. } => {},
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_register_invalid_ast() {
        let storage = InMemoryStorage::new();
        let handler = WidgetHandlerImpl;
        let result = handler.register(
            WidgetRegisterInput {
                widget: "btn-1".to_string(),
                name: "Button".to_string(),
                ast: "not-json".to_string(),
                category: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetRegisterOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_get_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetHandlerImpl;
        handler.register(
            WidgetRegisterInput {
                widget: "btn-1".to_string(),
                name: "Button".to_string(),
                ast: r#"{"type":"button"}"#.to_string(),
                category: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            WidgetGetInput { widget: "btn-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetGetOutput::Ok { widget, name, .. } => {
                assert_eq!(widget, "btn-1");
                assert_eq!(name, "Button");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WidgetHandlerImpl;
        let result = handler.get(
            WidgetGetInput { widget: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetGetOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_unregister_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WidgetHandlerImpl;
        let result = handler.unregister(
            WidgetUnregisterInput { widget: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetUnregisterOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_list_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetHandlerImpl;
        let result = handler.list(
            WidgetListInput { category: None },
            &storage,
        ).await.unwrap();
        match result {
            WidgetListOutput::Ok { .. } => {},
        }
    }
}
