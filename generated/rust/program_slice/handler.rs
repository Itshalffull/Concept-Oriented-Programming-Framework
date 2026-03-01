// generated: program_slice/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProgramSliceHandler: Send + Sync {
    async fn compute(
        &self,
        input: ProgramSliceComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceComputeOutput, Box<dyn std::error::Error>>;

    async fn files_in_slice(
        &self,
        input: ProgramSliceFilesInSliceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceFilesInSliceOutput, Box<dyn std::error::Error>>;

    async fn symbols_in_slice(
        &self,
        input: ProgramSliceSymbolsInSliceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceSymbolsInSliceOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ProgramSliceGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProgramSliceGetOutput, Box<dyn std::error::Error>>;

}
