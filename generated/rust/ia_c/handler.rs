// generated: ia_c/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait IaCHandler: Send + Sync {
    async fn emit(
        &self,
        input: IaCEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCEmitOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: IaCPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCPreviewOutput, Box<dyn std::error::Error>>;

    async fn apply(
        &self,
        input: IaCApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCApplyOutput, Box<dyn std::error::Error>>;

    async fn detect_drift(
        &self,
        input: IaCDetectDriftInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCDetectDriftOutput, Box<dyn std::error::Error>>;

    async fn teardown(
        &self,
        input: IaCTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCTeardownOutput, Box<dyn std::error::Error>>;

}
