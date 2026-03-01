// generated: surface/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SurfaceHandler: Send + Sync {
    async fn create(
        &self,
        input: SurfaceCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceCreateOutput, Box<dyn std::error::Error>>;

    async fn attach(
        &self,
        input: SurfaceAttachInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceAttachOutput, Box<dyn std::error::Error>>;

    async fn resize(
        &self,
        input: SurfaceResizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceResizeOutput, Box<dyn std::error::Error>>;

    async fn mount(
        &self,
        input: SurfaceMountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceMountOutput, Box<dyn std::error::Error>>;

    async fn unmount(
        &self,
        input: SurfaceUnmountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceUnmountOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: SurfaceDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SurfaceDestroyOutput, Box<dyn std::error::Error>>;

}
