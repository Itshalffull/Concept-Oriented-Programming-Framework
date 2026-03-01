// generated: host/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait HostHandler: Send + Sync {
    async fn mount(
        &self,
        input: HostMountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostMountOutput, Box<dyn std::error::Error>>;

    async fn ready(
        &self,
        input: HostReadyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostReadyOutput, Box<dyn std::error::Error>>;

    async fn track_resource(
        &self,
        input: HostTrackResourceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostTrackResourceOutput, Box<dyn std::error::Error>>;

    async fn unmount(
        &self,
        input: HostUnmountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostUnmountOutput, Box<dyn std::error::Error>>;

    async fn refresh(
        &self,
        input: HostRefreshInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostRefreshOutput, Box<dyn std::error::Error>>;

    async fn set_error(
        &self,
        input: HostSetErrorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostSetErrorOutput, Box<dyn std::error::Error>>;

}
