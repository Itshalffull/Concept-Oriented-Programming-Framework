// AsyncApiTarget concept implementation
// Generate AsyncAPI 3.0 specifications from concept projections and sync specs.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AsyncApiTargetHandler;
use serde_json::json;

pub struct AsyncApiTargetHandlerImpl;

#[async_trait]
impl AsyncApiTargetHandler for AsyncApiTargetHandlerImpl {
    async fn generate(
        &self,
        input: AsyncApiTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AsyncApiTargetGenerateOutput, Box<dyn std::error::Error>> {
        let parsed_config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));
        let transport = parsed_config["transport"].as_str().unwrap_or("websocket");

        let mut channel_entries = Vec::new();
        let mut operation_entries = Vec::new();

        for proj in &input.projections {
            channel_entries.push(format!(
                "    {}Channel:\n      address: /{}\n      messages:\n        {}Message:\n          payload:\n            type: object",
                proj, proj, proj
            ));
            operation_entries.push(format!(
                "    {}Publish:\n      action: send\n      channel:\n        $ref: '#/channels/{}Channel'",
                proj, proj
            ));
        }

        for sync in &input.sync_specs {
            channel_entries.push(format!(
                "    {}SyncChannel:\n      address: /{}/sync\n      messages:\n        {}SyncMessage:\n          payload:\n            type: object",
                sync, sync, sync
            ));
            operation_entries.push(format!(
                "    {}Subscribe:\n      action: receive\n      channel:\n        $ref: '#/channels/{}SyncChannel'",
                sync, sync
            ));
        }

        let protocol_binding = match transport {
            "kafka" => "kafka",
            "amqp" => "amqp",
            _ => "ws",
        };

        let mut content_parts = vec![
            "asyncapi: 3.0.0".to_string(),
            "info:".to_string(),
            "  title: Generated AsyncAPI Spec".to_string(),
            "  version: 1.0.0".to_string(),
            format!("  description: Generated from {} projection(s) and {} sync spec(s)",
                input.projections.len(), input.sync_specs.len()),
            "channels:".to_string(),
        ];
        content_parts.extend(channel_entries);
        content_parts.push("operations:".to_string());
        content_parts.extend(operation_entries);
        content_parts.push(format!("# Transport: {}", transport));
        content_parts.push(format!("# Protocol bindings: {}", protocol_binding));

        let content = content_parts.join("\n");

        let spec_id = format!("asyncapi-{}", chrono::Utc::now().timestamp_millis());

        storage.put("spec", &spec_id, json!({
            "specId": spec_id,
            "version": "3.0.0",
            "channels": input.projections.len() + input.sync_specs.len(),
            "operations": input.projections.len() + input.sync_specs.len(),
            "content": content,
            "projections": serde_json::to_string(&input.projections)?,
            "syncSpecs": serde_json::to_string(&input.sync_specs)?,
            "config": input.config,
            "generatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(AsyncApiTargetGenerateOutput::Ok {
            spec: spec_id,
            content,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_creates_asyncapi_spec() {
        let storage = InMemoryStorage::new();
        let handler = AsyncApiTargetHandlerImpl;
        let result = handler.generate(
            AsyncApiTargetGenerateInput {
                projections: vec!["article".to_string(), "comment".to_string()],
                sync_specs: vec!["article-comment-sync".to_string()],
                config: r#"{"transport":"websocket"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AsyncApiTargetGenerateOutput::Ok { spec, content } => {
                assert!(spec.starts_with("asyncapi-"));
                assert!(content.contains("asyncapi: 3.0.0"));
                assert!(content.contains("articleChannel"));
                assert!(content.contains("commentChannel"));
                assert!(content.contains("article-comment-syncSyncChannel"));
            }
        }
    }

    #[tokio::test]
    async fn test_generate_with_kafka_transport() {
        let storage = InMemoryStorage::new();
        let handler = AsyncApiTargetHandlerImpl;
        let result = handler.generate(
            AsyncApiTargetGenerateInput {
                projections: vec!["user".to_string()],
                sync_specs: vec![],
                config: r#"{"transport":"kafka"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AsyncApiTargetGenerateOutput::Ok { content, .. } => {
                assert!(content.contains("kafka"));
            }
        }
    }

    #[tokio::test]
    async fn test_generate_empty_projections() {
        let storage = InMemoryStorage::new();
        let handler = AsyncApiTargetHandlerImpl;
        let result = handler.generate(
            AsyncApiTargetGenerateInput {
                projections: vec![],
                sync_specs: vec![],
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AsyncApiTargetGenerateOutput::Ok { content, .. } => {
                assert!(content.contains("asyncapi: 3.0.0"));
            }
        }
    }
}
