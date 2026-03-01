// generated: vault_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VaultProviderHandler: Send + Sync {
    async fn fetch(
        &self,
        input: VaultProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VaultProviderFetchOutput, Box<dyn std::error::Error>>;

    async fn renew_lease(
        &self,
        input: VaultProviderRenewLeaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VaultProviderRenewLeaseOutput, Box<dyn std::error::Error>>;

    async fn rotate(
        &self,
        input: VaultProviderRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VaultProviderRotateOutput, Box<dyn std::error::Error>>;

}
