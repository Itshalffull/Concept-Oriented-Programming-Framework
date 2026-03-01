// generated: widget_parser/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetParserHandler: Send + Sync {
    async fn parse(
        &self,
        input: WidgetParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetParserParseOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: WidgetParserValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetParserValidateOutput, Box<dyn std::error::Error>>;

}
