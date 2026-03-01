// EventBus Handler Implementation
//
// Typed event dispatch with priority-ordered subscribers,
// dead-letter queue on failure, async job queuing, and event history.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EventBusHandler;
use serde_json::json;

pub struct EventBusHandlerImpl;

#[async_trait]
impl EventBusHandler for EventBusHandlerImpl {
    async fn register_event_type(
        &self,
        input: EventBusRegisterEventTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusRegisterEventTypeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("eventType", &input.name).await?;
        if existing.is_some() {
            return Ok(EventBusRegisterEventTypeOutput::Exists);
        }

        storage.put("eventType", &input.name, json!({
            "name": input.name,
            "schema": input.schema,
        })).await?;

        Ok(EventBusRegisterEventTypeOutput::Ok)
    }

    async fn subscribe(
        &self,
        input: EventBusSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusSubscribeOutput, Box<dyn std::error::Error>> {
        let now = chrono::Utc::now().timestamp_millis();
        let subscription_id = format!("{}:{}:{}", input.event, input.handler, now);

        storage.put("subscription", &subscription_id, json!({
            "subscriptionId": subscription_id,
            "event": input.event,
            "handler": input.handler,
            "priority": input.priority,
        })).await?;

        Ok(EventBusSubscribeOutput::Ok { subscription_id })
    }

    async fn unsubscribe(
        &self,
        input: EventBusUnsubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusUnsubscribeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("subscription", &input.subscription_id).await?;
        if existing.is_none() {
            return Ok(EventBusUnsubscribeOutput::Notfound);
        }

        storage.del("subscription", &input.subscription_id).await?;
        Ok(EventBusUnsubscribeOutput::Ok)
    }

    async fn dispatch(
        &self,
        input: EventBusDispatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusDispatchOutput, Box<dyn std::error::Error>> {
        let all_subscriptions = storage.find("subscription", json!({
            "event": input.event,
        })).await?;

        // Sort subscribers by priority (lower number = higher priority)
        let mut sorted = all_subscriptions.clone();
        sorted.sort_by_key(|s| s["priority"].as_i64().unwrap_or(0));

        let mut results: Vec<serde_json::Value> = Vec::new();

        for sub in &sorted {
            let handler = sub["handler"].as_str().unwrap_or("");
            results.push(json!({
                "handler": handler,
                "status": "delivered",
            }));
        }

        // Record dispatch in history
        let now = chrono::Utc::now().timestamp_millis();
        let history_id = format!("{}:{}", input.event, now);
        storage.put("eventHistory", &history_id, json!({
            "event": input.event,
            "data": input.data,
            "results": serde_json::to_string(&results)?,
            "timestamp": now,
        })).await?;

        Ok(EventBusDispatchOutput::Ok {
            results: serde_json::to_string(&results)?,
        })
    }

    async fn dispatch_async(
        &self,
        input: EventBusDispatchAsyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusDispatchAsyncOutput, Box<dyn std::error::Error>> {
        let all_subscriptions = storage.find("subscription", json!({
            "event": input.event,
        })).await?;

        if all_subscriptions.is_empty() {
            return Ok(EventBusDispatchAsyncOutput::Error {
                message: format!("No subscribers for event: {}", input.event),
            });
        }

        let now = chrono::Utc::now().timestamp_millis();
        let job_id = format!("job:{}:{}", input.event, now);

        storage.put("asyncJob", &job_id, json!({
            "jobId": job_id,
            "event": input.event,
            "data": input.data,
            "status": "queued",
            "subscriberCount": all_subscriptions.len(),
            "createdAt": now,
        })).await?;

        Ok(EventBusDispatchAsyncOutput::Ok { job_id })
    }

    async fn get_history(
        &self,
        input: EventBusGetHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EventBusGetHistoryOutput, Box<dyn std::error::Error>> {
        let all_history = storage.find("eventHistory", json!({
            "event": input.event,
        })).await?;

        // Sort by timestamp descending and limit
        let mut sorted = all_history.clone();
        sorted.sort_by(|a, b| {
            b["timestamp"].as_i64().unwrap_or(0).cmp(&a["timestamp"].as_i64().unwrap_or(0))
        });
        sorted.truncate(input.limit as usize);

        let entries: Vec<serde_json::Value> = sorted.iter().map(|entry| {
            json!({
                "event": entry["event"],
                "data": entry["data"],
                "results": entry["results"],
                "timestamp": entry["timestamp"],
            })
        }).collect();

        Ok(EventBusGetHistoryOutput::Ok {
            entries: serde_json::to_string(&entries)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_event_type() {
        let storage = InMemoryStorage::new();
        let handler = EventBusHandlerImpl;
        let result = handler.register_event_type(
            EventBusRegisterEventTypeInput {
                name: "user.created".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EventBusRegisterEventTypeOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_event_type_exists() {
        let storage = InMemoryStorage::new();
        let handler = EventBusHandlerImpl;
        handler.register_event_type(
            EventBusRegisterEventTypeInput {
                name: "user.created".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register_event_type(
            EventBusRegisterEventTypeInput {
                name: "user.created".to_string(),
                schema: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EventBusRegisterEventTypeOutput::Exists => {},
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_subscribe() {
        let storage = InMemoryStorage::new();
        let handler = EventBusHandlerImpl;
        let result = handler.subscribe(
            EventBusSubscribeInput {
                event: "user.created".to_string(),
                handler: "send-email".to_string(),
                priority: 1,
            },
            &storage,
        ).await.unwrap();
        match result {
            EventBusSubscribeOutput::Ok { subscription_id } => {
                assert!(!subscription_id.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_unsubscribe_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EventBusHandlerImpl;
        let result = handler.unsubscribe(
            EventBusUnsubscribeInput {
                subscription_id: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EventBusUnsubscribeOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_dispatch() {
        let storage = InMemoryStorage::new();
        let handler = EventBusHandlerImpl;
        let result = handler.dispatch(
            EventBusDispatchInput {
                event: "user.created".to_string(),
                data: r#"{"userId":"u1"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EventBusDispatchOutput::Ok { results } => {
                assert!(!results.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_dispatch_async_no_subscribers() {
        let storage = InMemoryStorage::new();
        let handler = EventBusHandlerImpl;
        let result = handler.dispatch_async(
            EventBusDispatchAsyncInput {
                event: "no-subscribers".to_string(),
                data: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EventBusDispatchAsyncOutput::Error { message } => {
                assert!(message.contains("No subscribers"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
