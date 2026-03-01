// TransportAdapterScaffoldGen Handler Implementation
//
// Generates ConceptTransport adapter implementations for various
// communication protocols: HTTP, WebSocket, Worker, in-process.
// See architecture doc Section 9: Transport adapters.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TransportAdapterScaffoldGenHandler;
use serde_json::json;

pub struct TransportAdapterScaffoldGenHandlerImpl;

/// Convert a PascalCase or camelCase name to kebab-case.
fn to_kebab(name: &str) -> String {
    let mut result = String::new();
    for (i, ch) in name.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(ch.to_lowercase().next().unwrap_or(ch));
    }
    result.replace(' ', "-").replace('_', "-")
}

/// Build the transport adapter source code for a given protocol.
fn build_transport_adapter(name: &str, protocol: &str) -> String {
    let mut lines = vec![
        format!("// {name} -- {protocol} transport adapter"),
        "//".to_string(),
        format!("// ConceptTransport implementation over {protocol}."),
        String::new(),
    ];

    match protocol {
        "http" => {
            lines.extend([
                format!("pub struct {name} {{"),
                "    base_url: String,".to_string(),
                "}".to_string(),
                String::new(),
                format!("impl {name} {{"),
                "    pub fn new(base_url: &str) -> Self {".to_string(),
                format!("        {name} {{ base_url: base_url.to_string() }}"),
                "    }".to_string(),
                String::new(),
                "    pub async fn invoke(&self, concept: &str, action: &str, input: serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {".to_string(),
                "        let url = format!(\"{}/concepts/{}/{}\", self.base_url, concept, action);".to_string(),
                "        let client = reqwest::Client::new();".to_string(),
                "        let response = client.post(&url)".to_string(),
                "            .json(&input)".to_string(),
                "            .send()".to_string(),
                "            .await?;".to_string(),
                "        let result = response.json().await?;".to_string(),
                "        Ok(result)".to_string(),
                "    }".to_string(),
                String::new(),
                "    pub async fn health(&self) -> Result<bool, Box<dyn std::error::Error>> {".to_string(),
                "        let url = format!(\"{}/health\", self.base_url);".to_string(),
                "        let response = reqwest::get(&url).await?;".to_string(),
                "        Ok(response.status().is_success())".to_string(),
                "    }".to_string(),
                "}".to_string(),
            ]);
        }
        "websocket" => {
            lines.extend([
                format!("pub struct {name} {{"),
                "    url: String,".to_string(),
                "}".to_string(),
                String::new(),
                format!("impl {name} {{"),
                "    pub fn new(url: &str) -> Self {".to_string(),
                format!("        {name} {{ url: url.to_string() }}"),
                "    }".to_string(),
                String::new(),
                "    pub async fn invoke(&self, concept: &str, action: &str, input: serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {".to_string(),
                "        // WebSocket transport: connect, send JSON frame, await response".to_string(),
                "        let msg = serde_json::json!({ \"concept\": concept, \"action\": action, \"input\": input });".to_string(),
                "        // In a full implementation, this would use a WS client".to_string(),
                "        Ok(msg)".to_string(),
                "    }".to_string(),
                "}".to_string(),
            ]);
        }
        "worker" => {
            lines.extend([
                format!("pub struct {name} {{"),
                "    // Worker transport uses message-passing".to_string(),
                "}".to_string(),
                String::new(),
                format!("impl {name} {{"),
                "    pub fn new() -> Self {".to_string(),
                format!("        {name} {{}}"),
                "    }".to_string(),
                String::new(),
                "    pub async fn invoke(&self, concept: &str, action: &str, input: serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {".to_string(),
                "        let msg = serde_json::json!({ \"concept\": concept, \"action\": action, \"input\": input });".to_string(),
                "        Ok(msg)".to_string(),
                "    }".to_string(),
                "}".to_string(),
            ]);
        }
        "in-process" => {
            lines.extend([
                "use std::collections::HashMap;".to_string(),
                String::new(),
                format!("pub struct {name} {{"),
                "    handlers: HashMap<String, Box<dyn Fn(serde_json::Value) -> serde_json::Value>>,".to_string(),
                "}".to_string(),
                String::new(),
                format!("impl {name} {{"),
                "    pub fn new() -> Self {".to_string(),
                format!("        {name} {{ handlers: HashMap::new() }}"),
                "    }".to_string(),
                String::new(),
                "    pub async fn invoke(&self, concept: &str, action: &str, input: serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {".to_string(),
                "        let key = format!(\"{}:{}\", concept, action);".to_string(),
                "        match self.handlers.get(&key) {".to_string(),
                "            Some(handler) => Ok(handler(input)),".to_string(),
                "            None => Err(format!(\"No handler for {}\", key).into()),".to_string(),
                "        }".to_string(),
                "    }".to_string(),
                "}".to_string(),
            ]);
        }
        _ => {
            lines.extend([
                format!("pub struct {name};"),
                String::new(),
                format!("impl {name} {{"),
                format!("    pub async fn invoke(&self, _concept: &str, _action: &str, _input: serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {{"),
                format!("        Err(\"{protocol} transport not implemented\".into())"),
                "    }".to_string(),
                "}".to_string(),
            ]);
        }
    }

    lines.push(String::new());
    lines.join("\n")
}

#[async_trait]
impl TransportAdapterScaffoldGenHandler for TransportAdapterScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: TransportAdapterScaffoldGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<TransportAdapterScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        let name = &input.name;
        let protocol = &input.protocol;

        if name.is_empty() {
            return Ok(TransportAdapterScaffoldGenGenerateOutput::Error {
                message: "Adapter name is required".to_string(),
            });
        }

        let kebab = to_kebab(name);
        let adapter_code = build_transport_adapter(name, protocol);

        let files = vec![
            json!({
                "path": format!("{}-transport.rs", kebab),
                "content": adapter_code,
            }),
        ];

        Ok(TransportAdapterScaffoldGenGenerateOutput::Ok {
            files,
            files_generated: 1,
        })
    }

    async fn preview(
        &self,
        input: TransportAdapterScaffoldGenPreviewInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<TransportAdapterScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        let name = &input.name;
        let protocol = &input.protocol;

        if name.is_empty() {
            return Ok(TransportAdapterScaffoldGenPreviewOutput::Error {
                message: "Adapter name is required".to_string(),
            });
        }

        let kebab = to_kebab(name);
        let adapter_code = build_transport_adapter(name, protocol);

        let files = vec![
            json!({
                "path": format!("{}-transport.rs", kebab),
                "content": adapter_code,
            }),
        ];

        Ok(TransportAdapterScaffoldGenPreviewOutput::Ok {
            files,
            would_write: 1,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: TransportAdapterScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<TransportAdapterScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(TransportAdapterScaffoldGenRegisterOutput::Ok {
            name: "TransportAdapterScaffoldGen".to_string(),
            input_kind: "TransportConfig".to_string(),
            output_kind: "TransportAdapter".to_string(),
            capabilities: vec![
                "http".to_string(),
                "websocket".to_string(),
                "worker".to_string(),
                "in-process".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_http() {
        let storage = InMemoryStorage::new();
        let handler = TransportAdapterScaffoldGenHandlerImpl;
        let result = handler.generate(
            TransportAdapterScaffoldGenGenerateInput {
                name: "MyHttpTransport".to_string(),
                protocol: "http".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportAdapterScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 1);
                let content = files[0]["content"].as_str().unwrap();
                assert!(content.contains("MyHttpTransport"));
                assert!(content.contains("base_url"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_websocket() {
        let storage = InMemoryStorage::new();
        let handler = TransportAdapterScaffoldGenHandlerImpl;
        let result = handler.generate(
            TransportAdapterScaffoldGenGenerateInput {
                name: "WsTransport".to_string(),
                protocol: "websocket".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportAdapterScaffoldGenGenerateOutput::Ok { files, .. } => {
                let content = files[0]["content"].as_str().unwrap();
                assert!(content.contains("WsTransport"));
                assert!(content.contains("WebSocket"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = TransportAdapterScaffoldGenHandlerImpl;
        let result = handler.generate(
            TransportAdapterScaffoldGenGenerateInput {
                name: "".to_string(),
                protocol: "http".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportAdapterScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = TransportAdapterScaffoldGenHandlerImpl;
        let result = handler.preview(
            TransportAdapterScaffoldGenPreviewInput {
                name: "TestTransport".to_string(),
                protocol: "worker".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportAdapterScaffoldGenPreviewOutput::Ok { would_write, would_skip, .. } => {
                assert_eq!(would_write, 1);
                assert_eq!(would_skip, 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = TransportAdapterScaffoldGenHandlerImpl;
        let result = handler.preview(
            TransportAdapterScaffoldGenPreviewInput {
                name: "".to_string(),
                protocol: "http".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TransportAdapterScaffoldGenPreviewOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = TransportAdapterScaffoldGenHandlerImpl;
        let result = handler.register(
            TransportAdapterScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            TransportAdapterScaffoldGenRegisterOutput::Ok { name, capabilities, .. } => {
                assert_eq!(name, "TransportAdapterScaffoldGen");
                assert!(capabilities.contains(&"http".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
