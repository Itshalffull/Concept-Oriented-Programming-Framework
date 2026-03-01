// Outline concept implementation
// Hierarchical tree structure with indent/outdent, move, collapse/expand, and reparent operations.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::OutlineHandler;
use serde_json::json;

pub struct OutlineHandlerImpl;

#[async_trait]
impl OutlineHandler for OutlineHandlerImpl {
    async fn create(
        &self,
        input: OutlineCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineCreateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("outline", &input.node).await?;
        if existing.is_some() {
            return Ok(OutlineCreateOutput::Exists { message: "already exists".to_string() });
        }

        let parent = input.parent.clone().unwrap_or_default();
        storage.put("outline", &input.node, json!({
            "node": input.node,
            "parent": parent,
            "children": "[]",
            "isCollapsed": false,
            "order": 0
        })).await?;

        if !parent.is_empty() {
            if let Some(parent_record) = storage.get("outline", &parent).await? {
                let mut children: Vec<String> = serde_json::from_str(
                    parent_record["children"].as_str().unwrap_or("[]")
                ).unwrap_or_default();
                children.push(input.node.clone());
                let mut updated = parent_record.clone();
                updated["children"] = json!(serde_json::to_string(&children)?);
                storage.put("outline", &parent, updated).await?;
            }
        }

        Ok(OutlineCreateOutput::Ok { node: input.node })
    }

    async fn indent(
        &self,
        input: OutlineIndentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineIndentOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineIndentOutput::Notfound { message: "Node not found".to_string() }),
        };

        let parent_id = existing["parent"].as_str().unwrap_or("");
        if parent_id.is_empty() {
            return Ok(OutlineIndentOutput::Invalid { message: "No previous sibling to indent under".to_string() });
        }

        let parent_record = match storage.get("outline", parent_id).await? {
            Some(r) => r,
            None => return Ok(OutlineIndentOutput::Invalid { message: "No previous sibling to indent under".to_string() }),
        };

        let mut siblings: Vec<String> = serde_json::from_str(
            parent_record["children"].as_str().unwrap_or("[]")
        ).unwrap_or_default();

        let idx = siblings.iter().position(|s| s == &input.node);
        match idx {
            Some(i) if i > 0 => {
                let new_parent_id = siblings[i - 1].clone();
                siblings.remove(i);

                let mut updated_parent = parent_record.clone();
                updated_parent["children"] = json!(serde_json::to_string(&siblings)?);
                storage.put("outline", parent_id, updated_parent).await?;

                if let Some(new_parent_record) = storage.get("outline", &new_parent_id).await? {
                    let mut new_children: Vec<String> = serde_json::from_str(
                        new_parent_record["children"].as_str().unwrap_or("[]")
                    ).unwrap_or_default();
                    new_children.push(input.node.clone());
                    let mut updated_new = new_parent_record.clone();
                    updated_new["children"] = json!(serde_json::to_string(&new_children)?);
                    storage.put("outline", &new_parent_id, updated_new).await?;
                }

                let mut updated_node = existing.clone();
                updated_node["parent"] = json!(new_parent_id);
                storage.put("outline", &input.node, updated_node).await?;

                Ok(OutlineIndentOutput::Ok { node: input.node })
            }
            _ => Ok(OutlineIndentOutput::Invalid { message: "No previous sibling to indent under".to_string() }),
        }
    }

    async fn outdent(
        &self,
        input: OutlineOutdentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineOutdentOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineOutdentOutput::Notfound { message: "Node not found".to_string() }),
        };

        let parent_id = existing["parent"].as_str().unwrap_or("");
        if parent_id.is_empty() {
            return Ok(OutlineOutdentOutput::Invalid { message: "Node is already at root level".to_string() });
        }

        let parent_record = match storage.get("outline", parent_id).await? {
            Some(r) => r,
            None => return Ok(OutlineOutdentOutput::Invalid { message: "Node is already at root level".to_string() }),
        };

        let grandparent_id = parent_record["parent"].as_str().unwrap_or("");
        if grandparent_id.is_empty() {
            return Ok(OutlineOutdentOutput::Invalid { message: "Node is already at root level".to_string() });
        }

        let mut parent_children: Vec<String> = serde_json::from_str(
            parent_record["children"].as_str().unwrap_or("[]")
        ).unwrap_or_default();
        if let Some(idx) = parent_children.iter().position(|s| s == &input.node) {
            parent_children.remove(idx);
        }
        let mut updated_parent = parent_record.clone();
        updated_parent["children"] = json!(serde_json::to_string(&parent_children)?);
        storage.put("outline", parent_id, updated_parent).await?;

        if let Some(gp_record) = storage.get("outline", grandparent_id).await? {
            let mut gp_children: Vec<String> = serde_json::from_str(
                gp_record["children"].as_str().unwrap_or("[]")
            ).unwrap_or_default();
            let parent_idx = gp_children.iter().position(|s| s == parent_id).unwrap_or(gp_children.len());
            gp_children.insert(parent_idx + 1, input.node.clone());
            let mut updated_gp = gp_record.clone();
            updated_gp["children"] = json!(serde_json::to_string(&gp_children)?);
            storage.put("outline", grandparent_id, updated_gp).await?;
        }

        let mut updated_node = existing.clone();
        updated_node["parent"] = json!(grandparent_id);
        storage.put("outline", &input.node, updated_node).await?;

        Ok(OutlineOutdentOutput::Ok { node: input.node })
    }

    async fn move_up(
        &self,
        input: OutlineMoveUpInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineMoveUpOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineMoveUpOutput::Notfound { message: "Node not found".to_string() }),
        };

        let parent_id = existing["parent"].as_str().unwrap_or("");
        if !parent_id.is_empty() {
            if let Some(parent_record) = storage.get("outline", parent_id).await? {
                let mut siblings: Vec<String> = serde_json::from_str(
                    parent_record["children"].as_str().unwrap_or("[]")
                ).unwrap_or_default();
                if let Some(idx) = siblings.iter().position(|s| s == &input.node) {
                    if idx > 0 {
                        siblings.swap(idx - 1, idx);
                        let mut updated = parent_record.clone();
                        updated["children"] = json!(serde_json::to_string(&siblings)?);
                        storage.put("outline", parent_id, updated).await?;
                    }
                }
            }
        }

        Ok(OutlineMoveUpOutput::Ok { node: input.node })
    }

    async fn move_down(
        &self,
        input: OutlineMoveDownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineMoveDownOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineMoveDownOutput::Notfound { message: "Node not found".to_string() }),
        };

        let parent_id = existing["parent"].as_str().unwrap_or("");
        if !parent_id.is_empty() {
            if let Some(parent_record) = storage.get("outline", parent_id).await? {
                let mut siblings: Vec<String> = serde_json::from_str(
                    parent_record["children"].as_str().unwrap_or("[]")
                ).unwrap_or_default();
                if let Some(idx) = siblings.iter().position(|s| s == &input.node) {
                    if idx < siblings.len() - 1 {
                        siblings.swap(idx, idx + 1);
                        let mut updated = parent_record.clone();
                        updated["children"] = json!(serde_json::to_string(&siblings)?);
                        storage.put("outline", parent_id, updated).await?;
                    }
                }
            }
        }

        Ok(OutlineMoveDownOutput::Ok { node: input.node })
    }

    async fn collapse(
        &self,
        input: OutlineCollapseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineCollapseOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineCollapseOutput::Notfound { message: "Node not found".to_string() }),
        };
        let mut updated = existing.clone();
        updated["isCollapsed"] = json!(true);
        storage.put("outline", &input.node, updated).await?;
        Ok(OutlineCollapseOutput::Ok { node: input.node })
    }

    async fn expand(
        &self,
        input: OutlineExpandInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineExpandOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineExpandOutput::Notfound { message: "Node not found".to_string() }),
        };
        let mut updated = existing.clone();
        updated["isCollapsed"] = json!(false);
        storage.put("outline", &input.node, updated).await?;
        Ok(OutlineExpandOutput::Ok { node: input.node })
    }

    async fn reparent(
        &self,
        input: OutlineReparentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineReparentOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineReparentOutput::Notfound { message: "Node not found".to_string() }),
        };

        let new_parent_record = match storage.get("outline", &input.new_parent).await? {
            Some(r) => r,
            None => return Ok(OutlineReparentOutput::Notfound { message: "Parent not found".to_string() }),
        };

        let old_parent_id = existing["parent"].as_str().unwrap_or("");
        if !old_parent_id.is_empty() {
            if let Some(old_parent) = storage.get("outline", old_parent_id).await? {
                let mut old_children: Vec<String> = serde_json::from_str(
                    old_parent["children"].as_str().unwrap_or("[]")
                ).unwrap_or_default();
                old_children.retain(|s| s != &input.node);
                let mut updated = old_parent.clone();
                updated["children"] = json!(serde_json::to_string(&old_children)?);
                storage.put("outline", old_parent_id, updated).await?;
            }
        }

        let mut new_children: Vec<String> = serde_json::from_str(
            new_parent_record["children"].as_str().unwrap_or("[]")
        ).unwrap_or_default();
        new_children.push(input.node.clone());
        let mut updated_new = new_parent_record.clone();
        updated_new["children"] = json!(serde_json::to_string(&new_children)?);
        storage.put("outline", &input.new_parent, updated_new).await?;

        let mut updated_node = existing.clone();
        updated_node["parent"] = json!(input.new_parent);
        storage.put("outline", &input.node, updated_node).await?;

        Ok(OutlineReparentOutput::Ok { node: input.node })
    }

    async fn get_children(
        &self,
        input: OutlineGetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineGetChildrenOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("outline", &input.node).await? {
            Some(r) => r,
            None => return Ok(OutlineGetChildrenOutput::Notfound { message: "Node not found".to_string() }),
        };
        let children = existing["children"].as_str().unwrap_or("[]").to_string();
        Ok(OutlineGetChildrenOutput::Ok { children })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_node() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        let result = handler.create(
            OutlineCreateInput { node: "node-1".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        match result {
            OutlineCreateOutput::Ok { node } => assert_eq!(node, "node-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_duplicate_node() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        handler.create(
            OutlineCreateInput { node: "node-1".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        let result = handler.create(
            OutlineCreateInput { node: "node-1".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        match result {
            OutlineCreateOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_collapse_and_expand() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        handler.create(
            OutlineCreateInput { node: "node-1".to_string(), parent: None },
            &storage,
        ).await.unwrap();
        let result = handler.collapse(
            OutlineCollapseInput { node: "node-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineCollapseOutput::Ok { node } => assert_eq!(node, "node-1"),
            _ => panic!("Expected Ok variant"),
        }
        let result = handler.expand(
            OutlineExpandInput { node: "node-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineExpandOutput::Ok { node } => assert_eq!(node, "node-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_collapse_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        let result = handler.collapse(
            OutlineCollapseInput { node: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineCollapseOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_children_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        let result = handler.get_children(
            OutlineGetChildrenInput { node: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineGetChildrenOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_move_up_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        let result = handler.move_up(
            OutlineMoveUpInput { node: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineMoveUpOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_reparent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        let result = handler.reparent(
            OutlineReparentInput { node: "nonexistent".to_string(), new_parent: "parent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineReparentOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_indent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        let result = handler.indent(
            OutlineIndentInput { node: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineIndentOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_outdent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = OutlineHandlerImpl;
        let result = handler.outdent(
            OutlineOutdentInput { node: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            OutlineOutdentOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
