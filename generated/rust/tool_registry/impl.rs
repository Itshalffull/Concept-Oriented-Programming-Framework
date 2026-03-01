// ToolRegistry concept implementation
// Registers, versions, and authorizes tool schemas for LLM function/tool calling.
// Status lifecycle: active -> deprecated -> disabled

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ToolRegistryHandler;
use serde_json::json;

pub struct ToolRegistryHandlerImpl;

fn generate_tool_id() -> String {
    format!("tool-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl ToolRegistryHandler for ToolRegistryHandlerImpl {
    async fn register(
        &self,
        input: ToolRegistryRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryRegisterOutput, Box<dyn std::error::Error>> {
        if !input.schema.is_object() {
            return Ok(ToolRegistryRegisterOutput::InvalidSchema {
                message: "Schema must be a JSON object".to_string(),
            });
        }

        // Check if a tool with this name already exists to increment version
        let existing = storage.find("tool_registry", Some(&json!({
            "name": input.name,
        }))).await?;

        let (tool_id, version) = if let Some(prev) = existing.first() {
            let id = prev["tool_id"].as_str().unwrap_or("").to_string();
            let v = prev["version"].as_i64().unwrap_or(0) + 1;
            (id, v)
        } else {
            (generate_tool_id(), 1)
        };

        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("tool_registry", &tool_id, json!({
            "tool_id": tool_id,
            "name": input.name,
            "version": version,
            "description": input.description,
            "schema": input.schema,
            "status": "active",
            "allowed_models": ["*"],
            "allowed_processes": ["*"],
            "authorizations": [],
            "registered_at": timestamp,
        })).await?;

        Ok(ToolRegistryRegisterOutput::Ok {
            tool_id,
            version,
        })
    }

    async fn deprecate(
        &self,
        input: ToolRegistryDeprecateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryDeprecateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("tool_registry", &input.tool_id).await?;
        match existing {
            None => Ok(ToolRegistryDeprecateOutput::NotFound { tool_id: input.tool_id }),
            Some(record) => {
                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("deprecated"));
                    obj.insert("deprecated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }
                storage.put("tool_registry", &input.tool_id, updated).await?;
                Ok(ToolRegistryDeprecateOutput::Ok { tool_id: input.tool_id })
            }
        }
    }

    async fn disable(
        &self,
        input: ToolRegistryDisableInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryDisableOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("tool_registry", &input.tool_id).await?;
        match existing {
            None => Ok(ToolRegistryDisableOutput::NotFound { tool_id: input.tool_id }),
            Some(record) => {
                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("disabled"));
                    obj.insert("disabled_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }
                storage.put("tool_registry", &input.tool_id, updated).await?;
                Ok(ToolRegistryDisableOutput::Ok { tool_id: input.tool_id })
            }
        }
    }

    async fn authorize(
        &self,
        input: ToolRegistryAuthorizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryAuthorizeOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("tool_registry", &input.tool_id).await?;
        match existing {
            None => Ok(ToolRegistryAuthorizeOutput::NotFound { tool_id: input.tool_id }),
            Some(record) => {
                let mut auths = record["authorizations"].as_array().cloned().unwrap_or_default();
                auths.push(json!({
                    "model": input.model,
                    "process_ref": input.process_ref,
                    "authorized_at": chrono::Utc::now().to_rfc3339(),
                }));

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("authorizations".to_string(), json!(auths));
                }
                storage.put("tool_registry", &input.tool_id, updated).await?;
                Ok(ToolRegistryAuthorizeOutput::Ok { tool_id: input.tool_id })
            }
        }
    }

    async fn check_access(
        &self,
        input: ToolRegistryCheckAccessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryCheckAccessOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("tool_registry", &input.tool_id).await?;
        match existing {
            None => Ok(ToolRegistryCheckAccessOutput::NotFound { tool_id: input.tool_id }),
            Some(record) => {
                let status = record["status"].as_str().unwrap_or("unknown");

                if status == "disabled" {
                    return Ok(ToolRegistryCheckAccessOutput::Denied {
                        tool_id: input.tool_id,
                        reason: "Tool is disabled".to_string(),
                    });
                }

                // Check wildcard access or specific authorization
                let allowed_models = record["allowed_models"].as_array();
                let allowed_processes = record["allowed_processes"].as_array();

                let model_ok = allowed_models.map_or(false, |m| {
                    m.iter().any(|v| v.as_str() == Some("*") || v.as_str() == Some(&input.model))
                });
                let process_ok = allowed_processes.map_or(false, |p| {
                    p.iter().any(|v| v.as_str() == Some("*") || v.as_str() == Some(&input.process_ref))
                });

                if !model_ok || !process_ok {
                    // Check specific authorizations
                    let auths = record["authorizations"].as_array();
                    let has_auth = auths.map_or(false, |a| {
                        a.iter().any(|auth| {
                            auth["model"].as_str() == Some(&input.model)
                                && auth["process_ref"].as_str() == Some(&input.process_ref)
                        })
                    });

                    if !has_auth {
                        return Ok(ToolRegistryCheckAccessOutput::Denied {
                            tool_id: input.tool_id,
                            reason: "Model/process not authorized".to_string(),
                        });
                    }
                }

                let schema = record["schema"].clone();
                Ok(ToolRegistryCheckAccessOutput::Allowed {
                    tool_id: input.tool_id,
                    schema,
                })
            }
        }
    }

    async fn list_active(
        &self,
        input: ToolRegistryListActiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryListActiveOutput, Box<dyn std::error::Error>> {
        let all = storage.find("tool_registry", None).await?;

        let active: Vec<serde_json::Value> = all.into_iter()
            .filter(|t| {
                let status = t["status"].as_str().unwrap_or("");
                if status != "active" {
                    return false;
                }
                // Check if authorized for this process
                let allowed = t["allowed_processes"].as_array();
                let has_wildcard = allowed.map_or(false, |p| {
                    p.iter().any(|v| v.as_str() == Some("*") || v.as_str() == Some(&input.process_ref))
                });
                let has_auth = t["authorizations"].as_array().map_or(false, |a| {
                    a.iter().any(|auth| auth["process_ref"].as_str() == Some(&input.process_ref))
                });
                has_wildcard || has_auth
            })
            .collect();

        Ok(ToolRegistryListActiveOutput::Ok { tools: active })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_tool() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;
        let result = handler.register(
            ToolRegistryRegisterInput {
                name: "web_search".to_string(),
                description: "Search the web".to_string(),
                schema: json!({ "type": "object", "properties": { "query": { "type": "string" } } }),
            },
            &storage,
        ).await.unwrap();
        match result {
            ToolRegistryRegisterOutput::Ok { tool_id, version } => {
                assert!(tool_id.starts_with("tool-"));
                assert_eq!(version, 1);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_invalid_schema() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;
        let result = handler.register(
            ToolRegistryRegisterInput {
                name: "bad".to_string(),
                description: "Bad tool".to_string(),
                schema: json!("not an object"),
            },
            &storage,
        ).await.unwrap();
        match result {
            ToolRegistryRegisterOutput::InvalidSchema { .. } => {}
            _ => panic!("Expected InvalidSchema variant"),
        }
    }

    #[tokio::test]
    async fn test_deprecate_tool() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let reg = handler.register(
            ToolRegistryRegisterInput {
                name: "old_tool".to_string(),
                description: "Legacy".to_string(),
                schema: json!({ "type": "object" }),
            },
            &storage,
        ).await.unwrap();
        let tool_id = match reg {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.deprecate(
            ToolRegistryDeprecateInput { tool_id: tool_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ToolRegistryDeprecateOutput::Ok { .. } => {}
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_access_allowed_wildcard() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let reg = handler.register(
            ToolRegistryRegisterInput {
                name: "calc".to_string(),
                description: "Calculator".to_string(),
                schema: json!({ "type": "object", "properties": { "expr": { "type": "string" } } }),
            },
            &storage,
        ).await.unwrap();
        let tool_id = match reg {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.check_access(
            ToolRegistryCheckAccessInput {
                tool_id: tool_id.clone(),
                model: "any-model".to_string(),
                process_ref: "any-process".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ToolRegistryCheckAccessOutput::Allowed { schema, .. } => {
                assert!(schema.is_object());
            }
            _ => panic!("Expected Allowed variant"),
        }
    }

    #[tokio::test]
    async fn test_check_access_denied_disabled() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let reg = handler.register(
            ToolRegistryRegisterInput {
                name: "risky".to_string(),
                description: "Risky tool".to_string(),
                schema: json!({ "type": "object" }),
            },
            &storage,
        ).await.unwrap();
        let tool_id = match reg {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        handler.disable(
            ToolRegistryDisableInput { tool_id: tool_id.clone() },
            &storage,
        ).await.unwrap();

        let result = handler.check_access(
            ToolRegistryCheckAccessInput {
                tool_id: tool_id.clone(),
                model: "m".to_string(),
                process_ref: "p".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ToolRegistryCheckAccessOutput::Denied { reason, .. } => {
                assert!(reason.contains("disabled"));
            }
            _ => panic!("Expected Denied variant"),
        }
    }
}
