// generated: signature/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::SignatureHandler;
use super::types::*;

pub struct SignatureAdapter<H: SignatureHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: SignatureHandler> SignatureAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: SignatureHandler + 'static> ConceptTransport for SignatureAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "sign" => {
                let input: SignatureSignInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.sign(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "verify" => {
                let input: SignatureVerifyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.verify(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "timestamp" => {
                let input: SignatureTimestampInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.timestamp(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addTrustedSigner" => {
                let input: SignatureAddTrustedSignerInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_trusted_signer(input, self.storage.as_ref()).await?;
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
