// Comment Concept Implementation (Rust)
//
// Threaded discussion attached to content entities using materialized path threading.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentAddCommentInput {
    pub comment: String,
    pub entity: String,
    pub content: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentAddCommentOutput {
    #[serde(rename = "ok")]
    Ok { comment: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentReplyInput {
    pub comment: String,
    pub parent: String,
    pub content: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentReplyOutput {
    #[serde(rename = "ok")]
    Ok { comment: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentPublishInput {
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentPublishOutput {
    #[serde(rename = "ok")]
    Ok {},
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentUnpublishInput {
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentUnpublishOutput {
    #[serde(rename = "ok")]
    Ok {},
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentDeleteInput {
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentDeleteOutput {
    #[serde(rename = "ok")]
    Ok {},
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

// ── Handler ────────────────────────────────────────────────

pub struct CommentHandler;

impl CommentHandler {
    pub async fn add_comment(
        &self,
        input: CommentAddCommentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CommentAddCommentOutput> {
        let thread_path = format!("/{}", input.comment);

        storage
            .put(
                "comment",
                &input.comment,
                json!({
                    "comment": input.comment,
                    "entity": input.entity,
                    "content": input.content,
                    "author": input.author,
                    "parent": "",
                    "threadPath": thread_path,
                    "published": false,
                }),
            )
            .await?;

        Ok(CommentAddCommentOutput::Ok {
            comment: input.comment,
        })
    }

    pub async fn reply(
        &self,
        input: CommentReplyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CommentReplyOutput> {
        let parent_record = storage.get("comment", &input.parent).await?;
        let parent_thread_path = parent_record
            .as_ref()
            .and_then(|r| r["threadPath"].as_str())
            .unwrap_or(&format!("/{}", input.parent))
            .to_string();

        let thread_path = format!("{}/{}", parent_thread_path, input.comment);
        let entity = parent_record
            .as_ref()
            .and_then(|r| r["entity"].as_str())
            .unwrap_or("")
            .to_string();

        storage
            .put(
                "comment",
                &input.comment,
                json!({
                    "comment": input.comment,
                    "entity": entity,
                    "content": input.content,
                    "author": input.author,
                    "parent": input.parent,
                    "threadPath": thread_path,
                    "published": false,
                }),
            )
            .await?;

        Ok(CommentReplyOutput::Ok {
            comment: input.comment,
        })
    }

    pub async fn publish(
        &self,
        input: CommentPublishInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CommentPublishOutput> {
        let existing = storage.get("comment", &input.comment).await?;

        let Some(mut record) = existing else {
            return Ok(CommentPublishOutput::Notfound {
                message: "Comment not found".to_string(),
            });
        };

        if let Some(obj) = record.as_object_mut() {
            obj.insert("published".into(), json!(true));
        }

        storage.put("comment", &input.comment, record).await?;

        Ok(CommentPublishOutput::Ok {})
    }

    pub async fn unpublish(
        &self,
        input: CommentUnpublishInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CommentUnpublishOutput> {
        let existing = storage.get("comment", &input.comment).await?;

        let Some(mut record) = existing else {
            return Ok(CommentUnpublishOutput::Notfound {
                message: "Comment not found".to_string(),
            });
        };

        if let Some(obj) = record.as_object_mut() {
            obj.insert("published".into(), json!(false));
        }

        storage.put("comment", &input.comment, record).await?;

        Ok(CommentUnpublishOutput::Ok {})
    }

    pub async fn delete(
        &self,
        input: CommentDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CommentDeleteOutput> {
        let existing = storage.get("comment", &input.comment).await?;

        if existing.is_none() {
            return Ok(CommentDeleteOutput::Notfound {
                message: "Comment not found".to_string(),
            });
        }

        storage.del("comment", &input.comment).await?;

        Ok(CommentDeleteOutput::Ok {})
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn add_comment_and_reply() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;

        let result = handler
            .add_comment(
                CommentAddCommentInput {
                    comment: "c1".into(),
                    entity: "a1".into(),
                    content: "Nice article!".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(
            result,
            CommentAddCommentOutput::Ok { ref comment } if comment == "c1"
        ));

        let reply = handler
            .reply(
                CommentReplyInput {
                    comment: "c2".into(),
                    parent: "c1".into(),
                    content: "Thanks!".into(),
                    author: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(
            reply,
            CommentReplyOutput::Ok { ref comment } if comment == "c2"
        ));

        // Verify thread path
        let record = storage.get("comment", "c2").await.unwrap().unwrap();
        assert_eq!(record["threadPath"].as_str().unwrap(), "/c1/c2");
    }

    #[tokio::test]
    async fn publish_and_unpublish() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;

        handler
            .add_comment(
                CommentAddCommentInput {
                    comment: "c1".into(),
                    entity: "a1".into(),
                    content: "Hello".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Initially unpublished
        let record = storage.get("comment", "c1").await.unwrap().unwrap();
        assert_eq!(record["published"].as_bool().unwrap(), false);

        // Publish
        let pub_result = handler
            .publish(CommentPublishInput { comment: "c1".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(pub_result, CommentPublishOutput::Ok { .. }));

        let record = storage.get("comment", "c1").await.unwrap().unwrap();
        assert_eq!(record["published"].as_bool().unwrap(), true);

        // Unpublish
        let unpub_result = handler
            .unpublish(CommentUnpublishInput { comment: "c1".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(unpub_result, CommentUnpublishOutput::Ok { .. }));

        let record = storage.get("comment", "c1").await.unwrap().unwrap();
        assert_eq!(record["published"].as_bool().unwrap(), false);
    }

    #[tokio::test]
    async fn publish_notfound() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;
        let result = handler
            .publish(CommentPublishInput { comment: "nonexistent".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, CommentPublishOutput::Notfound { .. }));
    }

    #[tokio::test]
    async fn delete_comment() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;

        handler
            .add_comment(
                CommentAddCommentInput {
                    comment: "c1".into(),
                    entity: "a1".into(),
                    content: "Goodbye".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .delete(CommentDeleteInput { comment: "c1".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, CommentDeleteOutput::Ok { .. }));
    }

    #[tokio::test]
    async fn delete_notfound() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;
        let result = handler
            .delete(
                CommentDeleteInput { comment: "nonexistent".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, CommentDeleteOutput::Notfound { .. }));
    }
}
