// generated: notification/adapter.rs

use serde_json::Value;
use crate::transport::{
    ActionInvocation, ActionCompletion,
    ConceptTransport, ConceptQuery,
};
use crate::storage::ConceptStorage;
use super::handler::NotificationHandler;
use super::types::*;

pub struct NotificationAdapter<H: NotificationHandler> {
    handler: H,
    storage: Box<dyn ConceptStorage>,
}

impl<H: NotificationHandler> NotificationAdapter<H> {
    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {
        Self { handler, storage }
    }
}

#[async_trait::async_trait]
impl<H: NotificationHandler + 'static> ConceptTransport for NotificationAdapter<H> {
    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {
        let result: Value = match invocation.action.as_str() {
            "registerChannel" => {
                let input: NotificationRegisterChannelInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.register_channel(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "defineTemplate" => {
                let input: NotificationDefineTemplateInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.define_template(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "subscribe" => {
                let input: NotificationSubscribeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.subscribe(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "unsubscribe" => {
                let input: NotificationUnsubscribeInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.unsubscribe(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "notify" => {
                let input: NotificationNotifyInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.notify(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "markRead" => {
                let input: NotificationMarkReadInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.mark_read(input, self.storage.as_ref()).await?;
                serde_json::to_value(output)?
            },
            "getUnread" => {
                let input: NotificationGetUnreadInput = serde_json::from_value(invocation.input.clone())?;
                let output = self.handler.get_unread(input, self.storage.as_ref()).await?;
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
