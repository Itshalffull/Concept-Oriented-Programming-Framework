// Backlink concept implementation
// Track bidirectional links between entities and unlinked mentions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BacklinkHandler;
use serde_json::json;

pub struct BacklinkHandlerImpl;

#[async_trait]
impl BacklinkHandler for BacklinkHandlerImpl {
    async fn get_backlinks(
        &self,
        input: BacklinkGetBacklinksInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BacklinkGetBacklinksOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("backlink", &input.entity).await?;
        let sources: Vec<String> = match existing {
            Some(r) => serde_json::from_str(r["backlinks"].as_str().unwrap_or("[]"))?,
            None => Vec::new(),
        };

        Ok(BacklinkGetBacklinksOutput::Ok {
            sources: serde_json::to_string(&sources)?,
        })
    }

    async fn get_unlinked_mentions(
        &self,
        input: BacklinkGetUnlinkedMentionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BacklinkGetUnlinkedMentionsOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("backlink", &input.entity).await?;
        let mentions: Vec<String> = match existing {
            Some(r) => serde_json::from_str(r["mentions"].as_str().unwrap_or("[]"))?,
            None => Vec::new(),
        };

        Ok(BacklinkGetUnlinkedMentionsOutput::Ok {
            mentions: serde_json::to_string(&mentions)?,
        })
    }

    async fn reindex(
        &self,
        _input: BacklinkReindexInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BacklinkReindexOutput, Box<dyn std::error::Error>> {
        let all_backlinks = storage.find("backlink", None).await?;
        let mut count: i64 = 0;

        for record in &all_backlinks {
            let backlinks: Vec<String> = serde_json::from_str(
                record["backlinks"].as_str().unwrap_or("[]")
            ).unwrap_or_default();
            count += backlinks.len() as i64;
        }

        Ok(BacklinkReindexOutput::Ok { count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_get_backlinks_empty() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandlerImpl;
        let result = handler.get_backlinks(
            BacklinkGetBacklinksInput { entity: "note-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BacklinkGetBacklinksOutput::Ok { sources } => {
                let parsed: Vec<String> = serde_json::from_str(&sources).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_get_backlinks_with_data() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandlerImpl;
        storage.put("backlink", "note-2", json!({
            "entity": "note-2",
            "backlinks": r#"["note-1","note-3"]"#,
            "mentions": "[]",
        })).await.unwrap();
        let result = handler.get_backlinks(
            BacklinkGetBacklinksInput { entity: "note-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BacklinkGetBacklinksOutput::Ok { sources } => {
                let parsed: Vec<String> = serde_json::from_str(&sources).unwrap();
                assert_eq!(parsed.len(), 2);
            }
        }
    }

    #[tokio::test]
    async fn test_get_unlinked_mentions_empty() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandlerImpl;
        let result = handler.get_unlinked_mentions(
            BacklinkGetUnlinkedMentionsInput { entity: "note-x".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BacklinkGetUnlinkedMentionsOutput::Ok { mentions } => {
                let parsed: Vec<String> = serde_json::from_str(&mentions).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn test_reindex_returns_count() {
        let storage = InMemoryStorage::new();
        let handler = BacklinkHandlerImpl;
        let result = handler.reindex(
            BacklinkReindexInput {},
            &storage,
        ).await.unwrap();
        match result {
            BacklinkReindexOutput::Ok { count } => {
                assert_eq!(count, 0);
            }
        }
    }
}
