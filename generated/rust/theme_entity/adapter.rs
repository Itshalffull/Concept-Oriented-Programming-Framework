// generated: theme_entity/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::ThemeEntityHandler;
use super::types::*;

pub struct ThemeEntityAdapter<H: ThemeEntityHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: ThemeEntityHandler> ThemeEntityAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: ThemeEntityHandler + 'static> ConceptTransport for ThemeEntityAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "register" => {
                let input: ThemeEntityRegisterInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "get" => {
                let input: ThemeEntityGetInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "resolveToken" => {
                let input: ThemeEntityResolveTokenInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.resolve_token(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "contrastAudit" => {
                let input: ThemeEntityContrastAuditInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.contrast_audit(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "diffThemes" => {
                let input: ThemeEntityDiffThemesInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.diff_themes(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "affectedWidgets" => {
                let input: ThemeEntityAffectedWidgetsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.affected_widgets(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "generatedOutputs" => {
                let input: ThemeEntityGeneratedOutputsInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.generated_outputs(input, self.storage.as_ref()).await?;
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
