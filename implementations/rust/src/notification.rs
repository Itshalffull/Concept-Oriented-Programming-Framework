// Notification Concept Implementation (Rust)
//
// Notification kit — registers delivery channels, manages user
// subscriptions to event patterns, sends notifications, marks them
// read, and retrieves unread notifications.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── RegisterChannel ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRegisterChannelInput {
    pub channel_id: String,
    pub delivery_config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum NotificationRegisterChannelOutput {
    #[serde(rename = "ok")]
    Ok { channel_id: String },
}

// ── Subscribe ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSubscribeInput {
    pub user_id: String,
    pub event_pattern: String,
    pub channel_ids: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum NotificationSubscribeOutput {
    #[serde(rename = "ok")]
    Ok {
        user_id: String,
        event_pattern: String,
    },
}

// ── Notify ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationNotifyInput {
    pub user_id: String,
    pub event_type: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum NotificationNotifyOutput {
    #[serde(rename = "ok")]
    Ok { notification_id: String },
}

// ── MarkRead ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationMarkReadInput {
    pub notification_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum NotificationMarkReadOutput {
    #[serde(rename = "ok")]
    Ok { notification_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── GetUnread ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationGetUnreadInput {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum NotificationGetUnreadOutput {
    #[serde(rename = "ok")]
    Ok {
        user_id: String,
        notifications: String,
    },
}

// ── Handler ───────────────────────────────────────────────

pub struct NotificationHandler;

impl NotificationHandler {
    pub async fn register_channel(
        &self,
        input: NotificationRegisterChannelInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<NotificationRegisterChannelOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "notification_channel",
                &input.channel_id,
                json!({
                    "channel_id": input.channel_id,
                    "delivery_config": input.delivery_config,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(NotificationRegisterChannelOutput::Ok {
            channel_id: input.channel_id,
        })
    }

    pub async fn subscribe(
        &self,
        input: NotificationSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<NotificationSubscribeOutput> {
        let key = format!("{}:{}", input.user_id, input.event_pattern);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "notification_subscription",
                &key,
                json!({
                    "user_id": input.user_id,
                    "event_pattern": input.event_pattern,
                    "channel_ids": input.channel_ids,
                    "subscribed_at": now,
                }),
            )
            .await?;
        Ok(NotificationSubscribeOutput::Ok {
            user_id: input.user_id,
            event_pattern: input.event_pattern,
        })
    }

    pub async fn notify(
        &self,
        input: NotificationNotifyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<NotificationNotifyOutput> {
        let notification_id = format!("notif_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "notification_inbox",
                &notification_id,
                json!({
                    "notification_id": notification_id,
                    "user_id": input.user_id,
                    "event_type": input.event_type,
                    "context": input.context,
                    "read": false,
                    "created_at": now,
                }),
            )
            .await?;
        Ok(NotificationNotifyOutput::Ok { notification_id })
    }

    pub async fn mark_read(
        &self,
        input: NotificationMarkReadInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<NotificationMarkReadOutput> {
        let existing = storage
            .get("notification_inbox", &input.notification_id)
            .await?;
        match existing {
            None => Ok(NotificationMarkReadOutput::NotFound {
                message: format!("notification '{}' not found", input.notification_id),
            }),
            Some(mut record) => {
                record["read"] = json!(true);
                record["read_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("notification_inbox", &input.notification_id, record)
                    .await?;
                Ok(NotificationMarkReadOutput::Ok {
                    notification_id: input.notification_id,
                })
            }
        }
    }

    pub async fn get_unread(
        &self,
        input: NotificationGetUnreadInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<NotificationGetUnreadOutput> {
        let criteria = json!({
            "user_id": input.user_id,
            "read": false,
        });
        let unread = storage
            .find("notification_inbox", Some(&criteria))
            .await?;
        let notifications = serde_json::to_string(&unread)?;
        Ok(NotificationGetUnreadOutput::Ok {
            user_id: input.user_id,
            notifications,
        })
    }
}
