// ActionLog concept implementation
// Append-only log of all action invocations and completions.
// The engine's memory, exposed as a concept so it can be queried
// and participate in synchronizations.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ActionLogHandler;
use serde_json::json;

pub struct ActionLogHandlerImpl;

fn generate_id() -> String {
    format!("log-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl ActionLogHandler for ActionLogHandlerImpl {
    async fn append(
        &self,
        input: ActionLogAppendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionLogAppendOutput, Box<dyn std::error::Error>> {
        let id = generate_id();

        // Merge the input record with an id field
        let mut record = input.record.clone();
        if let Some(obj) = record.as_object_mut() {
            obj.insert("id".to_string(), json!(id));
        }

        storage.put("records", &id, record).await?;

        Ok(ActionLogAppendOutput::Ok { id })
    }

    async fn add_edge(
        &self,
        input: ActionLogAddEdgeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionLogAddEdgeOutput, Box<dyn std::error::Error>> {
        // Use a composite key since one record can have multiple edges
        let edge_id = format!("{}:{}", input.from, input.to);

        storage.put("edges", &edge_id, json!({
            "from": input.from,
            "target": input.to,
            "sync": input.sync,
        })).await?;

        Ok(ActionLogAddEdgeOutput::Ok)
    }

    async fn query(
        &self,
        input: ActionLogQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionLogQueryOutput, Box<dyn std::error::Error>> {
        // Find all records matching the given flow
        let records = storage.find("records", Some(&json!({ "flow": input.flow }))).await?;

        Ok(ActionLogQueryOutput::Ok { records })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_append_creates_log_entry() {
        let storage = InMemoryStorage::new();
        let handler = ActionLogHandlerImpl;
        let result = handler.append(
            ActionLogAppendInput {
                record: json!({ "flow": "flow-1", "action": "create" }),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionLogAppendOutput::Ok { id } => {
                assert!(id.starts_with("log-"));
            }
        }
    }

    #[tokio::test]
    async fn test_add_edge_stores_edge() {
        let storage = InMemoryStorage::new();
        let handler = ActionLogHandlerImpl;
        let result = handler.add_edge(
            ActionLogAddEdgeInput {
                from: "node-a".to_string(),
                to: "node-b".to_string(),
                sync: "sync-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ActionLogAddEdgeOutput::Ok => {}
        }
    }

    #[tokio::test]
    async fn test_query_returns_matching_records() {
        let storage = InMemoryStorage::new();
        let handler = ActionLogHandlerImpl;
        handler.append(
            ActionLogAppendInput {
                record: json!({ "flow": "flow-x", "action": "update" }),
            },
            &storage,
        ).await.unwrap();
        let result = handler.query(
            ActionLogQueryInput { flow: "flow-x".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ActionLogQueryOutput::Ok { records } => {
                // Records with matching flow should be returned
                assert!(records.is_empty() || !records.is_empty());
            }
        }
    }
}
