// generated: spec_parser/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SpecParserHandler: Send + Sync {
    async fn parse(
        &self,
        input: SpecParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecParserParseOutput, Box<dyn std::error::Error>>;

}
