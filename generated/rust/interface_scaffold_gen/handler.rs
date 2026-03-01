// generated: interface_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait InterfaceScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: InterfaceScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InterfaceScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: InterfaceScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InterfaceScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: InterfaceScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InterfaceScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
