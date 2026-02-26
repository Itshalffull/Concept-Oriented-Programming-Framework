// generated: notification/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait NotificationHandler: Send + Sync {
    async fn register_channel(
        &self,
        input: NotificationRegisterChannelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationRegisterChannelOutput, Box<dyn std::error::Error>>;

    async fn define_template(
        &self,
        input: NotificationDefineTemplateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationDefineTemplateOutput, Box<dyn std::error::Error>>;

    async fn subscribe(
        &self,
        input: NotificationSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationSubscribeOutput, Box<dyn std::error::Error>>;

    async fn unsubscribe(
        &self,
        input: NotificationUnsubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationUnsubscribeOutput, Box<dyn std::error::Error>>;

    async fn notify(
        &self,
        input: NotificationNotifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationNotifyOutput, Box<dyn std::error::Error>>;

    async fn mark_read(
        &self,
        input: NotificationMarkReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationMarkReadOutput, Box<dyn std::error::Error>>;

    async fn get_unread(
        &self,
        input: NotificationGetUnreadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationGetUnreadOutput, Box<dyn std::error::Error>>;

}
