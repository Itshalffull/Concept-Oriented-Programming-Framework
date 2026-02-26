// Threaded Comment Concept Implementation (Rust)
//
// Manages threaded comments with replies, publish/unpublish workflow.
// See Architecture doc Sections on content kit commenting.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── AddComment ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddCommentInput {
    pub host_node_id: String,
    pub content: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum AddCommentOutput {
    #[serde(rename = "ok")]
    Ok { comment_id: String },
}

// ── Reply ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplyInput {
    pub parent_comment_id: String,
    pub content: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ReplyOutput {
    #[serde(rename = "ok")]
    Ok { comment_id: String },
    #[serde(rename = "parent_notfound")]
    ParentNotFound { message: String },
}

// ── Publish ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishInput {
    pub comment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum PublishOutput {
    #[serde(rename = "ok")]
    Ok { comment_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Unpublish ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnpublishInput {
    pub comment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum UnpublishOutput {
    #[serde(rename = "ok")]
    Ok { comment_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Delete ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteInput {
    pub comment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DeleteOutput {
    #[serde(rename = "ok")]
    Ok { comment_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct ThreadedCommentHandler;

impl ThreadedCommentHandler {
    pub async fn add_comment(
        &self,
        input: AddCommentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<AddCommentOutput> {
        let now = chrono::Utc::now();
        let comment_id = format!("tc_{}_{}", input.host_node_id, now.timestamp_millis());

        storage
            .put(
                "threaded_comment",
                &comment_id,
                json!({
                    "comment_id": comment_id,
                    "host_node_id": input.host_node_id,
                    "parent_comment_id": null,
                    "content": input.content,
                    "author": input.author,
                    "published": false,
                    "created_at": now.to_rfc3339(),
                }),
            )
            .await?;

        Ok(AddCommentOutput::Ok { comment_id })
    }

    pub async fn reply(
        &self,
        input: ReplyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ReplyOutput> {
        let parent = storage
            .get("threaded_comment", &input.parent_comment_id)
            .await?;

        match parent {
            None => Ok(ReplyOutput::ParentNotFound {
                message: format!(
                    "Parent comment '{}' not found",
                    input.parent_comment_id
                ),
            }),
            Some(parent_record) => {
                let now = chrono::Utc::now();
                let host_node_id = parent_record["host_node_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let comment_id =
                    format!("tc_{}_{}", host_node_id, now.timestamp_millis());

                storage
                    .put(
                        "threaded_comment",
                        &comment_id,
                        json!({
                            "comment_id": comment_id,
                            "host_node_id": host_node_id,
                            "parent_comment_id": input.parent_comment_id,
                            "content": input.content,
                            "author": input.author,
                            "published": false,
                            "created_at": now.to_rfc3339(),
                        }),
                    )
                    .await?;

                Ok(ReplyOutput::Ok { comment_id })
            }
        }
    }

    pub async fn publish(
        &self,
        input: PublishInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PublishOutput> {
        let existing = storage
            .get("threaded_comment", &input.comment_id)
            .await?;

        match existing {
            None => Ok(PublishOutput::NotFound {
                message: format!("Comment '{}' not found", input.comment_id),
            }),
            Some(mut comment) => {
                comment["published"] = json!(true);
                storage
                    .put("threaded_comment", &input.comment_id, comment)
                    .await?;

                Ok(PublishOutput::Ok {
                    comment_id: input.comment_id,
                })
            }
        }
    }

    pub async fn unpublish(
        &self,
        input: UnpublishInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<UnpublishOutput> {
        let existing = storage
            .get("threaded_comment", &input.comment_id)
            .await?;

        match existing {
            None => Ok(UnpublishOutput::NotFound {
                message: format!("Comment '{}' not found", input.comment_id),
            }),
            Some(mut comment) => {
                comment["published"] = json!(false);
                storage
                    .put("threaded_comment", &input.comment_id, comment)
                    .await?;

                Ok(UnpublishOutput::Ok {
                    comment_id: input.comment_id,
                })
            }
        }
    }

    pub async fn delete(
        &self,
        input: DeleteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DeleteOutput> {
        let existing = storage
            .get("threaded_comment", &input.comment_id)
            .await?;

        if existing.is_none() {
            return Ok(DeleteOutput::NotFound {
                message: format!("Comment '{}' not found", input.comment_id),
            });
        }

        storage.del("threaded_comment", &input.comment_id).await?;

        Ok(DeleteOutput::Ok {
            comment_id: input.comment_id,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    async fn create_comment(
        handler: &ThreadedCommentHandler,
        storage: &InMemoryStorage,
        host: &str,
    ) -> String {
        let result = handler
            .add_comment(
                AddCommentInput {
                    host_node_id: host.into(),
                    content: "Test comment".into(),
                    author: "alice".into(),
                },
                storage,
            )
            .await
            .unwrap();
        match result {
            AddCommentOutput::Ok { comment_id } => comment_id,
        }
    }

    // --- add_comment ---

    #[tokio::test]
    async fn add_comment_creates_comment() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let comment_id = create_comment(&handler, &storage, "page1").await;
        assert!(comment_id.starts_with("tc_page1_"));

        let record = storage.get("threaded_comment", &comment_id).await.unwrap();
        assert!(record.is_some());
    }

    #[tokio::test]
    async fn add_comment_stores_content_and_author() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let result = handler
            .add_comment(
                AddCommentInput {
                    host_node_id: "page1".into(),
                    content: "Great post!".into(),
                    author: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let comment_id = match result { AddCommentOutput::Ok { comment_id } => comment_id };
        let record = storage.get("threaded_comment", &comment_id).await.unwrap().unwrap();
        assert_eq!(record["content"].as_str().unwrap(), "Great post!");
        assert_eq!(record["author"].as_str().unwrap(), "bob");
        assert_eq!(record["published"].as_bool().unwrap(), false);
    }

    // --- reply ---

    #[tokio::test]
    async fn reply_creates_child_comment() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let parent_id = create_comment(&handler, &storage, "page1").await;

        let result = handler
            .reply(
                ReplyInput {
                    parent_comment_id: parent_id.clone(),
                    content: "Reply text".into(),
                    author: "charlie".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            ReplyOutput::Ok { comment_id } => {
                let record = storage.get("threaded_comment", &comment_id).await.unwrap().unwrap();
                assert_eq!(record["parent_comment_id"].as_str().unwrap(), parent_id);
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn reply_parent_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let result = handler
            .reply(
                ReplyInput {
                    parent_comment_id: "ghost".into(),
                    content: "Reply".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, ReplyOutput::ParentNotFound { .. }));
    }

    // --- publish ---

    #[tokio::test]
    async fn publish_sets_published_true() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let comment_id = create_comment(&handler, &storage, "page1").await;

        let result = handler
            .publish(PublishInput { comment_id: comment_id.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, PublishOutput::Ok { .. }));

        let record = storage.get("threaded_comment", &comment_id).await.unwrap().unwrap();
        assert_eq!(record["published"].as_bool().unwrap(), true);
    }

    #[tokio::test]
    async fn publish_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let result = handler
            .publish(PublishInput { comment_id: "missing".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, PublishOutput::NotFound { .. }));
    }

    // --- unpublish ---

    #[tokio::test]
    async fn unpublish_sets_published_false() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let comment_id = create_comment(&handler, &storage, "page1").await;
        handler.publish(PublishInput { comment_id: comment_id.clone() }, &storage).await.unwrap();

        let result = handler
            .unpublish(UnpublishInput { comment_id: comment_id.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, UnpublishOutput::Ok { .. }));

        let record = storage.get("threaded_comment", &comment_id).await.unwrap().unwrap();
        assert_eq!(record["published"].as_bool().unwrap(), false);
    }

    #[tokio::test]
    async fn unpublish_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let result = handler
            .unpublish(UnpublishInput { comment_id: "missing".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, UnpublishOutput::NotFound { .. }));
    }

    // --- delete ---

    #[tokio::test]
    async fn delete_removes_comment() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let comment_id = create_comment(&handler, &storage, "page1").await;

        let result = handler
            .delete(DeleteInput { comment_id: comment_id.clone() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::Ok { .. }));

        let record = storage.get("threaded_comment", &comment_id).await.unwrap();
        assert!(record.is_none());
    }

    #[tokio::test]
    async fn delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ThreadedCommentHandler;

        let result = handler
            .delete(DeleteInput { comment_id: "ghost".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, DeleteOutput::NotFound { .. }));
    }
}
