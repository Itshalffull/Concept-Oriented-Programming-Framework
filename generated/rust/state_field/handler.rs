// generated: state_field/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait StateFieldHandler: Send + Sync {
    async fn register(
        &self,
        input: StateFieldRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldRegisterOutput, Box<dyn std::error::Error>>;

    async fn find_by_concept(
        &self,
        input: StateFieldFindByConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldFindByConceptOutput, Box<dyn std::error::Error>>;

    async fn trace_to_generated(
        &self,
        input: StateFieldTraceToGeneratedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldTraceToGeneratedOutput, Box<dyn std::error::Error>>;

    async fn trace_to_storage(
        &self,
        input: StateFieldTraceToStorageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldTraceToStorageOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: StateFieldGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StateFieldGetOutput, Box<dyn std::error::Error>>;

}
