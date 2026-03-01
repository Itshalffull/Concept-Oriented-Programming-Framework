// Element Handler Implementation
//
// UI elements with kind classification, nesting hierarchy,
// constraints, interactor attachment, and widget assignment.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ElementHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("E-{}", id)
}

const VALID_KINDS: &[&str] = &["field", "group", "layout", "action", "display", "container", "slot"];

pub struct ElementHandlerImpl;

#[async_trait]
impl ElementHandler for ElementHandlerImpl {
    async fn create(
        &self,
        input: ElementCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementCreateOutput, Box<dyn std::error::Error>> {
        if !VALID_KINDS.contains(&input.kind.as_str()) {
            return Ok(ElementCreateOutput::Invalid {
                message: format!("Invalid element kind \"{}\". Valid kinds: {}", input.kind, VALID_KINDS.join(", ")),
            });
        }

        let id = if input.element.is_empty() { next_id() } else { input.element };

        storage.put("element", &id, json!({
            "kind": input.kind,
            "label": input.label,
            "description": "",
            "dataType": input.data_type,
            "required": false,
            "constraints": "{}",
            "children": "[]",
            "parent": "",
            "interactorType": "",
            "interactorProps": "{}",
            "resolvedWidget": "",
        })).await?;

        Ok(ElementCreateOutput::Ok { element: id })
    }

    async fn nest(
        &self,
        input: ElementNestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementNestOutput, Box<dyn std::error::Error>> {
        let parent_el = storage.get("element", &input.parent).await?;
        let parent_el = match parent_el {
            Some(e) => e,
            None => return Ok(ElementNestOutput::Invalid {
                message: format!("Parent element \"{}\" not found", input.parent),
            }),
        };

        let child_el = storage.get("element", &input.child).await?;
        let child_el = match child_el {
            Some(e) => e,
            None => return Ok(ElementNestOutput::Invalid {
                message: format!("Child element \"{}\" not found", input.child),
            }),
        };

        // Prevent nesting into non-container kinds
        let parent_kind = parent_el.get("kind").and_then(|v| v.as_str()).unwrap_or("");
        if parent_kind == "field" || parent_kind == "action" {
            return Ok(ElementNestOutput::Invalid {
                message: format!("Cannot nest children into element of kind \"{}\"", parent_kind),
            });
        }

        if input.parent == input.child {
            return Ok(ElementNestOutput::Invalid {
                message: "Cannot nest an element into itself".to_string(),
            });
        }

        let children_str = parent_el.get("children").and_then(|v| v.as_str()).unwrap_or("[]");
        let mut children: Vec<String> = serde_json::from_str(children_str).unwrap_or_default();
        if !children.contains(&input.child) {
            children.push(input.child.clone());
        }

        let mut updated_parent = parent_el.clone();
        updated_parent["children"] = json!(serde_json::to_string(&children)?);
        storage.put("element", &input.parent, updated_parent).await?;

        let mut updated_child = child_el.clone();
        updated_child["parent"] = json!(input.parent);
        storage.put("element", &input.child, updated_child).await?;

        Ok(ElementNestOutput::Ok { parent: input.parent })
    }

    async fn set_constraints(
        &self,
        input: ElementSetConstraintsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementSetConstraintsOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("element", &input.element).await?;
        let existing = match existing {
            Some(e) => e,
            None => return Ok(ElementSetConstraintsOutput::Notfound {
                message: format!("Element \"{}\" not found", input.element),
            }),
        };

        let mut updated = existing.clone();
        updated["constraints"] = json!(input.constraints);
        storage.put("element", &input.element, updated).await?;

        Ok(ElementSetConstraintsOutput::Ok { element: input.element })
    }

    async fn enrich(
        &self,
        input: ElementEnrichInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementEnrichOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("element", &input.element).await?;
        let existing = match existing {
            Some(e) => e,
            None => return Ok(ElementEnrichOutput::Notfound {
                message: format!("Element \"{}\" not found", input.element),
            }),
        };

        let mut updated = existing.clone();
        updated["interactorType"] = json!(input.interactor_type);
        updated["interactorProps"] = json!(input.interactor_props);
        storage.put("element", &input.element, updated).await?;

        Ok(ElementEnrichOutput::Ok { element: input.element })
    }

    async fn assign_widget(
        &self,
        input: ElementAssignWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementAssignWidgetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("element", &input.element).await?;
        let existing = match existing {
            Some(e) => e,
            None => return Ok(ElementAssignWidgetOutput::Notfound {
                message: format!("Element \"{}\" not found", input.element),
            }),
        };

        let mut updated = existing.clone();
        updated["resolvedWidget"] = json!(input.widget);
        storage.put("element", &input.element, updated).await?;

        Ok(ElementAssignWidgetOutput::Ok { element: input.element })
    }

    async fn remove(
        &self,
        input: ElementRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementRemoveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("element", &input.element).await?;
        let existing = match existing {
            Some(e) => e,
            None => return Ok(ElementRemoveOutput::Notfound {
                message: format!("Element \"{}\" not found", input.element),
            }),
        };

        // Remove from parent's children list
        let parent_id = existing.get("parent").and_then(|v| v.as_str()).unwrap_or("");
        if !parent_id.is_empty() {
            if let Some(parent_el) = storage.get("element", parent_id).await? {
                let children_str = parent_el.get("children").and_then(|v| v.as_str()).unwrap_or("[]");
                let mut children: Vec<String> = serde_json::from_str(children_str).unwrap_or_default();
                children.retain(|c| c != &input.element);
                let mut updated_parent = parent_el.clone();
                updated_parent["children"] = json!(serde_json::to_string(&children)?);
                storage.put("element", parent_id, updated_parent).await?;
            }
        }

        let mut updated = existing.clone();
        updated["_deleted"] = json!(true);
        storage.put("element", &input.element, updated).await?;

        Ok(ElementRemoveOutput::Ok { element: input.element })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_field() {
        let storage = InMemoryStorage::new();
        let handler = ElementHandlerImpl;
        let result = handler.create(
            ElementCreateInput {
                element: "el-1".to_string(),
                kind: "field".to_string(),
                label: "Name".to_string(),
                data_type: "string".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElementCreateOutput::Ok { element } => {
                assert_eq!(element, "el-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_invalid_kind() {
        let storage = InMemoryStorage::new();
        let handler = ElementHandlerImpl;
        let result = handler.create(
            ElementCreateInput {
                element: "el-1".to_string(),
                kind: "invalid-kind".to_string(),
                label: "Name".to_string(),
                data_type: "string".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElementCreateOutput::Invalid { message } => {
                assert!(message.contains("Invalid element kind"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_nest_parent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ElementHandlerImpl;
        let result = handler.nest(
            ElementNestInput {
                parent: "missing".to_string(),
                child: "child".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElementNestOutput::Invalid { message } => {
                assert!(message.contains("not found"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_set_constraints_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ElementHandlerImpl;
        let result = handler.set_constraints(
            ElementSetConstraintsInput {
                element: "missing".to_string(),
                constraints: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElementSetConstraintsOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ElementHandlerImpl;
        let result = handler.remove(
            ElementRemoveInput {
                element: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElementRemoveOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
