// generated: runtime_coverage/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::RuntimeCoverageHandler;
use super::types::*;

pub struct RuntimeCoverageAdapter<H: RuntimeCoverageHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: RuntimeCoverageHandler> RuntimeCoverageAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: RuntimeCoverageHandler + 'static> ConceptTransport for RuntimeCoverageAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "record" => {
                let input: RuntimeCoverageRecordInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.record(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "coverageReport" => {
                let input: RuntimeCoverageCoverageReportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.coverage_report(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "variantCoverage" => {
                let input: RuntimeCoverageVariantCoverageInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.variant_coverage(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "syncCoverage" => {
                let input: RuntimeCoverageSyncCoverageInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.sync_coverage(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "widgetStateCoverage" => {
                let input: RuntimeCoverageWidgetStateCoverageInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.widget_state_coverage(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "widgetLifecycleReport" => {
                let input: RuntimeCoverageWidgetLifecycleReportInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.widget_lifecycle_report(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "widgetRenderTrace" => {
                let input: RuntimeCoverageWidgetRenderTraceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.widget_render_trace(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "widgetComparison" => {
                let input: RuntimeCoverageWidgetComparisonInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.widget_comparison(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "deadAtRuntime" => {
                let input: RuntimeCoverageDeadAtRuntimeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dead_at_runtime(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            _ => return Err(format!("Unknown action: {}", invocation.action).into()),
        };

        let variant = result.get("variant")
            .and_then(|v| v.as_str())
            .unwrap_or("ok")
            .to_string();

        Ok(ActionCompletion {
            id: invocation.id,
            concept: invocation.concept,
            action: invocation.action,
            input: invocation.input,
            variant,
            output: result,
            flow: invocation.flow,
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn query(&self, request: ConceptQuery) -> Result<Vec<Value>, Box<dyn std::error::Error>> {
        self.storage.find(&request.relation, request.args.as_ref()).await
    }

    async fn health(&self) -> Result<(bool, u64), Box<dyn std::error::Error>> {
        Ok((true, 0))
    }
}
