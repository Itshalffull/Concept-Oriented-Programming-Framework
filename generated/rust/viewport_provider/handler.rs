// generated: viewport_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ViewportProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ViewportProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderInitializeOutput, Box<dyn std::error::Error>>;

    async fn observe(
        &self,
        input: ViewportProviderObserveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderObserveOutput, Box<dyn std::error::Error>>;

    async fn get_breakpoint(
        &self,
        input: ViewportProviderGetBreakpointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderGetBreakpointOutput, Box<dyn std::error::Error>>;

    async fn set_breakpoints(
        &self,
        input: ViewportProviderSetBreakpointsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderSetBreakpointsOutput, Box<dyn std::error::Error>>;
}
