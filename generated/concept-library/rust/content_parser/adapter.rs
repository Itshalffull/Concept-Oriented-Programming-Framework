// generated: content_parser/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ContentParserHandler;
use super::types::*;

pub struct ContentParserAdapter<H: ContentParserHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ContentParserHandler> ContentParserAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ContentParserHandler + 'static> ConceptTransport for ContentParserAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "registerFormat" => {
                let input: ContentParserRegisterFormatInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_format(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "registerExtractor" => {
                let input: ContentParserRegisterExtractorInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_extractor(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "parse" => {
                let input: ContentParserParseInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.parse(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "extractRefs" => {
                let input: ContentParserExtractRefsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.extract_refs(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "extractTags" => {
                let input: ContentParserExtractTagsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.extract_tags(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "extractProperties" => {
                let input: ContentParserExtractPropertiesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.extract_properties(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "serialize" => {
                let input: ContentParserSerializeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.serialize(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            _ => return Err(format!("Unknown action: {}", invocation.action).into()),
        };

        let variant = result.get("variant")
            .and_then(|v| v.as_str())
            .unwrap_or("ok")
            .to_string();

        Ok(ActionCompletion {
            id: invocation.id,
            concept: invocation.concept,
            action: invocation.action,
            input: invocation.input,
            variant,
            output: result,
            flow: invocation.flow,
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn query(&self, request: ConceptQuery) -> Result<Vec<Value>, Box<dyn std::error::Error>> {
        self.storage.find(&request.relation, request.args.as_ref()).await
    }

    async fn health(&self) -> Result<(bool, u64), Box<dyn std::error::Error>> {
        Ok((true, 0))
    }
}
