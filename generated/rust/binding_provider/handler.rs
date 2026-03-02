// generated: binding_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait BindingProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: BindingProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderInitializeOutput, Box<dyn std::error::Error>>;

    async fn bind(
        &self,
        input: BindingProviderBindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderBindOutput, Box<dyn std::error::Error>>;

    async fn sync(
        &self,
        input: BindingProviderSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderSyncOutput, Box<dyn std::error::Error>>;

    async fn invoke(
        &self,
        input: BindingProviderInvokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderInvokeOutput, Box<dyn std::error::Error>>;

    async fn unbind(
        &self,
        input: BindingProviderUnbindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BindingProviderUnbindOutput, Box<dyn std::error::Error>>;
}
