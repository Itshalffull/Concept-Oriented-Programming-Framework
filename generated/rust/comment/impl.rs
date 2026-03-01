// Comment -- threaded discussion system for content entities
// Supports hierarchical threading via thread paths, publish/unpublish lifecycle.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CommentHandler;
use serde_json::json;

pub struct CommentHandlerImpl;

#[async_trait]
impl CommentHandler for CommentHandlerImpl {
    async fn add_comment(
        &self,
        input: CommentAddCommentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentAddCommentOutput, Box<dyn std::error::Error>> {
        let thread_path = format!("/{}", input.comment);

        storage.put("comment", &input.comment, json!({
            "comment": input.comment,
            "entity": input.entity,
            "content": input.content,
            "author": input.author,
            "parent": "",
            "threadPath": thread_path,
            "published": false,
        })).await?;

        Ok(CommentAddCommentOutput::Ok {
            comment: input.comment,
        })
    }

    async fn reply(
        &self,
        input: CommentReplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentReplyOutput, Box<dyn std::error::Error>> {
        let parent_record = storage.get("comment", &input.parent).await?;
        let parent_thread_path = parent_record
            .as_ref()
            .and_then(|r| r["threadPath"].as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("/{}", input.parent));

        let thread_path = format!("{}/{}", parent_thread_path, input.comment);

        let entity = parent_record
            .as_ref()
            .and_then(|r| r["entity"].as_str())
            .unwrap_or("")
            .to_string();

        storage.put("comment", &input.comment, json!({
            "comment": input.comment,
            "entity": entity,
            "content": input.content,
            "author": input.author,
            "parent": input.parent,
            "threadPath": thread_path,
            "published": false,
        })).await?;

        Ok(CommentReplyOutput::Ok {
            comment: input.comment,
        })
    }

    async fn publish(
        &self,
        input: CommentPublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentPublishOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("comment", &input.comment).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(CommentPublishOutput::Notfound {
                    message: "Comment not found".to_string(),
                });
            }
        };

        let mut updated = record.clone();
        updated["published"] = json!(true);
        storage.put("comment", &input.comment, updated).await?;

        Ok(CommentPublishOutput::Ok)
    }

    async fn unpublish(
        &self,
        input: CommentUnpublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentUnpublishOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("comment", &input.comment).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(CommentUnpublishOutput::Notfound {
                    message: "Comment not found".to_string(),
                });
            }
        };

        let mut updated = record.clone();
        updated["published"] = json!(false);
        storage.put("comment", &input.comment, updated).await?;

        Ok(CommentUnpublishOutput::Ok)
    }

    async fn delete(
        &self,
        input: CommentDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CommentDeleteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("comment", &input.comment).await?;
        if existing.is_none() {
            return Ok(CommentDeleteOutput::Notfound {
                message: "Comment not found".to_string(),
            });
        }

        storage.del("comment", &input.comment).await?;

        Ok(CommentDeleteOutput::Ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_add_comment_success() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandlerImpl;
        let result = handler.add_comment(
            CommentAddCommentInput {
                comment: "c1".to_string(),
                entity: "article-1".to_string(),
                content: "Great post!".to_string(),
                author: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CommentAddCommentOutput::Ok { comment } => {
                assert_eq!(comment, "c1");
            },
        }
    }

    #[tokio::test]
    async fn test_reply_success() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandlerImpl;

        handler.add_comment(
            CommentAddCommentInput {
                comment: "c1".to_string(),
                entity: "article-1".to_string(),
                content: "Parent comment".to_string(),
                author: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.reply(
            CommentReplyInput {
                comment: "c2".to_string(),
                parent: "c1".to_string(),
                content: "Reply text".to_string(),
                author: "user-2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CommentReplyOutput::Ok { comment } => {
                assert_eq!(comment, "c2");
            },
        }
    }

    #[tokio::test]
    async fn test_publish_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandlerImpl;
        let result = handler.publish(
            CommentPublishInput { comment: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CommentPublishOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_unpublish_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandlerImpl;
        let result = handler.unpublish(
            CommentUnpublishInput { comment: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CommentUnpublishOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandlerImpl;
        let result = handler.delete(
            CommentDeleteInput { comment: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            CommentDeleteOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_publish_then_unpublish() {
        let storage = InMemoryStorage::new();
        let handler = CommentHandlerImpl;

        handler.add_comment(
            CommentAddCommentInput {
                comment: "c1".to_string(),
                entity: "art-1".to_string(),
                content: "text".to_string(),
                author: "user".to_string(),
            },
            &storage,
        ).await.unwrap();

        let pub_result = handler.publish(
            CommentPublishInput { comment: "c1".to_string() },
            &storage,
        ).await.unwrap();
        match pub_result {
            CommentPublishOutput::Ok => {},
            _ => panic!("Expected Ok for publish"),
        }

        let unpub_result = handler.unpublish(
            CommentUnpublishInput { comment: "c1".to_string() },
            &storage,
        ).await.unwrap();
        match unpub_result {
            CommentUnpublishOutput::Ok => {},
            _ => panic!("Expected Ok for unpublish"),
        }
    }
}
