// generated: coif_component_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CoifComponentScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: CoifComponentScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifComponentScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: CoifComponentScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifComponentScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: CoifComponentScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifComponentScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
