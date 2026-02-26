// generated: backlink/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BacklinkHandler: Send + Sync {
    async fn get_backlinks(
        &self,
        input: BacklinkGetBacklinksInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BacklinkGetBacklinksOutput, Box<dyn std::error::Error>>;

    async fn get_unlinked_mentions(
        &self,
        input: BacklinkGetUnlinkedMentionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BacklinkGetUnlinkedMentionsOutput, Box<dyn std::error::Error>>;

    async fn reindex(
        &self,
        input: BacklinkReindexInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BacklinkReindexOutput, Box<dyn std::error::Error>>;

}
