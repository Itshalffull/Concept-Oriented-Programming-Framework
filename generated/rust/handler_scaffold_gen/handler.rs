// generated: handler_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait HandlerScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: HandlerScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HandlerScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: HandlerScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HandlerScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: HandlerScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HandlerScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
