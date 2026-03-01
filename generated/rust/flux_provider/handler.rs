// generated: flux_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FluxProviderHandler: Send + Sync {
    async fn emit(
        &self,
        input: FluxProviderEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FluxProviderEmitOutput, Box<dyn std::error::Error>>;

    async fn reconciliation_status(
        &self,
        input: FluxProviderReconciliationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FluxProviderReconciliationStatusOutput, Box<dyn std::error::Error>>;

    async fn helm_release(
        &self,
        input: FluxProviderHelmReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FluxProviderHelmReleaseOutput, Box<dyn std::error::Error>>;

}
