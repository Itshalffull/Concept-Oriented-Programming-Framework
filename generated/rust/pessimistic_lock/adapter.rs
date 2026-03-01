// generated: pessimistic_lock/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::PessimisticLockHandler;
use super::types::*;

pub struct PessimisticLockAdapter<H: PessimisticLockHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: PessimisticLockHandler> PessimisticLockAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: PessimisticLockHandler + 'static> ConceptTransport for PessimisticLockAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "checkOut" => {
                let input: PessimisticLockCheckOutInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check_out(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "checkIn" => {
                let input: PessimisticLockCheckInInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.check_in(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "breakLock" => {
                let input: PessimisticLockBreakLockInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.break_lock(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "renew" => {
                let input: PessimisticLockRenewInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.renew(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "queryLocks" => {
                let input: PessimisticLockQueryLocksInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query_locks(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "queryQueue" => {
                let input: PessimisticLockQueryQueueInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.query_queue(input, self.storage.as_ref()).await?;
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
