// generated: retention_policy/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::RetentionPolicyHandler;
use super::types::*;

pub struct RetentionPolicyAdapter<H: RetentionPolicyHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: RetentionPolicyHandler> RetentionPolicyAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: RetentionPolicyHandler + 'static> ConceptTransport for RetentionPolicyAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "setRetention" => {
                let input: RetentionPolicySetRetentionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.set_retention(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "applyHold" => {
                let input: RetentionPolicyApplyHoldInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.apply_hold(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "releaseHold" => {
                let input: RetentionPolicyReleaseHoldInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.release_hold(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "checkDisposition" => {
                let input: RetentionPolicyCheckDispositionInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check_disposition(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "dispose" => {
                let input: RetentionPolicyDisposeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.dispose(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "auditLog" => {
                let input: RetentionPolicyAuditLogInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.audit_log(input, self.storage.as_ref()).await?;
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
