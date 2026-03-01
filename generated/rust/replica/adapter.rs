// generated: replica/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ReplicaHandler;
use super::types::*;

pub struct ReplicaAdapter<H: ReplicaHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ReplicaHandler> ReplicaAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ReplicaHandler + 'static> ConceptTransport for ReplicaAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "localUpdate" => {
                let input: ReplicaLocalUpdateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.local_update(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "receiveRemote" => {
                let input: ReplicaReceiveRemoteInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.receive_remote(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "sync" => {
                let input: ReplicaSyncInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.sync(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getState" => {
                let input: ReplicaGetStateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_state(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "fork" => {
                let input: ReplicaForkInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.fork(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "addPeer" => {
                let input: ReplicaAddPeerInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.add_peer(input, self.storage.as_ref()).await?;
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
