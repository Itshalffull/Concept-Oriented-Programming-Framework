// generated: evaluation_run/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::EvaluationRunHandler;
use super::types::*;

pub struct EvaluationRunAdapter<H: EvaluationRunHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: EvaluationRunHandler> EvaluationRunAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: EvaluationRunHandler + 'static> ConceptTransport for EvaluationRunAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "run_eval" => {
                let input: EvaluationRunRunEvalInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.run_eval(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "log_metric" => {
                let input: EvaluationRunLogMetricInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.log_metric(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "pass" => {
                let input: EvaluationRunPassInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.pass(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "fail" => {
                let input: EvaluationRunFailInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.fail(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get_result" => {
                let input: EvaluationRunGetResultInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_result(input, self.storage.as_ref()).await?;
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
