// Namespace -- hierarchical page organization with slash-delimited paths.
// Supports creating namespaced pages, retrieving children, hierarchy traversal, and moves.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::NamespaceHandler;
use serde_json::json;

pub struct NamespaceHandlerImpl;

#[async_trait]
impl NamespaceHandler for NamespaceHandlerImpl {
    async fn create_namespaced_page(
        &self,
        input: NamespaceCreateNamespacedPageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceCreateNamespacedPageOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("namespace", &input.path).await?;
        if existing.is_some() {
            return Ok(NamespaceCreateNamespacedPageOutput::Exists {
                message: format!("Page already exists at path '{}'", input.path),
            });
        }

        // Ensure parent path exists (or create intermediate nodes)
        let segments: Vec<&str> = input.path.trim_matches('/').split('/').collect();
        let mut current_path = String::new();
        for (i, segment) in segments.iter().enumerate() {
            if i > 0 {
                current_path.push('/');
            }
            current_path.push_str(segment);

            if i < segments.len() - 1 {
                // Create intermediate namespace node if it does not exist
                let intermediate = storage.get("namespace", &current_path).await?;
                if intermediate.is_none() {
                    storage.put("namespace", &current_path, json!({
                        "node": "",
                        "path": current_path,
                        "isIntermediate": true,
                    })).await?;
                }
            }
        }

        // Store the page at its full path
        storage.put("namespace", &input.path, json!({
            "node": input.node,
            "path": input.path,
            "isIntermediate": false,
        })).await?;

        Ok(NamespaceCreateNamespacedPageOutput::Ok)
    }

    async fn get_children(
        &self,
        input: NamespaceGetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceGetChildrenOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("namespace", &input.node).await?;
        if existing.is_none() {
            return Ok(NamespaceGetChildrenOutput::Notfound {
                message: format!("Namespace node '{}' not found", input.node),
            });
        }

        // Find all direct children (paths that start with node/ and have exactly one more segment)
        let all_pages = storage.find("namespace", None).await?;

        let prefix = if input.node.is_empty() {
            String::new()
        } else {
            format!("{}/", input.node)
        };

        let children: Vec<serde_json::Value> = all_pages.into_iter()
            .filter(|page| {
                let path = page.get("path").and_then(|v| v.as_str()).unwrap_or("");
                if prefix.is_empty() {
                    // Root children: paths with no slashes
                    !path.is_empty() && !path.contains('/')
                } else {
                    path.starts_with(&prefix) && !path[prefix.len()..].contains('/')
                }
            })
            .map(|page| {
                json!({
                    "node": page.get("node").and_then(|v| v.as_str()).unwrap_or(""),
                    "path": page.get("path").and_then(|v| v.as_str()).unwrap_or(""),
                })
            })
            .collect();

        Ok(NamespaceGetChildrenOutput::Ok {
            children: serde_json::to_string(&children)?,
        })
    }

    async fn get_hierarchy(
        &self,
        input: NamespaceGetHierarchyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceGetHierarchyOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("namespace", &input.node).await?;
        if existing.is_none() {
            return Ok(NamespaceGetHierarchyOutput::Notfound {
                message: format!("Namespace node '{}' not found", input.node),
            });
        }

        // Build hierarchy by walking up the path segments
        let segments: Vec<&str> = input.node.trim_matches('/').split('/').collect();
        let mut hierarchy = Vec::new();
        let mut current_path = String::new();

        for segment in &segments {
            if !current_path.is_empty() {
                current_path.push('/');
            }
            current_path.push_str(segment);

            let node = storage.get("namespace", &current_path).await?;
            hierarchy.push(json!({
                "path": current_path,
                "node": node.as_ref()
                    .and_then(|n| n.get("node").and_then(|v| v.as_str()))
                    .unwrap_or(""),
                "depth": hierarchy.len(),
            }));
        }

        Ok(NamespaceGetHierarchyOutput::Ok {
            hierarchy: serde_json::to_string(&hierarchy)?,
        })
    }

    async fn r#move(
        &self,
        input: NamespaceMoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NamespaceMoveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("namespace", &input.node).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NamespaceMoveOutput::Notfound {
                    message: format!("Namespace node '{}' not found", input.node),
                });
            }
        };

        // Remove from old path
        storage.del("namespace", &input.node).await?;

        // Store at new path
        let mut updated = record.clone();
        updated["path"] = json!(input.new_path);
        storage.put("namespace", &input.new_path, updated).await?;

        // Move all descendant pages
        let all_pages = storage.find("namespace", None).await?;
        let old_prefix = format!("{}/", input.node);

        for page in &all_pages {
            let path = page.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if path.starts_with(&old_prefix) {
                let relative = &path[old_prefix.len()..];
                let new_child_path = format!("{}/{}", input.new_path, relative);

                storage.del("namespace", path).await?;
                let mut child = page.clone();
                child["path"] = json!(new_child_path);
                storage.put("namespace", &new_child_path, child).await?;
            }
        }

        Ok(NamespaceMoveOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_namespaced_page() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandlerImpl;
        let result = handler.create_namespaced_page(
            NamespaceCreateNamespacedPageInput { node: "page-1".into(), path: "docs/api/page-1".into() },
            &storage,
        ).await.unwrap();
        match result {
            NamespaceCreateNamespacedPageOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_namespaced_page_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandlerImpl;
        handler.create_namespaced_page(
            NamespaceCreateNamespacedPageInput { node: "p1".into(), path: "docs/p1".into() },
            &storage,
        ).await.unwrap();
        let result = handler.create_namespaced_page(
            NamespaceCreateNamespacedPageInput { node: "p1".into(), path: "docs/p1".into() },
            &storage,
        ).await.unwrap();
        match result {
            NamespaceCreateNamespacedPageOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_get_children_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandlerImpl;
        let result = handler.get_children(
            NamespaceGetChildrenInput { node: "nonexistent".into() },
            &storage,
        ).await.unwrap();
        match result {
            NamespaceGetChildrenOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_hierarchy_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandlerImpl;
        let result = handler.get_hierarchy(
            NamespaceGetHierarchyInput { node: "missing".into() },
            &storage,
        ).await.unwrap();
        match result {
            NamespaceGetHierarchyOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_move_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandlerImpl;
        let result = handler.r#move(
            NamespaceMoveInput { node: "ghost".into(), new_path: "new/path".into() },
            &storage,
        ).await.unwrap();
        match result {
            NamespaceMoveOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_move_success() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandlerImpl;
        handler.create_namespaced_page(
            NamespaceCreateNamespacedPageInput { node: "p1".into(), path: "old/p1".into() },
            &storage,
        ).await.unwrap();
        let result = handler.r#move(
            NamespaceMoveInput { node: "old/p1".into(), new_path: "new/p1".into() },
            &storage,
        ).await.unwrap();
        match result {
            NamespaceMoveOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }
}
