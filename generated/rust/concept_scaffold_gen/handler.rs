// generated: concept_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConceptScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: ConceptScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: ConceptScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: ConceptScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
