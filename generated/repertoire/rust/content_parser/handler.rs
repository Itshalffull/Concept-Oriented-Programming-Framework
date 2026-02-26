// generated: content_parser/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContentParserHandler: Send + Sync {
    async fn register_format(
        &self,
        input: ContentParserRegisterFormatInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserRegisterFormatOutput, Box<dyn std::error::Error>>;

    async fn register_extractor(
        &self,
        input: ContentParserRegisterExtractorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserRegisterExtractorOutput, Box<dyn std::error::Error>>;

    async fn parse(
        &self,
        input: ContentParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserParseOutput, Box<dyn std::error::Error>>;

    async fn extract_refs(
        &self,
        input: ContentParserExtractRefsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserExtractRefsOutput, Box<dyn std::error::Error>>;

    async fn extract_tags(
        &self,
        input: ContentParserExtractTagsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserExtractTagsOutput, Box<dyn std::error::Error>>;

    async fn extract_properties(
        &self,
        input: ContentParserExtractPropertiesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserExtractPropertiesOutput, Box<dyn std::error::Error>>;

    async fn serialize(
        &self,
        input: ContentParserSerializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentParserSerializeOutput, Box<dyn std::error::Error>>;

}
