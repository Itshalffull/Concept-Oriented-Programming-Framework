// generated: elevation/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ElevationHandler: Send + Sync {
    async fn define(
        &self,
        input: ElevationDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElevationDefineOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ElevationGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElevationGetOutput, Box<dyn std::error::Error>>;

    async fn generate_scale(
        &self,
        input: ElevationGenerateScaleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElevationGenerateScaleOutput, Box<dyn std::error::Error>>;

}
