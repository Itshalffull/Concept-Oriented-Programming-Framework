// generated: generator/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GeneratorHandler: Send + Sync {
    async fn plan(
        &self,
        input: GeneratorPlanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GeneratorPlanOutput, Box<dyn std::error::Error>>;

    async fn generate(
        &self,
        input: GeneratorGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GeneratorGenerateOutput, Box<dyn std::error::Error>>;

    async fn regenerate(
        &self,
        input: GeneratorRegenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GeneratorRegenerateOutput, Box<dyn std::error::Error>>;

}
