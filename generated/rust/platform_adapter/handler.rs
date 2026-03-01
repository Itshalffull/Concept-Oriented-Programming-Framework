// generated: platform_adapter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PlatformAdapterHandler: Send + Sync {
    async fn register(
        &self,
        input: PlatformAdapterRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterRegisterOutput, Box<dyn std::error::Error>>;

    async fn map_navigation(
        &self,
        input: PlatformAdapterMapNavigationInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterMapNavigationOutput, Box<dyn std::error::Error>>;

    async fn map_zone(
        &self,
        input: PlatformAdapterMapZoneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterMapZoneOutput, Box<dyn std::error::Error>>;

    async fn handle_platform_event(
        &self,
        input: PlatformAdapterHandlePlatformEventInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PlatformAdapterHandlePlatformEventOutput, Box<dyn std::error::Error>>;

}
