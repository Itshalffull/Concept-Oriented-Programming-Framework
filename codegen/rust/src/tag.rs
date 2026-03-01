// Tag Concept Implementation (Rust)
//
// Flat or hierarchical labels for cross-cutting classification of content.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagAddTagInput {
    pub entity: String,
    pub tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagAddTagOutput {
    #[serde(rename = "ok")]
    Ok {},
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagRemoveTagInput {
    pub entity: String,
    pub tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagRemoveTagOutput {
    #[serde(rename = "ok")]
    Ok {},
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagGetByTagInput {
    pub tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagGetByTagOutput {
    #[serde(rename = "ok")]
    Ok { entities: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagGetChildrenInput {
    pub tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagGetChildrenOutput {
    #[serde(rename = "ok")]
    Ok { children: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagRenameInput {
    pub tag: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagRenameOutput {
    #[serde(rename = "ok")]
    Ok {},
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

// ── Handler ────────────────────────────────────────────────

pub struct TagHandler;

impl TagHandler {
    pub async fn add_tag(
        &self,
        input: TagAddTagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagAddTagOutput> {
        let existing = storage.get("tag", &input.tag).await?;

        let mut entities: Vec<String> = match &existing {
            Some(record) => {
                if let Some(arr) = record["tagIndex"].as_array() {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                } else {
                    vec![]
                }
            }
            None => vec![],
        };

        if !entities.contains(&input.entity) {
            entities.push(input.entity.clone());
        }

        let name = existing
            .as_ref()
            .and_then(|r| r["name"].as_str())
            .unwrap_or(&input.tag)
            .to_string();

        storage
            .put(
                "tag",
                &input.tag,
                json!({
                    "tag": input.tag,
                    "name": name,
                    "tagIndex": entities,
                }),
            )
            .await?;

        Ok(TagAddTagOutput::Ok {})
    }

    pub async fn remove_tag(
        &self,
        input: TagRemoveTagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagRemoveTagOutput> {
        let existing = storage.get("tag", &input.tag).await?;

        let Some(record) = existing else {
            return Ok(TagRemoveTagOutput::Notfound {
                message: "Tag does not exist".to_string(),
            });
        };

        let entities: Vec<String> = if let Some(arr) = record["tagIndex"].as_array() {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .filter(|e| e != &input.entity)
                .collect()
        } else {
            vec![]
        };

        let name = record["name"].as_str().unwrap_or(&input.tag).to_string();

        storage
            .put(
                "tag",
                &input.tag,
                json!({
                    "tag": input.tag,
                    "name": name,
                    "tagIndex": entities,
                }),
            )
            .await?;

        Ok(TagRemoveTagOutput::Ok {})
    }

    pub async fn get_by_tag(
        &self,
        input: TagGetByTagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagGetByTagOutput> {
        let existing = storage.get("tag", &input.tag).await?;

        let entities: Vec<String> = match existing {
            Some(record) => {
                if let Some(arr) = record["tagIndex"].as_array() {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                } else {
                    vec![]
                }
            }
            None => vec![],
        };

        let entities_str = if entities.len() == 1 {
            entities[0].clone()
        } else {
            entities.join(",")
        };

        Ok(TagGetByTagOutput::Ok {
            entities: entities_str,
        })
    }

    pub async fn get_children(
        &self,
        input: TagGetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagGetChildrenOutput> {
        let existing = storage.get("tag", &input.tag).await?;

        if existing.is_none() {
            return Ok(TagGetChildrenOutput::Notfound {
                message: "Tag does not exist".to_string(),
            });
        }

        let all_tags = storage.find("tag", None).await?;
        let children: Vec<String> = all_tags
            .iter()
            .filter(|r| r["parent"].as_str() == Some(&input.tag))
            .filter_map(|r| r["tag"].as_str().map(String::from))
            .collect();

        Ok(TagGetChildrenOutput::Ok {
            children: serde_json::to_string(&children)?,
        })
    }

    pub async fn rename(
        &self,
        input: TagRenameInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagRenameOutput> {
        let existing = storage.get("tag", &input.tag).await?;

        let Some(mut record) = existing else {
            return Ok(TagRenameOutput::Notfound {
                message: "Tag does not exist".to_string(),
            });
        };

        if let Some(obj) = record.as_object_mut() {
            obj.insert("name".into(), json!(input.name));
        }

        storage.put("tag", &input.tag, record).await?;

        Ok(TagRenameOutput::Ok {})
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn add_tag_and_get_by_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        let result = handler
            .add_tag(
                TagAddTagInput {
                    entity: "a1".into(),
                    tag: "rust".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, TagAddTagOutput::Ok { .. }));

        let get_result = handler
            .get_by_tag(TagGetByTagInput { tag: "rust".into() }, &storage)
            .await
            .unwrap();
        match get_result {
            TagGetByTagOutput::Ok { entities } => {
                assert_eq!(entities, "a1");
            }
        }
    }

    #[tokio::test]
    async fn add_tag_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        handler
            .add_tag(
                TagAddTagInput {
                    entity: "a1".into(),
                    tag: "rust".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_tag(
                TagAddTagInput {
                    entity: "a1".into(),
                    tag: "rust".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("tag", "rust").await.unwrap().unwrap();
        let index = record["tagIndex"].as_array().unwrap();
        assert_eq!(index.len(), 1);
    }

    #[tokio::test]
    async fn remove_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        handler
            .add_tag(
                TagAddTagInput {
                    entity: "a1".into(),
                    tag: "rust".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add_tag(
                TagAddTagInput {
                    entity: "a2".into(),
                    tag: "rust".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .remove_tag(
                TagRemoveTagInput {
                    entity: "a1".into(),
                    tag: "rust".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("tag", "rust").await.unwrap().unwrap();
        let index = record["tagIndex"].as_array().unwrap();
        assert_eq!(index.len(), 1);
        assert_eq!(index[0].as_str().unwrap(), "a2");
    }

    #[tokio::test]
    async fn get_children_empty() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        handler
            .add_tag(
                TagAddTagInput {
                    entity: "a1".into(),
                    tag: "parent".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get_children(TagGetChildrenInput { tag: "parent".into() }, &storage)
            .await
            .unwrap();
        match result {
            TagGetChildrenOutput::Ok { children } => {
                let parsed: Vec<String> = serde_json::from_str(&children).unwrap();
                assert_eq!(parsed.len(), 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn rename_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        handler
            .add_tag(
                TagAddTagInput {
                    entity: "a1".into(),
                    tag: "old".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .rename(
                TagRenameInput {
                    tag: "old".into(),
                    name: "new-name".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, TagRenameOutput::Ok { .. }));

        let record = storage.get("tag", "old").await.unwrap().unwrap();
        assert_eq!(record["name"].as_str().unwrap(), "new-name");
    }

    #[tokio::test]
    async fn rename_notfound() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;
        let result = handler
            .rename(
                TagRenameInput {
                    tag: "nonexistent".into(),
                    name: "new".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, TagRenameOutput::Notfound { .. }));
    }
}
