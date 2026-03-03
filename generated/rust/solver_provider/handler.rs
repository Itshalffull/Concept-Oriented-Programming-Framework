// generated: solver_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SolverProviderHandler: Send + Sync {
    async fn register(
        &self,
        input: SolverProviderRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolverProviderRegisterOutput, Box<dyn std::error::Error>>;

    async fn dispatch(
        &self,
        input: SolverProviderDispatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolverProviderDispatchOutput, Box<dyn std::error::Error>>;

    async fn dispatch_batch(
        &self,
        input: SolverProviderDispatch_batchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolverProviderDispatch_batchOutput, Box<dyn std::error::Error>>;

    async fn health_check(
        &self,
        input: SolverProviderHealth_checkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolverProviderHealth_checkOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: SolverProviderListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolverProviderListOutput, Box<dyn std::error::Error>>;

    async fn unregister(
        &self,
        input: SolverProviderUnregisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolverProviderUnregisterOutput, Box<dyn std::error::Error>>;

}