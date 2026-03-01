// generated: runtime_coverage/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RuntimeCoverageHandler: Send + Sync {
    async fn record(
        &self,
        input: RuntimeCoverageRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageRecordOutput, Box<dyn std::error::Error>>;

    async fn coverage_report(
        &self,
        input: RuntimeCoverageCoverageReportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageCoverageReportOutput, Box<dyn std::error::Error>>;

    async fn variant_coverage(
        &self,
        input: RuntimeCoverageVariantCoverageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageVariantCoverageOutput, Box<dyn std::error::Error>>;

    async fn sync_coverage(
        &self,
        input: RuntimeCoverageSyncCoverageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageSyncCoverageOutput, Box<dyn std::error::Error>>;

    async fn widget_state_coverage(
        &self,
        input: RuntimeCoverageWidgetStateCoverageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetStateCoverageOutput, Box<dyn std::error::Error>>;

    async fn widget_lifecycle_report(
        &self,
        input: RuntimeCoverageWidgetLifecycleReportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetLifecycleReportOutput, Box<dyn std::error::Error>>;

    async fn widget_render_trace(
        &self,
        input: RuntimeCoverageWidgetRenderTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetRenderTraceOutput, Box<dyn std::error::Error>>;

    async fn widget_comparison(
        &self,
        input: RuntimeCoverageWidgetComparisonInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageWidgetComparisonOutput, Box<dyn std::error::Error>>;

    async fn dead_at_runtime(
        &self,
        input: RuntimeCoverageDeadAtRuntimeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeCoverageDeadAtRuntimeOutput, Box<dyn std::error::Error>>;

}
