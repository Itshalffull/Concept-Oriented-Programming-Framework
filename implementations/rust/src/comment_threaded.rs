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
