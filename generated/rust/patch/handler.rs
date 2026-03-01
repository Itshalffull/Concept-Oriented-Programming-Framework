// generated: patch/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PatchHandler: Send + Sync {
    async fn create(
        &self,
        input: PatchCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchCreateOutput, Box<dyn std::error::Error>>;

    async fn apply(
        &self,
        input: PatchApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchApplyOutput, Box<dyn std::error::Error>>;

    async fn invert(
        &self,
        input: PatchInvertInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchInvertOutput, Box<dyn std::error::Error>>;

    async fn compose(
        &self,
        input: PatchComposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchComposeOutput, Box<dyn std::error::Error>>;

    async fn commute(
        &self,
        input: PatchCommuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatchCommuteOutput, Box<dyn std::error::Error>>;

}
