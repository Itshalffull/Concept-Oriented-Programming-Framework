// MCP (Model Context Protocol) target implementation
// Generates MCP server code from concept projections. Produces
// tool definitions, resource URIs, and prompt templates for
// AI agent integration.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::McpTargetHandler;
use serde_json::json;

pub struct McpTargetHandlerImpl;

#[async_trait]
impl McpTargetHandler for McpTargetHandlerImpl {
    async fn generate(
        &self,
        input: McpTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<McpTargetGenerateOutput, Box<dyn std::error::Error>> {
        let config: serde_json::Value = serde_json::from_str(&input.config)
            .unwrap_or_else(|_| json!({}));

        let server_name = config.get("serverName")
            .and_then(|v| v.as_str())
            .unwrap_or("clef-mcp-server");
        let transport = config.get("transport")
            .and_then(|v| v.as_str())
            .unwrap_or("stdio");
        let version = config.get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("1.0.0");
        let tool_limit = config.get("toolLimit")
            .and_then(|v| v.as_i64())
            .unwrap_or(50);

        let concept_name = input.projection
            .replace("-projection", "")
            .replace('-', "");

        let tools = vec![
            format!("{}_create", concept_name),
            format!("{}_get", concept_name),
            format!("{}_list", concept_name),
            format!("{}_update", concept_name),
            format!("{}_delete", concept_name),
        ];

        if tools.len() as i64 > tool_limit {
            return Ok(McpTargetGenerateOutput::TooManyTools {
                count: tools.len() as i64,
                limit: tool_limit,
            });
        }

        let files = vec![
            format!("src/mcp/{}-server.ts", concept_name),
            format!("src/mcp/{}-tools.ts", concept_name),
        ];

        let tool_id = format!("mcp-{}-{}", concept_name, chrono::Utc::now().timestamp_millis());
        storage.put("tool", &tool_id, json!({
            "toolId": tool_id,
            "serverName": server_name,
            "transport": transport,
            "version": version,
            "concept": concept_name,
            "mcpType": "tool",
            "tools": serde_json::to_string(&tools)?,
            "files": serde_json::to_string(&files)?,
            "projection": input.projection,
            "config": input.config,
            "generatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(McpTargetGenerateOutput::Ok { tools, files })
    }

    async fn validate(
        &self,
        input: McpTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<McpTargetValidateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("tool", &input.tool).await?;
        if existing.is_none() {
            return Ok(McpTargetValidateOutput::Ok { tool: input.tool });
        }

        let record = existing.unwrap();
        let tools_str = record.get("tools")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        let tools: Vec<String> = serde_json::from_str(tools_str)?;

        // Check that all tools have descriptions in the server file
        let server_file = record.get("serverFile")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        for t in &tools {
            let has_description = server_file.contains(&format!("name: \"{}\"", t));
            if !has_description && !server_file.is_empty() {
                return Ok(McpTargetValidateOutput::MissingDescription {
                    tool: input.tool,
                    tool_name: t.clone(),
                });
            }
        }

        Ok(McpTargetValidateOutput::Ok { tool: input.tool })
    }

    async fn list_tools(
        &self,
        input: McpTargetListToolsInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<McpTargetListToolsOutput, Box<dyn std::error::Error>> {
        let concept_lower = input.concept.to_lowercase();

        let tools = vec![
            format!("{}_create", concept_lower),
            format!("{}_get", concept_lower),
            format!("{}_list", concept_lower),
            format!("{}_update", concept_lower),
            format!("{}_delete", concept_lower),
        ];

        let resources = vec![
            format!("{}://list", concept_lower),
            format!("{}://get/{{id}}", concept_lower),
        ];

        let templates = vec![
            format!("{}-summary", concept_lower),
            format!("{}-detail", concept_lower),
        ];

        Ok(McpTargetListToolsOutput::Ok {
            tools,
            resources,
            templates,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_success() {
        let storage = InMemoryStorage::new();
        let handler = McpTargetHandlerImpl;
        let result = handler.generate(
            McpTargetGenerateInput {
                projection: "user-projection".into(),
                config: r#"{"serverName":"my-server","transport":"stdio"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            McpTargetGenerateOutput::Ok { tools, files } => {
                assert_eq!(tools.len(), 5);
                assert!(tools[0].contains("user"));
                assert!(!files.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_nonexistent_tool() {
        let storage = InMemoryStorage::new();
        let handler = McpTargetHandlerImpl;
        let result = handler.validate(
            McpTargetValidateInput { tool: "nonexistent".into() },
            &storage,
        ).await.unwrap();
        match result {
            McpTargetValidateOutput::Ok { tool } => assert_eq!(tool, "nonexistent"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_list_tools() {
        let storage = InMemoryStorage::new();
        let handler = McpTargetHandlerImpl;
        let result = handler.list_tools(
            McpTargetListToolsInput { concept: "Article".into() },
            &storage,
        ).await.unwrap();
        match result {
            McpTargetListToolsOutput::Ok { tools, resources, templates } => {
                assert_eq!(tools.len(), 5);
                assert!(tools.iter().any(|t| t.contains("article")));
                assert!(!resources.is_empty());
                assert!(!templates.is_empty());
            }
        }
    }
}
