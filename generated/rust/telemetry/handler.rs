// generated: telemetry/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TelemetryHandler: Send + Sync {
    async fn export(
        &self,
        input: TelemetryExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryExportOutput, Box<dyn std::error::Error>>;

    async fn configure(
        &self,
        input: TelemetryConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryConfigureOutput, Box<dyn std::error::Error>>;

}
