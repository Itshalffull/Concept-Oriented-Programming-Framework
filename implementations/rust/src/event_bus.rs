// EventBus Concept Implementation (Rust)
//
// Infrastructure kit — registers event types, subscribes/unsubscribes
// listeners with priority, dispatches events to listeners, and
// retrieves event history.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── RegisterEventType ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBusRegisterEventTypeInput {
    pub event_type_id: String,
    pub payload_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EventBusRegisterEventTypeOutput {
    #[serde(rename = "ok")]
    Ok { event_type_id: String },
}

// ── Subscribe ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBusSubscribeInput {
    pub event_type_id: String,
    pub listener_id: String,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EventBusSubscribeOutput {
    #[serde(rename = "ok")]
    Ok {
        event_type_id: String,
        listener_id: String,
    },
}

// ── Unsubscribe ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBusUnsubscribeInput {
    pub event_type_id: String,
    pub listener_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EventBusUnsubscribeOutput {
    #[serde(rename = "ok")]
    Ok {
        event_type_id: String,
        listener_id: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Dispatch ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBusDispatchInput {
    pub event_type_id: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EventBusDispatchOutput {
    #[serde(rename = "ok")]
    Ok {
        event_type_id: String,
        listener_count: u64,
    },
}

// ── GetHistory ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBusGetHistoryInput {
    pub event_type_id: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum EventBusGetHistoryOutput {
    #[serde(rename = "ok")]
    Ok { events: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct EventBusHandler;

impl EventBusHandler {
    pub async fn register_event_type(
        &self,
        input: EventBusRegisterEventTypeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EventBusRegisterEventTypeOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "event_type",
                &input.event_type_id,
                json!({
                    "event_type_id": input.event_type_id,
                    "payload_schema": input.payload_schema,
                    "registered_at": now,
                }),
            )
            .await?;
        Ok(EventBusRegisterEventTypeOutput::Ok {
            event_type_id: input.event_type_id,
        })
    }

    pub async fn subscribe(
        &self,
        input: EventBusSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EventBusSubscribeOutput> {
        let key = format!("{}:{}", input.event_type_id, input.listener_id);
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "listener",
                &key,
                json!({
                    "event_type_id": input.event_type_id,
                    "listener_id": input.listener_id,
                    "priority": input.priority,
                    "subscribed_at": now,
                }),
            )
            .await?;
        Ok(EventBusSubscribeOutput::Ok {
            event_type_id: input.event_type_id,
            listener_id: input.listener_id,
        })
    }

    pub async fn unsubscribe(
        &self,
        input: EventBusUnsubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EventBusUnsubscribeOutput> {
        let key = format!("{}:{}", input.event_type_id, input.listener_id);
        let existing = storage.get("listener", &key).await?;

        match existing {
            None => Ok(EventBusUnsubscribeOutput::NotFound {
                message: format!(
                    "listener '{}' not found for event type '{}'",
                    input.listener_id, input.event_type_id
                ),
            }),
            Some(_) => {
                storage.del("listener", &key).await?;
                Ok(EventBusUnsubscribeOutput::Ok {
                    event_type_id: input.event_type_id,
                    listener_id: input.listener_id,
                })
            }
        }
    }

    pub async fn dispatch(
        &self,
        input: EventBusDispatchInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EventBusDispatchOutput> {
        // Find all listeners for this event type
        let criteria = json!({ "event_type_id": input.event_type_id });
        let listeners = storage.find("listener", Some(&criteria)).await?;
        let listener_count = listeners.len() as u64;

        // Record the event in history
        let event_id = format!("evt_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "event_history",
                &event_id,
                json!({
                    "event_id": event_id,
                    "event_type_id": input.event_type_id,
                    "payload": input.payload,
                    "listener_count": listener_count,
                    "dispatched_at": now,
                }),
            )
            .await?;

        Ok(EventBusDispatchOutput::Ok {
            event_type_id: input.event_type_id,
            listener_count,
        })
    }

    pub async fn get_history(
        &self,
        input: EventBusGetHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<EventBusGetHistoryOutput> {
        let criteria = json!({ "event_type_id": input.event_type_id });
        let all_events = storage
            .find("event_history", Some(&criteria))
            .await?;

        // Filter events since the given timestamp
        let filtered: Vec<&serde_json::Value> = all_events
            .iter()
            .filter(|e| {
                let dispatched_at = e["dispatched_at"].as_str().unwrap_or("");
                dispatched_at >= input.since.as_str()
            })
            .collect();

        let events = serde_json::to_string(&filtered)?;
        Ok(EventBusGetHistoryOutput::Ok { events })
    }
}
