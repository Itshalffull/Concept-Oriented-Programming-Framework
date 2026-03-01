// WidgetEntity Handler Implementation
//
// Queryable representation of a parsed widget spec -- the Clef Surface
// counterpart to ConceptEntity. Links anatomy, state machines,
// props, slots, accessibility contracts, affordance declarations,
// and composition references as a traversable structure.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetEntityHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("widget-entity-{}", n)
}

pub struct WidgetEntityHandlerImpl;

#[async_trait]
impl WidgetEntityHandler for WidgetEntityHandlerImpl {
    async fn register(
        &self,
        input: WidgetEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityRegisterOutput, Box<dyn std::error::Error>> {
        let name = &input.name;
        let source = &input.source;
        let ast = &input.ast;

        // Check for duplicate by name
        let existing = storage.find("widget-entity", json!({ "name": name })).await?;
        if let Some(arr) = existing.as_array() {
            if !arr.is_empty() {
                if let Some(id) = arr[0].get("id").and_then(|v| v.as_str()) {
                    return Ok(WidgetEntityRegisterOutput::AlreadyRegistered {
                        existing: id.to_string(),
                    });
                }
            }
        }

        let id = next_id();
        let symbol = format!("clef/widget/{}", name);

        // Extract metadata from AST
        let mut purpose_text = String::new();
        let mut version = 0i64;
        let mut category = String::new();
        let mut anatomy_parts = "[]".to_string();
        let mut states = "[]".to_string();
        let mut props = "[]".to_string();
        let mut slots = "[]".to_string();
        let mut composed_widgets = "[]".to_string();
        let mut affordances = "[]".to_string();
        let mut accessibility_role = String::new();
        let mut has_focus_trap = "false".to_string();
        let mut keyboard_bindings = "[]".to_string();

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(ast) {
            purpose_text = parsed.get("purpose").and_then(|v| v.as_str()).unwrap_or("").to_string();
            version = parsed.get("version").and_then(|v| v.as_i64()).unwrap_or(0);
            category = parsed.get("category").and_then(|v| v.as_str()).unwrap_or("").to_string();
            anatomy_parts = serde_json::to_string(&parsed.get("anatomy").unwrap_or(&json!([]))).unwrap_or("[]".to_string());
            states = serde_json::to_string(&parsed.get("states").unwrap_or(&json!([]))).unwrap_or("[]".to_string());
            props = serde_json::to_string(&parsed.get("props").unwrap_or(&json!([]))).unwrap_or("[]".to_string());
            slots = serde_json::to_string(&parsed.get("slots").unwrap_or(&json!([]))).unwrap_or("[]".to_string());
            composed_widgets = serde_json::to_string(
                &parsed.get("compose").or_else(|| parsed.get("composedWidgets")).unwrap_or(&json!([]))
            ).unwrap_or("[]".to_string());
            affordances = serde_json::to_string(&parsed.get("affordances").unwrap_or(&json!([]))).unwrap_or("[]".to_string());
            if let Some(a11y) = parsed.get("accessibility") {
                accessibility_role = a11y.get("role").and_then(|v| v.as_str()).unwrap_or("").to_string();
                has_focus_trap = if a11y.get("focusTrap").and_then(|v| v.as_bool()).unwrap_or(false) {
                    "true".to_string()
                } else {
                    "false".to_string()
                };
                keyboard_bindings = serde_json::to_string(
                    &a11y.get("keyboard").unwrap_or(&json!([]))
                ).unwrap_or("[]".to_string());
            }
        }

        storage.put("widget-entity", &id, json!({
            "id": id,
            "name": name,
            "symbol": symbol,
            "sourceFile": source,
            "ast": ast,
            "purposeText": purpose_text,
            "version": version,
            "category": category,
            "anatomyParts": anatomy_parts,
            "states": states,
            "props": props,
            "slots": slots,
            "composedWidgets": composed_widgets,
            "affordances": affordances,
            "accessibilityRole": accessibility_role,
            "hasFocusTrap": has_focus_trap,
            "keyboardBindings": keyboard_bindings
        })).await?;

        Ok(WidgetEntityRegisterOutput::Ok { entity: id })
    }

    async fn get(
        &self,
        input: WidgetEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityGetOutput, Box<dyn std::error::Error>> {
        let results = storage.find("widget-entity", json!({ "name": input.name })).await?;
        if let Some(arr) = results.as_array() {
            if !arr.is_empty() {
                if let Some(id) = arr[0].get("id").and_then(|v| v.as_str()) {
                    return Ok(WidgetEntityGetOutput::Ok {
                        entity: id.to_string(),
                    });
                }
            }
        }
        Ok(WidgetEntityGetOutput::Notfound)
    }

    async fn find_by_affordance(
        &self,
        input: WidgetEntityFindByAffordanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityFindByAffordanceOutput, Box<dyn std::error::Error>> {
        let interactor = &input.interactor;
        let all_widgets = storage.find("widget-entity", json!({})).await?;
        let mut matching = Vec::new();

        if let Some(arr) = all_widgets.as_array() {
            for w in arr {
                if let Some(aff_str) = w.get("affordances").and_then(|v| v.as_str()) {
                    if let Ok(affordances) = serde_json::from_str::<serde_json::Value>(aff_str) {
                        if let Some(aff_arr) = affordances.as_array() {
                            let has_match = aff_arr.iter().any(|a| {
                                if let Some(s) = a.as_str() {
                                    s == interactor
                                } else {
                                    a.get("interactor").and_then(|v| v.as_str()) == Some(interactor)
                                }
                            });
                            if has_match {
                                matching.push(w.clone());
                            }
                        }
                    }
                }
            }
        }

        Ok(WidgetEntityFindByAffordanceOutput::Ok {
            widgets: serde_json::to_string(&matching)?,
        })
    }

    async fn find_composing(
        &self,
        input: WidgetEntityFindComposingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityFindComposingOutput, Box<dyn std::error::Error>> {
        let widget_id = &input.widget;
        let record = storage.get("widget-entity", widget_id).await?;
        if record.is_null() {
            return Ok(WidgetEntityFindComposingOutput::Ok {
                parents: "[]".to_string(),
            });
        }

        let widget_name = record.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let all_widgets = storage.find("widget-entity", json!({})).await?;
        let mut parents = Vec::new();

        if let Some(arr) = all_widgets.as_array() {
            for w in arr {
                let w_id = w.get("id").and_then(|v| v.as_str()).unwrap_or("");
                if w_id == widget_id {
                    continue;
                }
                if let Some(comp_str) = w.get("composedWidgets").and_then(|v| v.as_str()) {
                    if let Ok(composed) = serde_json::from_str::<serde_json::Value>(comp_str) {
                        if let Some(comp_arr) = composed.as_array() {
                            let has_match = comp_arr.iter().any(|c| {
                                if let Some(s) = c.as_str() {
                                    s == widget_name
                                } else {
                                    c.get("name").and_then(|v| v.as_str()) == Some(widget_name)
                                }
                            });
                            if has_match {
                                parents.push(w.clone());
                            }
                        }
                    }
                }
            }
        }

        Ok(WidgetEntityFindComposingOutput::Ok {
            parents: serde_json::to_string(&parents)?,
        })
    }

    async fn find_composed_by(
        &self,
        input: WidgetEntityFindComposedByInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityFindComposedByOutput, Box<dyn std::error::Error>> {
        let widget_id = &input.widget;
        let record = storage.get("widget-entity", widget_id).await?;
        if record.is_null() {
            return Ok(WidgetEntityFindComposedByOutput::Ok {
                children: "[]".to_string(),
            });
        }

        let comp_str = record.get("composedWidgets")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        let composed: serde_json::Value = serde_json::from_str(comp_str).unwrap_or(json!([]));
        let mut children = Vec::new();

        if let Some(comp_arr) = composed.as_array() {
            for c in comp_arr {
                let child_name = if let Some(s) = c.as_str() {
                    s.to_string()
                } else {
                    c.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string()
                };
                if !child_name.is_empty() {
                    let found = storage.find("widget-entity", json!({ "name": child_name })).await?;
                    if let Some(arr) = found.as_array() {
                        if !arr.is_empty() {
                            children.push(arr[0].clone());
                        }
                    }
                }
            }
        }

        Ok(WidgetEntityFindComposedByOutput::Ok {
            children: serde_json::to_string(&children)?,
        })
    }

    async fn generated_components(
        &self,
        input: WidgetEntityGeneratedComponentsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityGeneratedComponentsOutput, Box<dyn std::error::Error>> {
        let widget_id = &input.widget;
        let record = storage.get("widget-entity", widget_id).await?;
        if record.is_null() {
            return Ok(WidgetEntityGeneratedComponentsOutput::Ok {
                components: "[]".to_string(),
            });
        }

        let symbol = record.get("symbol").and_then(|v| v.as_str()).unwrap_or("");
        let generated = storage.find("provenance", json!({ "sourceSymbol": symbol })).await?;
        let mut components = Vec::new();

        if let Some(arr) = generated.as_array() {
            for g in arr {
                let framework = g.get("framework")
                    .or_else(|| g.get("language"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("react");
                let file = g.get("targetFile")
                    .or_else(|| g.get("file"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                components.push(json!({
                    "framework": framework,
                    "file": file
                }));
            }
        }

        Ok(WidgetEntityGeneratedComponentsOutput::Ok {
            components: serde_json::to_string(&components)?,
        })
    }

    async fn accessibility_audit(
        &self,
        input: WidgetEntityAccessibilityAuditInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityAccessibilityAuditOutput, Box<dyn std::error::Error>> {
        let widget_id = &input.widget;
        let record = storage.get("widget-entity", widget_id).await?;
        if record.is_null() {
            return Ok(WidgetEntityAccessibilityAuditOutput::Ok {
                report: "{}".to_string(),
            });
        }

        let mut missing = Vec::new();

        // Check required accessibility properties
        let a11y_role = record.get("accessibilityRole")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if a11y_role.is_empty() {
            missing.push("role".to_string());
        }

        let kb_str = record.get("keyboardBindings")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        if let Ok(keyboard) = serde_json::from_str::<serde_json::Value>(kb_str) {
            if let Some(arr) = keyboard.as_array() {
                if arr.is_empty() {
                    missing.push("keyboard-bindings".to_string());
                }
            } else {
                missing.push("keyboard-bindings".to_string());
            }
        } else {
            missing.push("keyboard-bindings".to_string());
        }

        // Check anatomy parts for ARIA attributes
        let widget_name = record.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let parts = storage.find("anatomy-part-entity", json!({ "widget": widget_name })).await?;
        let parts_arr = parts.as_array().cloned().unwrap_or_default();
        let parts_with_aria = parts_arr.iter().filter(|p| {
            if let Some(aria_str) = p.get("ariaAttrs").and_then(|v| v.as_str()) {
                if let Ok(aria) = serde_json::from_str::<serde_json::Value>(aria_str) {
                    if let Some(arr) = aria.as_array() {
                        return !arr.is_empty();
                    }
                }
            }
            false
        }).count();

        if !parts_arr.is_empty() && parts_with_aria == 0 {
            missing.push("aria-attributes".to_string());
        }

        if !missing.is_empty() {
            return Ok(WidgetEntityAccessibilityAuditOutput::Incomplete {
                missing: serde_json::to_string(&missing)?,
            });
        }

        let has_focus_trap = record.get("hasFocusTrap")
            .and_then(|v| v.as_str())
            .unwrap_or("false") == "true";

        Ok(WidgetEntityAccessibilityAuditOutput::Ok {
            report: serde_json::to_string(&json!({
                "role": a11y_role,
                "hasFocusTrap": has_focus_trap,
                "keyboardBindings": serde_json::from_str::<serde_json::Value>(kb_str).unwrap_or(json!([])),
                "partsWithAria": parts_with_aria,
                "totalParts": parts_arr.len()
            }))?,
        })
    }

    async fn trace_to_concept(
        &self,
        input: WidgetEntityTraceToConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityTraceToConceptOutput, Box<dyn std::error::Error>> {
        let widget_id = &input.widget;
        let record = storage.get("widget-entity", widget_id).await?;
        if record.is_null() {
            return Ok(WidgetEntityTraceToConceptOutput::NoConceptBinding);
        }

        let symbol = record.get("symbol").and_then(|v| v.as_str()).unwrap_or("");

        // Look up bindings from this widget to concepts
        let bindings = storage.find("binding", json!({ "widgetSymbol": symbol })).await?;
        let bindings_arr = bindings.as_array().cloned().unwrap_or_default();

        if bindings_arr.is_empty() {
            // Check via affordance matching
            let aff_str = record.get("affordances")
                .and_then(|v| v.as_str())
                .unwrap_or("[]");
            if let Ok(affordances) = serde_json::from_str::<serde_json::Value>(aff_str) {
                if let Some(aff_arr) = affordances.as_array() {
                    if aff_arr.is_empty() {
                        return Ok(WidgetEntityTraceToConceptOutput::NoConceptBinding);
                    }
                    let concepts: Vec<serde_json::Value> = aff_arr.iter().map(|a| {
                        let concept = if let Some(obj) = a.as_object() {
                            obj.get("concept").and_then(|v| v.as_str()).unwrap_or("unknown")
                        } else {
                            "unknown"
                        };
                        json!({ "concept": concept, "via": "affordance" })
                    }).collect();
                    return Ok(WidgetEntityTraceToConceptOutput::Ok {
                        concepts: serde_json::to_string(&concepts)?,
                    });
                }
            }
            return Ok(WidgetEntityTraceToConceptOutput::NoConceptBinding);
        }

        let concepts: Vec<serde_json::Value> = bindings_arr.iter().map(|b| {
            let concept = b.get("concept")
                .or_else(|| b.get("conceptName"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let via = b.get("bindingType")
                .and_then(|v| v.as_str())
                .unwrap_or("direct");
            json!({ "concept": concept, "via": via })
        }).collect();

        Ok(WidgetEntityTraceToConceptOutput::Ok {
            concepts: serde_json::to_string(&concepts)?,
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
        let handler = WidgetEntityHandlerImpl;
        let result = handler.register(
            WidgetEntityRegisterInput {
                name: "Button".to_string(),
                source: "button.widget".to_string(),
                ast: r#"{"purpose":"click target","version":1,"category":"interaction"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetEntityRegisterOutput::Ok { entity } => {
                assert!(!entity.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = WidgetEntityHandlerImpl;
        let result = handler.get(
            WidgetEntityGetInput { name: "Nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetEntityGetOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_find_by_affordance() {
        let storage = InMemoryStorage::new();
        let handler = WidgetEntityHandlerImpl;
        let result = handler.find_by_affordance(
            WidgetEntityFindByAffordanceInput {
                interactor: "click".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetEntityFindByAffordanceOutput::Ok { widgets } => {
                // Should return empty list when no widgets are registered
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&widgets).unwrap_or_default();
                assert!(parsed.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_trace_to_concept_no_binding() {
        let storage = InMemoryStorage::new();
        let handler = WidgetEntityHandlerImpl;
        let result = handler.trace_to_concept(
            WidgetEntityTraceToConceptInput {
                widget: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetEntityTraceToConceptOutput::NoConceptBinding => {},
            _ => panic!("Expected NoConceptBinding variant"),
        }
    }
}
