// WidgetPropEntity Handler Implementation
//
// A declared prop on a widget -- typed, with default value,
// connected to anatomy parts and ultimately to concept state
// fields via Binding. Enables tracing from concept fields through
// props to rendered anatomy parts.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetPropEntityHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("widget-prop-entity-{}", n)
}

pub struct WidgetPropEntityHandlerImpl;

#[async_trait]
impl WidgetPropEntityHandler for WidgetPropEntityHandlerImpl {
    async fn register(
        &self,
        input: WidgetPropEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityRegisterOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;
        let name = &input.name;
        let type_expr = &input.type_expr;
        let default_value = &input.default_value;

        let id = next_id();
        let symbol = format!("clef/prop/{}/{}", widget, name);

        storage.put("widget-prop-entity", &id, json!({
            "id": id,
            "widget": widget,
            "name": name,
            "symbol": symbol,
            "typeExpr": type_expr,
            "defaultValue": default_value,
            "connectedParts": "[]"
        })).await?;

        Ok(WidgetPropEntityRegisterOutput::Ok { prop: id })
    }

    async fn find_by_widget(
        &self,
        input: WidgetPropEntityFindByWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityFindByWidgetOutput, Box<dyn std::error::Error>> {
        let results = storage.find("widget-prop-entity", json!({ "widget": input.widget })).await?;

        Ok(WidgetPropEntityFindByWidgetOutput::Ok {
            props: serde_json::to_string(&results)?,
        })
    }

    async fn trace_to_field(
        &self,
        input: WidgetPropEntityTraceToFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityTraceToFieldOutput, Box<dyn std::error::Error>> {
        let prop_id = &input.prop;

        let record = storage.get("widget-prop-entity", prop_id).await?;
        if record.is_null() {
            return Ok(WidgetPropEntityTraceToFieldOutput::NoBinding);
        }

        let symbol = record.get("symbol")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Look up bindings that connect this prop to a concept field
        let bindings = storage.find("binding", json!({ "propSymbol": symbol })).await?;
        let bindings_arr = bindings.as_array().cloned().unwrap_or_default();

        if bindings_arr.is_empty() {
            return Ok(WidgetPropEntityTraceToFieldOutput::NoBinding);
        }

        let binding = &bindings_arr[0];
        let field = binding.get("fieldSymbol")
            .or_else(|| binding.get("field"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let concept = binding.get("concept")
            .or_else(|| binding.get("conceptName"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let via_binding = binding.get("id")
            .or_else(|| binding.get("bindingId"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(WidgetPropEntityTraceToFieldOutput::Ok {
            field,
            concept,
            via_binding,
        })
    }

    async fn get(
        &self,
        input: WidgetPropEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityGetOutput, Box<dyn std::error::Error>> {
        let prop_id = &input.prop;

        let record = storage.get("widget-prop-entity", prop_id).await?;
        if record.is_null() {
            return Ok(WidgetPropEntityGetOutput::Notfound);
        }

        Ok(WidgetPropEntityGetOutput::Ok {
            prop: record.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            widget: record.get("widget").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: record.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            type_expr: record.get("typeExpr").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            default_value: record.get("defaultValue").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetPropEntityHandlerImpl;
        let result = handler.register(
            WidgetPropEntityRegisterInput {
                widget: "Button".to_string(),
                name: "label".to_string(),
                type_expr: "string".to_string(),
                default_value: "\"Click\"".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetPropEntityRegisterOutput::Ok { prop } => {
                assert!(!prop.is_empty());
                assert!(prop.contains("widget-prop-entity"));
            },
        }
    }

    #[tokio::test]
    async fn test_get_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetPropEntityHandlerImpl;
        let reg = handler.register(
            WidgetPropEntityRegisterInput {
                widget: "Button".to_string(),
                name: "label".to_string(),
                type_expr: "string".to_string(),
                default_value: "\"Click\"".to_string(),
            },
            &storage,
        ).await.unwrap();
        let prop_id = match reg {
            WidgetPropEntityRegisterOutput::Ok { prop } => prop,
        };
        let result = handler.get(
            WidgetPropEntityGetInput { prop: prop_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetPropEntityGetOutput::Ok { prop, widget, name, type_expr, .. } => {
                assert_eq!(prop, prop_id);
                assert_eq!(widget, "Button");
                assert_eq!(name, "label");
                assert_eq!(type_expr, "string");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WidgetPropEntityHandlerImpl;
        let result = handler.get(
            WidgetPropEntityGetInput { prop: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetPropEntityGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_trace_to_field_no_binding() {
        let storage = InMemoryStorage::new();
        let handler = WidgetPropEntityHandlerImpl;
        let reg = handler.register(
            WidgetPropEntityRegisterInput {
                widget: "Button".to_string(),
                name: "label".to_string(),
                type_expr: "string".to_string(),
                default_value: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        let prop_id = match reg {
            WidgetPropEntityRegisterOutput::Ok { prop } => prop,
        };
        let result = handler.trace_to_field(
            WidgetPropEntityTraceToFieldInput { prop: prop_id },
            &storage,
        ).await.unwrap();
        match result {
            WidgetPropEntityTraceToFieldOutput::NoBinding => {},
            _ => panic!("Expected NoBinding variant"),
        }
    }
}
