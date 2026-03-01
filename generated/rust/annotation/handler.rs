// generated: annotation/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AnnotationHandler: Send + Sync {
    async fn annotate(
        &self,
        input: AnnotationAnnotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnnotationAnnotateOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: AnnotationResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnnotationResolveOutput, Box<dyn std::error::Error>>;

}
