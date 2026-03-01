// generated: webhook_inbox/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WebhookInboxHandler: Send + Sync {
    async fn register(
        &self,
        input: WebhookInboxRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxRegisterOutput, Box<dyn std::error::Error>>;

    async fn receive(
        &self,
        input: WebhookInboxReceiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxReceiveOutput, Box<dyn std::error::Error>>;

    async fn expire(
        &self,
        input: WebhookInboxExpireInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxExpireOutput, Box<dyn std::error::Error>>;

    async fn ack(
        &self,
        input: WebhookInboxAckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WebhookInboxAckOutput, Box<dyn std::error::Error>>;
}
