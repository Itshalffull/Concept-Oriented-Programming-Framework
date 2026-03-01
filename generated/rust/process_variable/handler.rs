// generated: process_variable/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProcessVariableHandler: Send + Sync {
    async fn set(
        &self,
        input: ProcessVariableSetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableSetOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ProcessVariableGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableGetOutput, Box<dyn std::error::Error>>;

    async fn merge(
        &self,
        input: ProcessVariableMergeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableMergeOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: ProcessVariableDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableDeleteOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: ProcessVariableListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableListOutput, Box<dyn std::error::Error>>;

    async fn snapshot(
        &self,
        input: ProcessVariableSnapshotInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessVariableSnapshotOutput, Box<dyn std::error::Error>>;
}
