// generated: syntax_tree/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyntaxTreeHandler: Send + Sync {
    async fn parse(
        &self,
        input: SyntaxTreeParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeParseOutput, Box<dyn std::error::Error>>;

    async fn reparse(
        &self,
        input: SyntaxTreeReparseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeReparseOutput, Box<dyn std::error::Error>>;

    async fn query(
        &self,
        input: SyntaxTreeQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeQueryOutput, Box<dyn std::error::Error>>;

    async fn node_at(
        &self,
        input: SyntaxTreeNodeAtInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeNodeAtOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: SyntaxTreeGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeGetOutput, Box<dyn std::error::Error>>;

}
