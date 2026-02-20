// generated: sync_parser/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncParserHandler: Send + Sync {
    async fn parse(
        &self,
        input: SyncParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncParserParseOutput, Box<dyn std::error::Error>>;

}
