// generated: process_run/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProcessRunHandler: Send + Sync {
    async fn start(
        &self,
        input: ProcessRunStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunStartOutput, Box<dyn std::error::Error>>;

    async fn start_child(
        &self,
        input: ProcessRunStartChildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunStartChildOutput, Box<dyn std::error::Error>>;

    async fn complete(
        &self,
        input: ProcessRunCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunCompleteOutput, Box<dyn std::error::Error>>;

    async fn fail(
        &self,
        input: ProcessRunFailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunFailOutput, Box<dyn std::error::Error>>;

    async fn cancel(
        &self,
        input: ProcessRunCancelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunCancelOutput, Box<dyn std::error::Error>>;

    async fn suspend(
        &self,
        input: ProcessRunSuspendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunSuspendOutput, Box<dyn std::error::Error>>;

    async fn resume(
        &self,
        input: ProcessRunResumeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunResumeOutput, Box<dyn std::error::Error>>;

    async fn get_status(
        &self,
        input: ProcessRunGetStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProcessRunGetStatusOutput, Box<dyn std::error::Error>>;
}
