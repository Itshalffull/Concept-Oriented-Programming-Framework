// generated: framework_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FrameworkAdapterHandler: Send + Sync {
    async fn register(
        &self,
        input: FrameworkAdapterRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterRegisterOutput, Box<dyn std::error::Error>>;

    async fn normalize(
        &self,
        input: FrameworkAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterNormalizeOutput, Box<dyn std::error::Error>>;

    async fn mount(
        &self,
        input: FrameworkAdapterMountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterMountOutput, Box<dyn std::error::Error>>;

    async fn render(
        &self,
        input: FrameworkAdapterRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterRenderOutput, Box<dyn std::error::Error>>;

    async fn unmount(
        &self,
        input: FrameworkAdapterUnmountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterUnmountOutput, Box<dyn std::error::Error>>;

}
