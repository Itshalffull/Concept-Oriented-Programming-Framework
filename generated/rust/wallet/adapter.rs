// generated: wallet/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::WalletHandler;
use super::types::*;

pub struct WalletAdapter<H: WalletHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: WalletHandler> WalletAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: WalletHandler + 'static> ConceptTransport for WalletAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "verify" => {
                let input: WalletVerifyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.verify(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "verifyTypedData" => {
                let input: WalletVerifyTypedDataInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.verify_typed_data(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getNonce" => {
                let input: WalletGetNonceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_nonce(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "incrementNonce" => {
                let input: WalletIncrementNonceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.increment_nonce(input, self.storage.as_ref()).await?;
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
