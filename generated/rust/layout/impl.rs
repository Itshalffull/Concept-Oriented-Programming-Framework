// Layout implementation
// Manages UI layout creation, configuration, nesting, responsive
// breakpoints, and removal. Detects cycles in layout nesting.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::LayoutHandler;
use serde_json::json;

pub struct LayoutHandlerImpl;

/// Check if adding child under parent would create a cycle.
async fn would_create_cycle(
    storage: &dyn ConceptStorage,
    parent: &str,
    child: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    // Walk up from parent to see if we reach child
    let mut current = parent.to_string();
    let mut visited = std::collections::HashSet::new();

    while !current.is_empty() {
        if current == child {
            return Ok(true);
        }
        if visited.contains(&current) {
            break;
        }
        visited.insert(current.clone());

        match storage.get("layout", &current).await? {
            Some(record) => {
                current = record.get("parent")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
            }
            None => break,
        }
    }

    Ok(false)
}

#[async_trait]
impl LayoutHandler for LayoutHandlerImpl {
    async fn create(
        &self,
        input: LayoutCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutCreateOutput, Box<dyn std::error::Error>> {
        let valid_kinds = ["stack", "grid", "flex", "absolute", "scroll", "split"];
        if !valid_kinds.contains(&input.kind.as_str()) {
            return Ok(LayoutCreateOutput::Invalid {
                message: format!("Invalid layout kind '{}'. Must be one of: {:?}", input.kind, valid_kinds),
            });
        }

        storage.put("layout", &input.layout, json!({
            "layout": input.layout,
            "name": input.name,
            "kind": input.kind,
            "config": "{}",
            "parent": "",
            "children": "[]",
            "breakpoints": "{}",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(LayoutCreateOutput::Ok { layout: input.layout })
    }

    async fn configure(
        &self,
        input: LayoutConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutConfigureOutput, Box<dyn std::error::Error>> {
        match storage.get("layout", &input.layout).await? {
            Some(record) => {
                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("config".into(), json!(input.config));
                }
                storage.put("layout", &input.layout, updated).await?;
                Ok(LayoutConfigureOutput::Ok { layout: input.layout })
            }
            None => Ok(LayoutConfigureOutput::Notfound {
                message: format!("Layout '{}' not found", input.layout),
            }),
        }
    }

    async fn nest(
        &self,
        input: LayoutNestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutNestOutput, Box<dyn std::error::Error>> {
        // Check for cycle
        if would_create_cycle(storage, &input.parent, &input.child).await? {
            return Ok(LayoutNestOutput::Cycle {
                message: format!(
                    "Nesting '{}' under '{}' would create a cycle",
                    input.child, input.parent
                ),
            });
        }

        // Update child's parent
        if let Some(child_record) = storage.get("layout", &input.child).await? {
            let mut updated = child_record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("parent".into(), json!(input.parent));
            }
            storage.put("layout", &input.child, updated).await?;
        }

        // Add child to parent's children list
        if let Some(parent_record) = storage.get("layout", &input.parent).await? {
            let mut children: Vec<String> = parent_record
                .get("children")
                .and_then(|v| v.as_str())
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();

            if !children.contains(&input.child) {
                children.push(input.child);
            }

            let mut updated = parent_record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("children".into(), json!(serde_json::to_string(&children)?));
            }
            storage.put("layout", &input.parent, updated).await?;
        }

        Ok(LayoutNestOutput::Ok { parent: input.parent })
    }

    async fn set_responsive(
        &self,
        input: LayoutSetResponsiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutSetResponsiveOutput, Box<dyn std::error::Error>> {
        match storage.get("layout", &input.layout).await? {
            Some(record) => {
                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("breakpoints".into(), json!(input.breakpoints));
                }
                storage.put("layout", &input.layout, updated).await?;
                Ok(LayoutSetResponsiveOutput::Ok { layout: input.layout })
            }
            None => Ok(LayoutSetResponsiveOutput::Notfound {
                message: format!("Layout '{}' not found", input.layout),
            }),
        }
    }

    async fn remove(
        &self,
        input: LayoutRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutRemoveOutput, Box<dyn std::error::Error>> {
        match storage.get("layout", &input.layout).await? {
            Some(_) => {
                storage.del("layout", &input.layout).await?;
                Ok(LayoutRemoveOutput::Ok { layout: input.layout })
            }
            None => Ok(LayoutRemoveOutput::Notfound {
                message: format!("Layout '{}' not found", input.layout),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_valid_layout() {
        let storage = InMemoryStorage::new();
        let handler = LayoutHandlerImpl;
        let result = handler.create(
            LayoutCreateInput { layout: "main".into(), name: "Main Layout".into(), kind: "grid".into() },
            &storage,
        ).await.unwrap();
        match result {
            LayoutCreateOutput::Ok { layout } => assert_eq!(layout, "main"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_invalid_kind() {
        let storage = InMemoryStorage::new();
        let handler = LayoutHandlerImpl;
        let result = handler.create(
            LayoutCreateInput { layout: "l1".into(), name: "L1".into(), kind: "banana".into() },
            &storage,
        ).await.unwrap();
        match result {
            LayoutCreateOutput::Invalid { message } => assert!(message.contains("Invalid")),
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_configure_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LayoutHandlerImpl;
        let result = handler.configure(
            LayoutConfigureInput { layout: "nonexistent".into(), config: "{}".into() },
            &storage,
        ).await.unwrap();
        match result {
            LayoutConfigureOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_nest_success() {
        let storage = InMemoryStorage::new();
        let handler = LayoutHandlerImpl;
        handler.create(LayoutCreateInput { layout: "parent".into(), name: "P".into(), kind: "stack".into() }, &storage).await.unwrap();
        handler.create(LayoutCreateInput { layout: "child".into(), name: "C".into(), kind: "flex".into() }, &storage).await.unwrap();
        let result = handler.nest(
            LayoutNestInput { parent: "parent".into(), child: "child".into() },
            &storage,
        ).await.unwrap();
        match result {
            LayoutNestOutput::Ok { parent } => assert_eq!(parent, "parent"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_set_responsive_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LayoutHandlerImpl;
        let result = handler.set_responsive(
            LayoutSetResponsiveInput { layout: "nope".into(), breakpoints: "{}".into() },
            &storage,
        ).await.unwrap();
        match result {
            LayoutSetResponsiveOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_success() {
        let storage = InMemoryStorage::new();
        let handler = LayoutHandlerImpl;
        handler.create(LayoutCreateInput { layout: "rm-me".into(), name: "R".into(), kind: "grid".into() }, &storage).await.unwrap();
        let result = handler.remove(
            LayoutRemoveInput { layout: "rm-me".into() },
            &storage,
        ).await.unwrap();
        match result {
            LayoutRemoveOutput::Ok { layout } => assert_eq!(layout, "rm-me"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LayoutHandlerImpl;
        let result = handler.remove(
            LayoutRemoveInput { layout: "missing".into() },
            &storage,
        ).await.unwrap();
        match result {
            LayoutRemoveOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
