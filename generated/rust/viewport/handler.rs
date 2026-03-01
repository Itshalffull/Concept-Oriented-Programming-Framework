// generated: viewport/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ViewportHandler: Send + Sync {
    async fn observe(
        &self,
        input: ViewportObserveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportObserveOutput, Box<dyn std::error::Error>>;

    async fn set_breakpoints(
        &self,
        input: ViewportSetBreakpointsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportSetBreakpointsOutput, Box<dyn std::error::Error>>;

    async fn get_breakpoint(
        &self,
        input: ViewportGetBreakpointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportGetBreakpointOutput, Box<dyn std::error::Error>>;

}
