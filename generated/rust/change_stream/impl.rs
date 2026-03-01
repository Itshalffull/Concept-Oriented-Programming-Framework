// Change Stream -- append-only event log with subscription-based consumption
// Provides ordered event streaming with consumer acknowledgment and replay support.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ChangeStreamHandler;
use serde_json::json;

pub struct ChangeStreamHandlerImpl;

#[async_trait]
impl ChangeStreamHandler for ChangeStreamHandlerImpl {
    async fn append(
        &self,
        input: ChangeStreamAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamAppendOutput, Box<dyn std::error::Error>> {
        let event_type = &input.r#type;

        // Validate event type is not empty
        if event_type.is_empty() {
            return Ok(ChangeStreamAppendOutput::InvalidType {
                message: "Event type must not be empty".to_string(),
            });
        }

        // Get and increment the global offset counter
        let counter = storage.get("stream_meta", "offset_counter").await?;
        let next_offset = match counter {
            Some(val) => val["value"].as_i64().unwrap_or(0) + 1,
            None => 1,
        };
        storage.put("stream_meta", "offset_counter", json!({ "value": next_offset })).await?;

        let event_id = format!("evt-{}", next_offset);

        // Store the event
        storage.put("event", &event_id, json!({
            "event_id": event_id,
            "type": event_type,
            "before": input.before,
            "after": input.after,
            "source": input.source,
            "offset": next_offset,
        })).await?;

        Ok(ChangeStreamAppendOutput::Ok {
            offset: next_offset,
            event_id,
        })
    }

    async fn subscribe(
        &self,
        input: ChangeStreamSubscribeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamSubscribeOutput, Box<dyn std::error::Error>> {
        let from_offset = input.from_offset.unwrap_or(0);

        // Generate a subscription ID
        let counter = storage.get("stream_meta", "sub_counter").await?;
        let next_sub = match counter {
            Some(val) => val["value"].as_i64().unwrap_or(0) + 1,
            None => 1,
        };
        storage.put("stream_meta", "sub_counter", json!({ "value": next_sub })).await?;

        let subscription_id = format!("sub-{}", next_sub);

        storage.put("subscription", &subscription_id, json!({
            "subscription_id": subscription_id,
            "from_offset": from_offset,
            "current_offset": from_offset,
        })).await?;

        Ok(ChangeStreamSubscribeOutput::Ok { subscription_id })
    }

    async fn read(
        &self,
        input: ChangeStreamReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamReadOutput, Box<dyn std::error::Error>> {
        let sub = storage.get("subscription", &input.subscription_id).await?;
        let sub = match sub {
            Some(s) => s,
            None => return Ok(ChangeStreamReadOutput::NotFound {
                message: format!("Subscription '{}' not found", input.subscription_id),
            }),
        };

        let current_offset = sub["current_offset"].as_i64().unwrap_or(0);
        let max_offset = storage.get("stream_meta", "offset_counter").await?
            .map(|v| v["value"].as_i64().unwrap_or(0))
            .unwrap_or(0);

        if current_offset >= max_offset {
            return Ok(ChangeStreamReadOutput::EndOfStream);
        }

        let mut events = Vec::new();
        let mut offset = current_offset + 1;
        let limit = input.max_count.min(100);

        while offset <= max_offset && (events.len() as i64) < limit {
            let event_id = format!("evt-{}", offset);
            if let Some(evt) = storage.get("event", &event_id).await? {
                events.push(evt.to_string());
            }
            offset += 1;
        }

        // Update subscription cursor
        storage.put("subscription", &input.subscription_id, json!({
            "subscription_id": input.subscription_id,
            "from_offset": sub["from_offset"],
            "current_offset": offset - 1,
        })).await?;

        Ok(ChangeStreamReadOutput::Ok { events })
    }

    async fn acknowledge(
        &self,
        input: ChangeStreamAcknowledgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamAcknowledgeOutput, Box<dyn std::error::Error>> {
        let consumer_key = format!("ack-{}", input.consumer);
        let existing = storage.get("consumer_ack", &consumer_key).await?;

        if existing.is_none() {
            // First acknowledgment for this consumer
        }

        storage.put("consumer_ack", &consumer_key, json!({
            "consumer": input.consumer,
            "acknowledged_offset": input.offset,
        })).await?;

        Ok(ChangeStreamAcknowledgeOutput::Ok)
    }

    async fn replay(
        &self,
        input: ChangeStreamReplayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ChangeStreamReplayOutput, Box<dyn std::error::Error>> {
        let max_offset = storage.get("stream_meta", "offset_counter").await?
            .map(|v| v["value"].as_i64().unwrap_or(0))
            .unwrap_or(0);

        let to = input.to.unwrap_or(max_offset);

        if input.from < 1 || input.from > to {
            return Ok(ChangeStreamReplayOutput::InvalidRange {
                message: format!("Invalid range: from={} to={}", input.from, to),
            });
        }

        let mut events = Vec::new();
        for offset in input.from..=to {
            let event_id = format!("evt-{}", offset);
            if let Some(evt) = storage.get("event", &event_id).await? {
                events.push(evt.to_string());
            }
        }

        Ok(ChangeStreamReplayOutput::Ok { events })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_append_success() {
        let storage = InMemoryStorage::new();
        let handler = ChangeStreamHandlerImpl;
        let result = handler.append(
            ChangeStreamAppendInput {
                r#type: "update".to_string(),
                before: None,
                after: None,
                source: "test-source".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChangeStreamAppendOutput::Ok { offset, event_id } => {
                assert_eq!(offset, 1);
                assert_eq!(event_id, "evt-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_append_invalid_type() {
        let storage = InMemoryStorage::new();
        let handler = ChangeStreamHandlerImpl;
        let result = handler.append(
            ChangeStreamAppendInput {
                r#type: "".to_string(),
                before: None,
                after: None,
                source: "test-source".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChangeStreamAppendOutput::InvalidType { message } => {
                assert!(message.contains("not be empty"));
            },
            _ => panic!("Expected InvalidType variant"),
        }
    }

    #[tokio::test]
    async fn test_subscribe_success() {
        let storage = InMemoryStorage::new();
        let handler = ChangeStreamHandlerImpl;
        let result = handler.subscribe(
            ChangeStreamSubscribeInput { from_offset: Some(0) },
            &storage,
        ).await.unwrap();
        match result {
            ChangeStreamSubscribeOutput::Ok { subscription_id } => {
                assert_eq!(subscription_id, "sub-1");
            },
        }
    }

    #[tokio::test]
    async fn test_read_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ChangeStreamHandlerImpl;
        let result = handler.read(
            ChangeStreamReadInput {
                subscription_id: "nonexistent".to_string(),
                max_count: 10,
            },
            &storage,
        ).await.unwrap();
        match result {
            ChangeStreamReadOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_acknowledge_success() {
        let storage = InMemoryStorage::new();
        let handler = ChangeStreamHandlerImpl;
        let result = handler.acknowledge(
            ChangeStreamAcknowledgeInput {
                consumer: "consumer-1".to_string(),
                offset: 5,
            },
            &storage,
        ).await.unwrap();
        match result {
            ChangeStreamAcknowledgeOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_replay_invalid_range() {
        let storage = InMemoryStorage::new();
        let handler = ChangeStreamHandlerImpl;
        let result = handler.replay(
            ChangeStreamReplayInput {
                from: 0,
                to: Some(5),
            },
            &storage,
        ).await.unwrap();
        match result {
            ChangeStreamReplayOutput::InvalidRange { .. } => {},
            _ => panic!("Expected InvalidRange variant"),
        }
    }

    #[tokio::test]
    async fn test_replay_success_after_append() {
        let storage = InMemoryStorage::new();
        let handler = ChangeStreamHandlerImpl;

        // Append an event first
        handler.append(
            ChangeStreamAppendInput {
                r#type: "create".to_string(),
                before: None,
                after: None,
                source: "test".to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.replay(
            ChangeStreamReplayInput {
                from: 1,
                to: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            ChangeStreamReplayOutput::Ok { events } => {
                assert_eq!(events.len(), 1);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
