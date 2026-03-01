// Flag concept implementation
// Generalized user-entity toggle interactions (bookmarks, likes, follows, spam reports) with counts.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FlagHandler;
use serde_json::json;

pub struct FlagHandlerImpl;

#[async_trait]
impl FlagHandler for FlagHandlerImpl {
    async fn flag(
        &self,
        input: FlagFlagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagFlagOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("flag", &input.flagging).await?;
        if existing.is_some() {
            return Ok(FlagFlagOutput::Exists {
                message: "User has already flagged this entity with this type".to_string(),
            });
        }

        // Check for duplicate flagging by same user on same entity with same type
        let all_flags = storage.find("flag", None).await?;
        for record in &all_flags {
            if record.get("flagType").and_then(|v| v.as_str()) == Some(&input.flag_type)
                && record.get("entity").and_then(|v| v.as_str()) == Some(&input.entity)
                && record.get("user").and_then(|v| v.as_str()) == Some(&input.user)
            {
                return Ok(FlagFlagOutput::Exists {
                    message: "User has already flagged this entity with this type".to_string(),
                });
            }
        }

        storage.put("flag", &input.flagging, json!({
            "flagging": input.flagging,
            "flagType": input.flag_type,
            "entity": input.entity,
            "user": input.user,
        })).await?;

        // Update the count for this flagType + entity combination
        let count_key = format!("{}:{}", input.flag_type, input.entity);
        let count_record = storage.get("flagCount", &count_key).await?;
        let current_count = count_record
            .as_ref()
            .and_then(|r| r.get("count"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        storage.put("flagCount", &count_key, json!({
            "flagType": input.flag_type,
            "entity": input.entity,
            "count": current_count + 1,
        })).await?;

        Ok(FlagFlagOutput::Ok)
    }

    async fn unflag(
        &self,
        input: FlagUnflagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagUnflagOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("flag", &input.flagging).await?;
        let Some(record) = existing else {
            return Ok(FlagUnflagOutput::Notfound {
                message: "Flagging does not exist".to_string(),
            });
        };

        let flag_type = record.get("flagType").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let entity = record.get("entity").and_then(|v| v.as_str()).unwrap_or("").to_string();

        storage.del("flag", &input.flagging).await?;

        // Decrement the count
        let count_key = format!("{}:{}", flag_type, entity);
        let count_record = storage.get("flagCount", &count_key).await?;
        let current_count = count_record
            .as_ref()
            .and_then(|r| r.get("count"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let new_count = (current_count - 1).max(0);

        storage.put("flagCount", &count_key, json!({
            "flagType": flag_type,
            "entity": entity,
            "count": new_count,
        })).await?;

        Ok(FlagUnflagOutput::Ok)
    }

    async fn is_flagged(
        &self,
        input: FlagIsFlaggedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagIsFlaggedOutput, Box<dyn std::error::Error>> {
        let all_flags = storage.find("flag", None).await?;
        let flagged = all_flags.iter().any(|record| {
            record.get("flagType").and_then(|v| v.as_str()) == Some(&input.flag_type)
                && record.get("entity").and_then(|v| v.as_str()) == Some(&input.entity)
                && record.get("user").and_then(|v| v.as_str()) == Some(&input.user)
        });

        Ok(FlagIsFlaggedOutput::Ok { flagged })
    }

    async fn get_count(
        &self,
        input: FlagGetCountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagGetCountOutput, Box<dyn std::error::Error>> {
        let count_key = format!("{}:{}", input.flag_type, input.entity);
        let count_record = storage.get("flagCount", &count_key).await?;
        let count = count_record
            .as_ref()
            .and_then(|r| r.get("count"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        Ok(FlagGetCountOutput::Ok { count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_flag_success() {
        let storage = InMemoryStorage::new();
        let handler = FlagHandlerImpl;
        let result = handler.flag(
            FlagFlagInput {
                flagging: "flag-1".to_string(),
                flag_type: "like".to_string(),
                entity: "article-1".to_string(),
                user: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlagFlagOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_flag_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = FlagHandlerImpl;
        handler.flag(
            FlagFlagInput {
                flagging: "flag-1".to_string(),
                flag_type: "like".to_string(),
                entity: "article-1".to_string(),
                user: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.flag(
            FlagFlagInput {
                flagging: "flag-1".to_string(),
                flag_type: "like".to_string(),
                entity: "article-1".to_string(),
                user: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlagFlagOutput::Exists { .. } => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_unflag_notfound() {
        let storage = InMemoryStorage::new();
        let handler = FlagHandlerImpl;
        let result = handler.unflag(
            FlagUnflagInput { flagging: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FlagUnflagOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_is_flagged() {
        let storage = InMemoryStorage::new();
        let handler = FlagHandlerImpl;
        handler.flag(
            FlagFlagInput {
                flagging: "flag-2".to_string(),
                flag_type: "bookmark".to_string(),
                entity: "article-2".to_string(),
                user: "user-2".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.is_flagged(
            FlagIsFlaggedInput {
                flag_type: "bookmark".to_string(),
                entity: "article-2".to_string(),
                user: "user-2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlagIsFlaggedOutput::Ok { flagged } => {
                assert!(flagged);
            },
        }
    }

    #[tokio::test]
    async fn test_get_count() {
        let storage = InMemoryStorage::new();
        let handler = FlagHandlerImpl;
        handler.flag(
            FlagFlagInput {
                flagging: "flag-3".to_string(),
                flag_type: "like".to_string(),
                entity: "post-1".to_string(),
                user: "user-3".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get_count(
            FlagGetCountInput {
                flag_type: "like".to_string(),
                entity: "post-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FlagGetCountOutput::Ok { count } => {
                assert_eq!(count, 1);
            },
        }
    }
}
