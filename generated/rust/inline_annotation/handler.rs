// generated: inline_annotation/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait InlineAnnotationHandler: Send + Sync {
    async fn annotate(
        &self,
        input: InlineAnnotationAnnotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationAnnotateOutput, Box<dyn std::error::Error>>;

    async fn accept(
        &self,
        input: InlineAnnotationAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationAcceptOutput, Box<dyn std::error::Error>>;

    async fn reject(
        &self,
        input: InlineAnnotationRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationRejectOutput, Box<dyn std::error::Error>>;

    async fn accept_all(
        &self,
        input: InlineAnnotationAcceptAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationAcceptAllOutput, Box<dyn std::error::Error>>;

    async fn reject_all(
        &self,
        input: InlineAnnotationRejectAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationRejectAllOutput, Box<dyn std::error::Error>>;

    async fn toggle_tracking(
        &self,
        input: InlineAnnotationToggleTrackingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationToggleTrackingOutput, Box<dyn std::error::Error>>;

    async fn list_pending(
        &self,
        input: InlineAnnotationListPendingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InlineAnnotationListPendingOutput, Box<dyn std::error::Error>>;

}
