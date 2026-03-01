// generated: theme_parser/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ThemeParserHandler: Send + Sync {
    async fn parse(
        &self,
        input: ThemeParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeParserParseOutput, Box<dyn std::error::Error>>;

    async fn check_contrast(
        &self,
        input: ThemeParserCheckContrastInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeParserCheckContrastOutput, Box<dyn std::error::Error>>;

}
