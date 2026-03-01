// generated: transport_adapter_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TransportAdapterScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: TransportAdapterScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportAdapterScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: TransportAdapterScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportAdapterScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: TransportAdapterScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TransportAdapterScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
