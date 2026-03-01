// generated: capture/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CaptureHandler: Send + Sync {
    async fn clip(
        &self,
        input: CaptureClipInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureClipOutput, Box<dyn std::error::Error>>;

    async fn import(
        &self,
        input: CaptureImportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureImportOutput, Box<dyn std::error::Error>>;

    async fn subscribe(
        &self,
        input: CaptureSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureSubscribeOutput, Box<dyn std::error::Error>>;

    async fn detect_changes(
        &self,
        input: CaptureDetectChangesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureDetectChangesOutput, Box<dyn std::error::Error>>;

    async fn mark_ready(
        &self,
        input: CaptureMarkReadyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CaptureMarkReadyOutput, Box<dyn std::error::Error>>;

}
