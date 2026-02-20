// Comment Concept Implementation (Rust)
//
// Mirrors the TypeScript comment.impl.ts — create, delete, list actions.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentCreateInput {
    pub comment: String,
    pub body: String,
    pub target: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentCreateOutput {
    #[serde(rename = "ok")]
    Ok { comment: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentDeleteInput {
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentDeleteOutput {
    #[serde(rename = "ok")]
    Ok { comment: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommentListInput {
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CommentListOutput {
    #[serde(rename = "ok")]
    Ok { comments: String },
}

// ── Handler ────────────────────────────────────────────────

pub struct CommentHandler;

impl CommentHandler {
    pub async fn create(
        &self,
        input: CommentCreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CommentCreateOutput> {
        let now = chrono::Utc::now().to_rfc3339();

        storage
            .put(
                "comment",
                &input.comment,
                json!({
                    "comment": input.comment,
                    "body": input.body,
                    "target": input.target,
                    "author": input.author,
                    "createdAt": now,
                }),
            )
            .await?;

        Ok(CommentCreateOutput::Ok {
            comment: input.comment,
        })
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

        Ok(CommentDeleteOutput::Ok {
            comment: input.comment,
        })
    }

    pub async fn list(
        &self,
        input: CommentListInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CommentListOutput> {
        let results = storage
            .find("comment", Some(&json!({ "target": input.target })))
            .await?;

        let comments: Vec<serde_json::Value> = results
            .iter()
            .map(|r| {
                json!({
                    "comment": r["comment"],
                    "body": r["body"],
                    "author": r["author"],
                    "createdAt": r["createdAt"],
                })
            })
            .collect();

        Ok(CommentListOutput::Ok {
            comments: serde_json::to_string(&comments)?,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn create_comment() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;
        let result = handler
            .create(
                CommentCreateInput {
                    comment: "c1".into(),
                    body: "Nice article!".into(),
                    target: "a1".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(
            result,
            CommentCreateOutput::Ok { ref comment } if comment == "c1"
        ));
    }

    #[tokio::test]
    async fn delete_comment() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;

        handler
            .create(
                CommentCreateInput {
                    comment: "c1".into(),
                    body: "Great!".into(),
                    target: "a1".into(),
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
                CommentDeleteInput {
                    comment: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, CommentDeleteOutput::Notfound { .. }));
    }

    #[tokio::test]
    async fn list_comments() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandler;

        handler
            .create(
                CommentCreateInput {
                    comment: "c1".into(),
                    body: "First!".into(),
                    target: "a1".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .create(
                CommentCreateInput {
                    comment: "c2".into(),
                    body: "Second!".into(),
                    target: "a1".into(),
                    author: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Comment on a different target
        handler
            .create(
                CommentCreateInput {
                    comment: "c3".into(),
                    body: "Other article".into(),
                    target: "a2".into(),
                    author: "carol".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .list(CommentListInput { target: "a1".into() }, &storage)
            .await
            .unwrap();

        match result {
            CommentListOutput::Ok { comments } => {
                let parsed: Vec<serde_json::Value> =
                    serde_json::from_str(&comments).unwrap();
                assert_eq!(parsed.len(), 2);
            }
        }
    }
}
