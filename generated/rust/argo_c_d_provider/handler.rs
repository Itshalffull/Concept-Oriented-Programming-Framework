// generated: argo_c_d_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ArgoCDProviderHandler: Send + Sync {
    async fn emit(
        &self,
        input: ArgoCDProviderEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArgoCDProviderEmitOutput, Box<dyn std::error::Error>>;

    async fn reconciliation_status(
        &self,
        input: ArgoCDProviderReconciliationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArgoCDProviderReconciliationStatusOutput, Box<dyn std::error::Error>>;

    async fn sync_wave(
        &self,
        input: ArgoCDProviderSyncWaveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArgoCDProviderSyncWaveOutput, Box<dyn std::error::Error>>;

}
