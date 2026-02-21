// Namespace Concept Implementation (Rust)
//
// Manages hierarchical namespaced pages with path-based creation.
// See Architecture doc Sections on namespace hierarchy.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── CreateNamespacedPage ──────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNamespacedPageInput {
    pub full_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateNamespacedPageOutput {
    #[serde(rename = "ok")]
    Ok { page_id: String, parent_id: String },
}

// ── GetChildren ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetChildrenInput {
    pub page_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetChildrenOutput {
    #[serde(rename = "ok")]
    Ok { page_id: String, children: String },
}

// ── GetHierarchy ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetHierarchyInput {
    pub page_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetHierarchyOutput {
    #[serde(rename = "ok")]
    Ok { page_id: String, ancestors: String },
}

// ── MovePage ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovePageInput {
    pub page_id: String,
    pub new_parent_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum MovePageOutput {
    #[serde(rename = "ok")]
    Ok { page_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct NamespaceHandler;

impl NamespaceHandler {
    pub async fn create_namespaced_page(
        &self,
        input: CreateNamespacedPageInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateNamespacedPageOutput> {
        let segments: Vec<&str> = input
            .full_path
            .split('/')
            .filter(|s| !s.is_empty())
            .collect();

        let mut parent_id = "root".to_string();

        // Create each segment in the path, ensuring parents exist
        for (i, _segment) in segments.iter().enumerate() {
            let path = segments[..=i].join("/");
            let page_id = format!("ns_{}", path.replace('/', "_"));

            let existing = storage.get("namespace_page", &page_id).await?;
            if existing.is_none() {
                storage
                    .put(
                        "namespace_page",
                        &page_id,
                        json!({
                            "page_id": page_id,
                            "path": path,
                            "parent_id": parent_id,
                            "children": [],
                        }),
                    )
                    .await?;

                // Update parent's children list
                let parent = storage.get("namespace_page", &parent_id).await?;
                if let Some(mut p) = parent {
                    let children = p["children"].as_array_mut();
                    if let Some(arr) = children {
                        if !arr.iter().any(|v| v.as_str() == Some(&page_id)) {
                            arr.push(json!(page_id));
                        }
                    }
                    storage.put("namespace_page", &parent_id, p).await?;
                }
            }

            parent_id = page_id;
        }

        let leaf_path = segments.join("/");
        let leaf_id = format!("ns_{}", leaf_path.replace('/', "_"));
        let leaf_parent = if segments.len() > 1 {
            let parent_path = segments[..segments.len() - 1].join("/");
            format!("ns_{}", parent_path.replace('/', "_"))
        } else {
            "root".to_string()
        };

        Ok(CreateNamespacedPageOutput::Ok {
            page_id: leaf_id,
            parent_id: leaf_parent,
        })
    }

    pub async fn get_children(
        &self,
        input: GetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetChildrenOutput> {
        let page = storage.get("namespace_page", &input.page_id).await?;

        let children: Vec<String> = match page {
            Some(record) => record["children"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            None => vec![],
        };

        Ok(GetChildrenOutput::Ok {
            page_id: input.page_id,
            children: serde_json::to_string(&children)?,
        })
    }

    pub async fn get_hierarchy(
        &self,
        input: GetHierarchyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetHierarchyOutput> {
        let mut ancestors: Vec<String> = vec![];
        let mut current_id = input.page_id.clone();

        loop {
            let page = storage.get("namespace_page", &current_id).await?;
            match page {
                Some(record) => {
                    let parent_id = record["parent_id"]
                        .as_str()
                        .unwrap_or("root")
                        .to_string();
                    if parent_id == "root" {
                        break;
                    }
                    ancestors.push(parent_id.clone());
                    current_id = parent_id;
                }
                None => break,
            }
        }

        ancestors.reverse();

        Ok(GetHierarchyOutput::Ok {
            page_id: input.page_id,
            ancestors: serde_json::to_string(&ancestors)?,
        })
    }

    pub async fn move_page(
        &self,
        input: MovePageInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<MovePageOutput> {
        let existing = storage.get("namespace_page", &input.page_id).await?;

        match existing {
            None => Ok(MovePageOutput::NotFound {
                message: format!("Page '{}' not found", input.page_id),
            }),
            Some(mut page) => {
                let new_parent_id = format!(
                    "ns_{}",
                    input.new_parent_path.replace('/', "_")
                );

                // Remove from old parent's children
                let old_parent_id = page["parent_id"]
                    .as_str()
                    .unwrap_or("root")
                    .to_string();
                let old_parent = storage.get("namespace_page", &old_parent_id).await?;
                if let Some(mut op) = old_parent {
                    if let Some(arr) = op["children"].as_array_mut() {
                        arr.retain(|v| v.as_str() != Some(&input.page_id));
                    }
                    storage.put("namespace_page", &old_parent_id, op).await?;
                }

                // Update page's parent
                page["parent_id"] = json!(new_parent_id);
                storage.put("namespace_page", &input.page_id, page).await?;

                // Add to new parent's children
                let new_parent = storage.get("namespace_page", &new_parent_id).await?;
                if let Some(mut np) = new_parent {
                    if let Some(arr) = np["children"].as_array_mut() {
                        if !arr.iter().any(|v| v.as_str() == Some(&input.page_id)) {
                            arr.push(json!(input.page_id));
                        }
                    }
                    storage.put("namespace_page", &new_parent_id, np).await?;
                }

                Ok(MovePageOutput::Ok {
                    page_id: input.page_id,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn create_namespaced_page_single_segment() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandler;
        let result = handler
            .create_namespaced_page(
                CreateNamespacedPageInput { full_path: "docs".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            CreateNamespacedPageOutput::Ok { page_id, parent_id } => {
                assert_eq!(page_id, "ns_docs");
                assert_eq!(parent_id, "root");
            }
        }
    }

    #[tokio::test]
    async fn create_namespaced_page_nested() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandler;
        let result = handler
            .create_namespaced_page(
                CreateNamespacedPageInput { full_path: "docs/api/reference".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            CreateNamespacedPageOutput::Ok { page_id, parent_id } => {
                assert_eq!(page_id, "ns_docs_api_reference");
                assert_eq!(parent_id, "ns_docs_api");
            }
        }
    }

    #[tokio::test]
    async fn get_children_after_creation() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandler;
        handler
            .create_namespaced_page(
                CreateNamespacedPageInput { full_path: "docs/api".into() },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_children(GetChildrenInput { page_id: "ns_docs".into() }, &storage)
            .await
            .unwrap();
        match result {
            GetChildrenOutput::Ok { page_id, children } => {
                assert_eq!(page_id, "ns_docs");
                let parsed: Vec<String> = serde_json::from_str(&children).unwrap();
                assert!(parsed.contains(&"ns_docs_api".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn get_children_empty() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandler;
        let result = handler
            .get_children(GetChildrenInput { page_id: "nonexistent".into() }, &storage)
            .await
            .unwrap();
        match result {
            GetChildrenOutput::Ok { children, .. } => {
                let parsed: Vec<String> = serde_json::from_str(&children).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn get_hierarchy() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandler;
        handler
            .create_namespaced_page(
                CreateNamespacedPageInput { full_path: "docs/api/reference".into() },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_hierarchy(
                GetHierarchyInput { page_id: "ns_docs_api_reference".into() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            GetHierarchyOutput::Ok { page_id, ancestors } => {
                assert_eq!(page_id, "ns_docs_api_reference");
                let parsed: Vec<String> = serde_json::from_str(&ancestors).unwrap();
                assert!(parsed.contains(&"ns_docs".to_string()));
                assert!(parsed.contains(&"ns_docs_api".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn move_page_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandler;
        let result = handler
            .move_page(
                MovePageInput {
                    page_id: "nonexistent".into(),
                    new_parent_path: "other".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, MovePageOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn move_page_ok() {
        let storage = InMemoryStorage::new();
        let handler = NamespaceHandler;
        handler
            .create_namespaced_page(
                CreateNamespacedPageInput { full_path: "docs/old".into() },
                &storage,
            )
            .await
            .unwrap();
        handler
            .create_namespaced_page(
                CreateNamespacedPageInput { full_path: "archive".into() },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .move_page(
                MovePageInput {
                    page_id: "ns_docs_old".into(),
                    new_parent_path: "archive".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        match result {
            MovePageOutput::Ok { page_id } => assert_eq!(page_id, "ns_docs_old"),
            MovePageOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }
}
