// generated: telemetry/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TelemetryHandler: Send + Sync {
    async fn configure(
        &self,
        input: TelemetryConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryConfigureOutput, Box<dyn std::error::Error>>;

    async fn deploy_marker(
        &self,
        input: TelemetryDeployMarkerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryDeployMarkerOutput, Box<dyn std::error::Error>>;

    async fn analyze(
        &self,
        input: TelemetryAnalyzeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TelemetryAnalyzeOutput, Box<dyn std::error::Error>>;

}
