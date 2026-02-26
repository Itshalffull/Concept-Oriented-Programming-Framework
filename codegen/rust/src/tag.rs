// Tag Concept Implementation (Rust)
//
// Mirrors the TypeScript tag.impl.ts — add, remove, list actions.
// Tags store an array of article IDs they are associated with.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagAddInput {
    pub tag: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagAddOutput {
    #[serde(rename = "ok")]
    Ok { tag: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagRemoveInput {
    pub tag: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagRemoveOutput {
    #[serde(rename = "ok")]
    Ok { tag: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TagListInput {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TagListOutput {
    #[serde(rename = "ok")]
    Ok { tags: String },
}

// ── Handler ────────────────────────────────────────────────

pub struct TagHandler;

impl TagHandler {
    pub async fn add(
        &self,
        input: TagAddInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagAddOutput> {
        let existing = storage.get("tag", &input.tag).await?;

        let mut articles: Vec<String> = match &existing {
            Some(record) => {
                if let Some(arr) = record["articles"].as_array() {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                } else {
                    vec![]
                }
            }
            None => vec![],
        };

        if !articles.contains(&input.article) {
            articles.push(input.article.clone());
        }

        storage
            .put(
                "tag",
                &input.tag,
                json!({ "tag": input.tag, "articles": articles }),
            )
            .await?;

        Ok(TagAddOutput::Ok { tag: input.tag })
    }

    pub async fn remove(
        &self,
        input: TagRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagRemoveOutput> {
        let existing = storage.get("tag", &input.tag).await?;

        if let Some(record) = existing {
            let articles: Vec<String> = if let Some(arr) = record["articles"].as_array() {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .filter(|a| a != &input.article)
                    .collect()
            } else {
                vec![]
            };

            storage
                .put(
                    "tag",
                    &input.tag,
                    json!({ "tag": input.tag, "articles": articles }),
                )
                .await?;
        }

        Ok(TagRemoveOutput::Ok { tag: input.tag })
    }

    pub async fn list(
        &self,
        _input: TagListInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<TagListOutput> {
        let all_tags = storage.find("tag", None).await?;

        let tags: Vec<String> = all_tags
            .iter()
            .filter_map(|r| r["tag"].as_str().map(String::from))
            .collect();

        Ok(TagListOutput::Ok {
            tags: serde_json::to_string(&tags)?,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn add_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        let result = handler
            .add(
                TagAddInput {
                    tag: "rust".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, TagAddOutput::Ok { ref tag } if tag == "rust"));

        // Verify the tag record contains the article
        let record = storage.get("tag", "rust").await.unwrap().unwrap();
        let articles = record["articles"].as_array().unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].as_str().unwrap(), "a1");
    }

    #[tokio::test]
    async fn add_tag_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        handler
            .add(
                TagAddInput {
                    tag: "rust".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Adding the same article again should not duplicate
        handler
            .add(
                TagAddInput {
                    tag: "rust".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("tag", "rust").await.unwrap().unwrap();
        let articles = record["articles"].as_array().unwrap();
        assert_eq!(articles.len(), 1);
    }

    #[tokio::test]
    async fn remove_tag() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        handler
            .add(
                TagAddInput {
                    tag: "rust".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add(
                TagAddInput {
                    tag: "rust".into(),
                    article: "a2".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .remove(
                TagRemoveInput {
                    tag: "rust".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("tag", "rust").await.unwrap().unwrap();
        let articles = record["articles"].as_array().unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].as_str().unwrap(), "a2");
    }

    #[tokio::test]
    async fn list_tags() {
        let storage = InMemoryStorage::new();
        let handler = TagHandler;

        handler
            .add(
                TagAddInput {
                    tag: "rust".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .add(
                TagAddInput {
                    tag: "typescript".into(),
                    article: "a2".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .list(TagListInput {}, &storage)
            .await
            .unwrap();

        match result {
            TagListOutput::Ok { tags } => {
                let parsed: Vec<String> = serde_json::from_str(&tags).unwrap();
                assert_eq!(parsed.len(), 2);
                assert!(parsed.contains(&"rust".to_string()));
                assert!(parsed.contains(&"typescript".to_string()));
            }
        }
    }
}
