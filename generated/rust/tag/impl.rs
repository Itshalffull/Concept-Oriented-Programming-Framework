// Tag concept implementation (Classification)
// Manages entity-to-tag associations with hierarchical tag support.
// Tags can be added/removed from entities, queried, renamed,
// and support parent-child relationships for taxonomy-like structures.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TagHandler;
use serde_json::json;

pub struct TagHandlerImpl;

#[async_trait]
impl TagHandler for TagHandlerImpl {
    async fn add_tag(
        &self,
        input: TagAddTagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagAddTagOutput, Box<dyn std::error::Error>> {
        let entity = &input.entity;
        let tag = &input.tag;

        let mut existing = storage.get("tag", tag).await?;

        // Auto-create the tag if it doesn't exist
        if existing.is_none() {
            existing = Some(json!({
                "tag": tag,
                "tagIndex": "[]",
            }));
        }

        let existing = existing.unwrap();
        let tag_index_str = existing.get("tagIndex")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");

        let mut tag_index: Vec<String> = serde_json::from_str(tag_index_str)
            .unwrap_or_default();

        if !tag_index.contains(&entity.to_string()) {
            tag_index.push(entity.clone());
        }

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("tagIndex".to_string(), json!(serde_json::to_string(&tag_index)?));
        }

        storage.put("tag", tag, updated).await?;

        Ok(TagAddTagOutput::Ok)
    }

    async fn remove_tag(
        &self,
        input: TagRemoveTagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagRemoveTagOutput, Box<dyn std::error::Error>> {
        let entity = &input.entity;
        let tag = &input.tag;

        let existing = storage.get("tag", tag).await?;
        let existing = match existing {
            Some(e) => e,
            None => {
                return Ok(TagRemoveTagOutput::Notfound {
                    message: "Tag does not exist".to_string(),
                });
            }
        };

        let tag_index_str = existing.get("tagIndex")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");

        let mut tag_index: Vec<String> = serde_json::from_str(tag_index_str)
            .unwrap_or_default();

        if !tag_index.contains(&entity.to_string()) {
            return Ok(TagRemoveTagOutput::Notfound {
                message: "Entity not associated with this tag".to_string(),
            });
        }

        tag_index.retain(|e| e != entity);

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("tagIndex".to_string(), json!(serde_json::to_string(&tag_index)?));
        }

        storage.put("tag", tag, updated).await?;

        Ok(TagRemoveTagOutput::Ok)
    }

    async fn get_by_tag(
        &self,
        input: TagGetByTagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagGetByTagOutput, Box<dyn std::error::Error>> {
        let tag = &input.tag;

        let existing = storage.get("tag", tag).await?;
        let entities: Vec<String> = if let Some(e) = existing {
            let tag_index_str = e.get("tagIndex")
                .and_then(|v| v.as_str())
                .unwrap_or("[]");
            serde_json::from_str(tag_index_str).unwrap_or_default()
        } else {
            Vec::new()
        };

        // Return single entity as plain string, multiple as comma-separated
        let entities_value = if entities.len() == 1 {
            entities[0].clone()
        } else {
            entities.join(",")
        };

        Ok(TagGetByTagOutput::Ok {
            entities: entities_value,
        })
    }

    async fn get_children(
        &self,
        input: TagGetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagGetChildrenOutput, Box<dyn std::error::Error>> {
        let tag = &input.tag;

        let existing = storage.get("tag", tag).await?;
        if existing.is_none() {
            return Ok(TagGetChildrenOutput::Notfound {
                message: "Tag does not exist".to_string(),
            });
        }

        // Find all tags that have this tag as their parent
        let all_tags = storage.find("tag", None).await?;
        let children: Vec<String> = all_tags.iter()
            .filter_map(|record| {
                let parent = record.get("parent").and_then(|v| v.as_str());
                if parent == Some(tag.as_str()) {
                    record.get("tag").and_then(|v| v.as_str()).map(|s| s.to_string())
                } else {
                    None
                }
            })
            .collect();

        Ok(TagGetChildrenOutput::Ok {
            children: serde_json::to_string(&children).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn rename(
        &self,
        input: TagRenameInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TagRenameOutput, Box<dyn std::error::Error>> {
        let tag = &input.tag;
        let name = &input.name;

        let existing = storage.get("tag", tag).await?;
        let existing = match existing {
            Some(e) => e,
            None => {
                return Ok(TagRenameOutput::Notfound {
                    message: "Tag does not exist".to_string(),
                });
            }
        };

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("name".to_string(), json!(name));
        }

        storage.put("tag", tag, updated).await?;

        Ok(TagRenameOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_add_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandlerImpl;
        let result = handler.add_tag(
            TagAddTagInput { entity: "article-1".to_string(), tag: "featured".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TagAddTagOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandlerImpl;
        handler.add_tag(
            TagAddTagInput { entity: "article-1".to_string(), tag: "featured".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.remove_tag(
            TagRemoveTagInput { entity: "article-1".to_string(), tag: "featured".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TagRemoveTagOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_remove_tag_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TagHandlerImpl;
        let result = handler.remove_tag(
            TagRemoveTagInput { entity: "article-1".to_string(), tag: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TagRemoveTagOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_by_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandlerImpl;
        handler.add_tag(
            TagAddTagInput { entity: "article-1".to_string(), tag: "featured".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.get_by_tag(
            TagGetByTagInput { tag: "featured".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TagGetByTagOutput::Ok { entities } => {
                assert!(entities.contains("article-1"));
            },
        }
    }

    #[tokio::test]
    async fn test_get_children_tag_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TagHandlerImpl;
        let result = handler.get_children(
            TagGetChildrenInput { tag: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TagGetChildrenOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_rename() {
        let storage = InMemoryStorage::new();
        let handler = TagHandlerImpl;
        handler.add_tag(
            TagAddTagInput { entity: "e-1".to_string(), tag: "old-tag".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.rename(
            TagRenameInput { tag: "old-tag".to_string(), name: "new-name".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TagRenameOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_rename_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TagHandlerImpl;
        let result = handler.rename(
            TagRenameInput { tag: "nonexistent".to_string(), name: "new".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            TagRenameOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
