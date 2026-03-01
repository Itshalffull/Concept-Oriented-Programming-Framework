// generated: emitter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EmitterHandler: Send + Sync {
    async fn write(
        &self,
        input: EmitterWriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterWriteOutput, Box<dyn std::error::Error>>;

    async fn write_batch(
        &self,
        input: EmitterWriteBatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterWriteBatchOutput, Box<dyn std::error::Error>>;

    async fn format(
        &self,
        input: EmitterFormatInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterFormatOutput, Box<dyn std::error::Error>>;

    async fn clean(
        &self,
        input: EmitterCleanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterCleanOutput, Box<dyn std::error::Error>>;

    async fn manifest(
        &self,
        input: EmitterManifestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterManifestOutput, Box<dyn std::error::Error>>;

    async fn trace(
        &self,
        input: EmitterTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterTraceOutput, Box<dyn std::error::Error>>;

    async fn affected(
        &self,
        input: EmitterAffectedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterAffectedOutput, Box<dyn std::error::Error>>;

    async fn audit(
        &self,
        input: EmitterAuditInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EmitterAuditOutput, Box<dyn std::error::Error>>;

}
