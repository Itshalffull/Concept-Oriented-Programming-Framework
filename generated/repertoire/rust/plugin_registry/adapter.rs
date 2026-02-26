// generated: plugin_registry/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::PluginRegistryHandler;
use super::types::*;

pub struct PluginRegistryAdapter<H: PluginRegistryHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: PluginRegistryHandler> PluginRegistryAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: PluginRegistryHandler + 'static> ConceptTransport for PluginRegistryAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "discover" => {
                let input: PluginRegistryDiscoverInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.discover(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "createInstance" => {
                let input: PluginRegistryCreateInstanceInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.create_instance(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getDefinitions" => {
                let input: PluginRegistryGetDefinitionsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_definitions(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "alterDefinitions" => {
                let input: PluginRegistryAlterDefinitionsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.alter_definitions(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "derivePlugins" => {
                let input: PluginRegistryDerivePluginsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.derive_plugins(input, self.storage.as_ref()).await?;
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
