// generated: kit_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait KitScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: KitScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: KitScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: KitScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
