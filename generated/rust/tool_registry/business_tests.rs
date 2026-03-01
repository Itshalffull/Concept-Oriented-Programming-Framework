// Business logic tests for ToolRegistry concept.
// Validates versioning, access control, deprecation/disable semantics,
// authorization mechanics, and listing behavior.

#[cfg(test)]
mod tests {
    use super::super::handler::ToolRegistryHandler;
    use super::super::r#impl::ToolRegistryHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_register_then_re_register_increments_version() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let r1 = handler.register(ToolRegistryRegisterInput {
            name: "calculator".to_string(),
            description: "Basic calculator v1".to_string(),
            schema: json!({"type": "object", "properties": {"expr": {"type": "string"}}}),
        }, &storage).await.unwrap();
        match r1 {
            ToolRegistryRegisterOutput::Ok { version, .. } => assert_eq!(version, 1),
            _ => panic!("Expected Ok"),
        }

        let r2 = handler.register(ToolRegistryRegisterInput {
            name: "calculator".to_string(),
            description: "Calculator v2 with graphing".to_string(),
            schema: json!({"type": "object", "properties": {"expr": {"type": "string"}, "graph": {"type": "boolean"}}}),
        }, &storage).await.unwrap();
        match r2 {
            ToolRegistryRegisterOutput::Ok { version, .. } => assert_eq!(version, 2),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_deprecated_tool_still_accessible() {
        // Deprecated tools should still be accessible (not disabled)
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let reg = handler.register(ToolRegistryRegisterInput {
            name: "old_search".to_string(),
            description: "Legacy search".to_string(),
            schema: json!({"type": "object"}),
        }, &storage).await.unwrap();
        let tool_id = match reg {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        handler.deprecate(ToolRegistryDeprecateInput {
            tool_id: tool_id.clone(),
        }, &storage).await.unwrap();

        let access = handler.check_access(ToolRegistryCheckAccessInput {
            tool_id: tool_id.clone(),
            model: "any".to_string(),
            process_ref: "any".to_string(),
        }, &storage).await.unwrap();
        match access {
            ToolRegistryCheckAccessOutput::Allowed { .. } => {}
            _ => panic!("Expected Allowed for deprecated (not disabled) tool"),
        }
    }

    #[tokio::test]
    async fn test_disabled_tool_denies_access() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let reg = handler.register(ToolRegistryRegisterInput {
            name: "dangerous".to_string(),
            description: "Dangerous tool".to_string(),
            schema: json!({"type": "object"}),
        }, &storage).await.unwrap();
        let tool_id = match reg {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        handler.disable(ToolRegistryDisableInput {
            tool_id: tool_id.clone(),
        }, &storage).await.unwrap();

        let result = handler.check_access(ToolRegistryCheckAccessInput {
            tool_id: tool_id.clone(),
            model: "any-model".to_string(),
            process_ref: "any-process".to_string(),
        }, &storage).await.unwrap();
        match result {
            ToolRegistryCheckAccessOutput::Denied { reason, .. } => {
                assert!(reason.contains("disabled"));
            }
            _ => panic!("Expected Denied"),
        }
    }

    #[tokio::test]
    async fn test_specific_authorization_grants_access() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        // Register tool -- default allows wildcard, but let's check authorization path
        let reg = handler.register(ToolRegistryRegisterInput {
            name: "special_tool".to_string(),
            description: "Restricted tool".to_string(),
            schema: json!({"type": "object", "properties": {"input": {"type": "string"}}}),
        }, &storage).await.unwrap();
        let tool_id = match reg {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        // Add specific authorization
        let auth = handler.authorize(ToolRegistryAuthorizeInput {
            tool_id: tool_id.clone(),
            model: "claude-3".to_string(),
            process_ref: "onboarding".to_string(),
        }, &storage).await.unwrap();
        match auth {
            ToolRegistryAuthorizeOutput::Ok { .. } => {}
            _ => panic!("Expected Ok"),
        }

        // Check access for authorized model/process
        let access = handler.check_access(ToolRegistryCheckAccessInput {
            tool_id: tool_id.clone(),
            model: "claude-3".to_string(),
            process_ref: "onboarding".to_string(),
        }, &storage).await.unwrap();
        match access {
            ToolRegistryCheckAccessOutput::Allowed { schema, .. } => {
                assert!(schema.is_object());
            }
            _ => panic!("Expected Allowed"),
        }
    }

    #[tokio::test]
    async fn test_list_active_excludes_disabled_and_deprecated() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        // Register 3 tools
        let r1 = handler.register(ToolRegistryRegisterInput {
            name: "active_tool".to_string(),
            description: "Active".to_string(),
            schema: json!({"type": "object"}),
        }, &storage).await.unwrap();

        let r2 = handler.register(ToolRegistryRegisterInput {
            name: "deprecated_tool".to_string(),
            description: "Will be deprecated".to_string(),
            schema: json!({"type": "object"}),
        }, &storage).await.unwrap();
        let tool_id_2 = match r2 {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        let r3 = handler.register(ToolRegistryRegisterInput {
            name: "disabled_tool".to_string(),
            description: "Will be disabled".to_string(),
            schema: json!({"type": "object"}),
        }, &storage).await.unwrap();
        let tool_id_3 = match r3 {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        handler.deprecate(ToolRegistryDeprecateInput { tool_id: tool_id_2 }, &storage).await.unwrap();
        handler.disable(ToolRegistryDisableInput { tool_id: tool_id_3 }, &storage).await.unwrap();

        let list = handler.list_active(ToolRegistryListActiveInput {
            process_ref: "any-process".to_string(),
        }, &storage).await.unwrap();
        match list {
            ToolRegistryListActiveOutput::Ok { tools } => {
                assert_eq!(tools.len(), 1);
                assert_eq!(tools[0]["name"], "active_tool");
            }
        }
    }

    #[tokio::test]
    async fn test_invalid_schema_rejected() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        // Array is not a valid schema (must be object)
        let result = handler.register(ToolRegistryRegisterInput {
            name: "bad_schema".to_string(),
            description: "Bad".to_string(),
            schema: json!([1, 2, 3]),
        }, &storage).await.unwrap();
        match result {
            ToolRegistryRegisterOutput::InvalidSchema { message } => {
                assert!(message.contains("object"));
            }
            _ => panic!("Expected InvalidSchema"),
        }

        // String is not a valid schema
        let result2 = handler.register(ToolRegistryRegisterInput {
            name: "bad_schema_2".to_string(),
            description: "Bad".to_string(),
            schema: json!("not an object"),
        }, &storage).await.unwrap();
        match result2 {
            ToolRegistryRegisterOutput::InvalidSchema { .. } => {}
            _ => panic!("Expected InvalidSchema"),
        }
    }

    #[tokio::test]
    async fn test_deprecate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let result = handler.deprecate(ToolRegistryDeprecateInput {
            tool_id: "tool-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            ToolRegistryDeprecateOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_disable_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let result = handler.disable(ToolRegistryDisableInput {
            tool_id: "tool-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            ToolRegistryDisableOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_authorize_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let result = handler.authorize(ToolRegistryAuthorizeInput {
            tool_id: "tool-ghost".to_string(),
            model: "m".to_string(),
            process_ref: "p".to_string(),
        }, &storage).await.unwrap();
        match result {
            ToolRegistryAuthorizeOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_check_access_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ToolRegistryHandlerImpl;

        let result = handler.check_access(ToolRegistryCheckAccessInput {
            tool_id: "tool-missing".to_string(),
            model: "m".to_string(),
            process_ref: "p".to_string(),
        }, &storage).await.unwrap();
        match result {
            ToolRegistryCheckAccessOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }
}
