// Notification -- multi-channel notification system with templates, subscriptions,
// delivery, read tracking, and per-user unread retrieval.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::NotificationHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("notif-{}", n)
}

pub struct NotificationHandlerImpl;

#[async_trait]
impl NotificationHandler for NotificationHandlerImpl {
    async fn register_channel(
        &self,
        input: NotificationRegisterChannelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationRegisterChannelOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("channel", &input.name).await?;
        if existing.is_some() {
            return Ok(NotificationRegisterChannelOutput::Exists {
                message: format!("Channel '{}' already exists", input.name),
            });
        }

        storage.put("channel", &input.name, json!({
            "name": input.name,
            "config": input.config,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(NotificationRegisterChannelOutput::Ok)
    }

    async fn define_template(
        &self,
        input: NotificationDefineTemplateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationDefineTemplateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("notification-template", &input.notification).await?;
        if existing.is_some() {
            return Ok(NotificationDefineTemplateOutput::Exists {
                message: format!("Template '{}' already exists", input.notification),
            });
        }

        storage.put("notification-template", &input.notification, json!({
            "notification": input.notification,
            "template": input.template,
        })).await?;

        Ok(NotificationDefineTemplateOutput::Ok)
    }

    async fn subscribe(
        &self,
        input: NotificationSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationSubscribeOutput, Box<dyn std::error::Error>> {
        let sub_key = format!("{}:{}:{}", input.user, input.event_type, input.channel);

        let existing = storage.get("subscription", &sub_key).await?;
        if existing.is_some() {
            return Ok(NotificationSubscribeOutput::Exists {
                message: format!("Subscription already exists for user '{}' on event '{}' via channel '{}'",
                    input.user, input.event_type, input.channel),
            });
        }

        storage.put("subscription", &sub_key, json!({
            "user": input.user,
            "eventType": input.event_type,
            "channel": input.channel,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(NotificationSubscribeOutput::Ok)
    }

    async fn unsubscribe(
        &self,
        input: NotificationUnsubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationUnsubscribeOutput, Box<dyn std::error::Error>> {
        let sub_key = format!("{}:{}:{}", input.user, input.event_type, input.channel);

        let existing = storage.get("subscription", &sub_key).await?;
        if existing.is_none() {
            return Ok(NotificationUnsubscribeOutput::Notfound {
                message: format!("Subscription not found for user '{}' on event '{}' via channel '{}'",
                    input.user, input.event_type, input.channel),
            });
        }

        storage.del("subscription", &sub_key).await?;

        Ok(NotificationUnsubscribeOutput::Ok)
    }

    async fn notify(
        &self,
        input: NotificationNotifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationNotifyOutput, Box<dyn std::error::Error>> {
        // Look up the template
        let template = storage.get("notification-template", &input.template).await?;
        if template.is_none() {
            return Ok(NotificationNotifyOutput::Error {
                message: format!("Template '{}' not found", input.template),
            });
        }

        // Find user subscriptions
        let all_subs = storage.find("subscription", None).await?;
        let user_subs: Vec<&serde_json::Value> = all_subs.iter()
            .filter(|sub| sub.get("user").and_then(|v| v.as_str()) == Some(&input.user))
            .collect();

        if user_subs.is_empty() {
            return Ok(NotificationNotifyOutput::Error {
                message: format!("No subscriptions found for user '{}'", input.user),
            });
        }

        // Create notification record
        let notif_id = if input.notification.is_empty() {
            next_id()
        } else {
            input.notification
        };

        storage.put("notification", &notif_id, json!({
            "notificationId": notif_id,
            "user": input.user,
            "template": input.template,
            "data": input.data,
            "read": false,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(NotificationNotifyOutput::Ok)
    }

    async fn mark_read(
        &self,
        input: NotificationMarkReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationMarkReadOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("notification", &input.notification).await?;
        let record = match existing {
            Some(r) => r,
            None => {
                return Ok(NotificationMarkReadOutput::Notfound {
                    message: format!("Notification '{}' not found", input.notification),
                });
            }
        };

        let mut updated = record.clone();
        updated["read"] = json!(true);
        storage.put("notification", &input.notification, updated).await?;

        Ok(NotificationMarkReadOutput::Ok)
    }

    async fn get_unread(
        &self,
        input: NotificationGetUnreadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NotificationGetUnreadOutput, Box<dyn std::error::Error>> {
        let all_notifications = storage.find("notification", None).await?;

        let unread: Vec<serde_json::Value> = all_notifications.into_iter()
            .filter(|notif| {
                notif.get("user").and_then(|v| v.as_str()) == Some(&input.user)
                    && notif.get("read").and_then(|v| v.as_bool()) == Some(false)
            })
            .map(|notif| {
                json!({
                    "notificationId": notif.get("notificationId").and_then(|v| v.as_str()).unwrap_or(""),
                    "template": notif.get("template").and_then(|v| v.as_str()).unwrap_or(""),
                    "data": notif.get("data").and_then(|v| v.as_str()).unwrap_or(""),
                    "createdAt": notif.get("createdAt").and_then(|v| v.as_str()).unwrap_or(""),
                })
            })
            .collect();

        Ok(NotificationGetUnreadOutput::Ok {
            notifications: serde_json::to_string(&unread)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_channel() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        let result = handler.register_channel(
            NotificationRegisterChannelInput { name: "email".into(), config: "{}".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationRegisterChannelOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_channel_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        handler.register_channel(
            NotificationRegisterChannelInput { name: "email".into(), config: "{}".into() },
            &storage,
        ).await.unwrap();
        let result = handler.register_channel(
            NotificationRegisterChannelInput { name: "email".into(), config: "{}".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationRegisterChannelOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_define_template() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        let result = handler.define_template(
            NotificationDefineTemplateInput { notification: "welcome".into(), template: "Hello {{name}}".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationDefineTemplateOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_template_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        handler.define_template(
            NotificationDefineTemplateInput { notification: "welcome".into(), template: "Hi".into() },
            &storage,
        ).await.unwrap();
        let result = handler.define_template(
            NotificationDefineTemplateInput { notification: "welcome".into(), template: "Hi".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationDefineTemplateOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_subscribe() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        let result = handler.subscribe(
            NotificationSubscribeInput { user: "alice".into(), event_type: "comment".into(), channel: "email".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationSubscribeOutput::Ok => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_subscribe_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        handler.subscribe(
            NotificationSubscribeInput { user: "alice".into(), event_type: "comment".into(), channel: "email".into() },
            &storage,
        ).await.unwrap();
        let result = handler.subscribe(
            NotificationSubscribeInput { user: "alice".into(), event_type: "comment".into(), channel: "email".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationSubscribeOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_unsubscribe_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        let result = handler.unsubscribe(
            NotificationUnsubscribeInput { user: "bob".into(), event_type: "x".into(), channel: "y".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationUnsubscribeOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_notify_template_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        let result = handler.notify(
            NotificationNotifyInput {
                notification: "".into(), user: "alice".into(),
                template: "missing".into(), data: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NotificationNotifyOutput::Error { message } => {
                assert!(message.contains("not found"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_mark_read_not_found() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        let result = handler.mark_read(
            NotificationMarkReadInput { notification: "ghost".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationMarkReadOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_unread_empty() {
        let storage = InMemoryStorage::new();
        let handler = NotificationHandlerImpl;
        let result = handler.get_unread(
            NotificationGetUnreadInput { user: "bob".into() },
            &storage,
        ).await.unwrap();
        match result {
            NotificationGetUnreadOutput::Ok { notifications } => {
                assert_eq!(notifications, "[]");
            }
        }
    }
}
