// generated: progressive_schema/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProgressiveSchemaHandler: Send + Sync {
    async fn capture_freeform(
        &self,
        input: ProgressiveSchemaCaptureFreeformInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaCaptureFreeformOutput, Box<dyn std::error::Error>>;

    async fn detect_structure(
        &self,
        input: ProgressiveSchemaDetectStructureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaDetectStructureOutput, Box<dyn std::error::Error>>;

    async fn accept_suggestion(
        &self,
        input: ProgressiveSchemaAcceptSuggestionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaAcceptSuggestionOutput, Box<dyn std::error::Error>>;

    async fn reject_suggestion(
        &self,
        input: ProgressiveSchemaRejectSuggestionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaRejectSuggestionOutput, Box<dyn std::error::Error>>;

    async fn promote(
        &self,
        input: ProgressiveSchemaPromoteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaPromoteOutput, Box<dyn std::error::Error>>;

    async fn infer_schema(
        &self,
        input: ProgressiveSchemaInferSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgressiveSchemaInferSchemaOutput, Box<dyn std::error::Error>>;

}
