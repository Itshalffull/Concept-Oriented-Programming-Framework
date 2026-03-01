// generated: tool_registry/conformance.rs
// Conformance tests for ToolRegistry concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::ToolRegistryHandler;
    use super::super::r#impl::ToolRegistryHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> ToolRegistryHandlerImpl {
        ToolRegistryHandlerImpl
    }

    #[tokio::test]
    async fn tool_registry_invariant_register_check_access() {
        // Invariant: newly registered tool is accessible with wildcard auth
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let reg = handler.register(
            ToolRegistryRegisterInput {
                name: "web_search".to_string(),
                description: "Search the web".to_string(),
                schema: json!({ "type": "object", "properties": { "q": { "type": "string" } } }),
            },
            &storage,
        ).await.unwrap();
        let tool_id = match reg {
            ToolRegistryRegisterOutput::Ok { tool_id, .. } => tool_id,
            _ => panic!("Expected Ok"),
        };

        let access = handler.check_access(
            ToolRegistryCheckAccessInput {
                tool_id,
                model: "claude".to_string(),
                process_ref: "onboard".to_string(),
            },
            &storage,
        ).await.unwrap();
        match access {
            ToolRegistryCheckAccessOutput::Allowed { schema, .. } => {
                assert!(schema["properties"]["q"].is_object());
            }
            _ => panic!("Expected Allowed"),
        }
    }

    #[tokio::test]
    async fn tool_registry_invariant_disable_denies_access() {
        // Invariant: disabled tool denies all access
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let reg = handler.register(
            ToolRegistryRegisterInput {
                name: "dangerous".to_string(),
                description: "Dangerous tool".to_string(),
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

        let access = handler.check_access(
            ToolRegistryCheckAccessInput {
                tool_id,
                model: "any".to_string(),
                process_ref: "any".to_string(),
            },
            &storage,
        ).await.unwrap();
        match access {
            ToolRegistryCheckAccessOutput::Denied { .. } => {}
            _ => panic!("Expected Denied"),
        }
    }

    #[tokio::test]
    async fn tool_registry_invariant_version_increments() {
        // Invariant: re-registering same name increments version
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let r1 = handler.register(
            ToolRegistryRegisterInput {
                name: "calc".to_string(),
                description: "v1".to_string(),
                schema: json!({ "type": "object" }),
            },
            &storage,
        ).await.unwrap();
        let v1 = match r1 {
            ToolRegistryRegisterOutput::Ok { version, .. } => version,
            _ => panic!("Expected Ok"),
        };

        let r2 = handler.register(
            ToolRegistryRegisterInput {
                name: "calc".to_string(),
                description: "v2".to_string(),
                schema: json!({ "type": "object", "v": 2 }),
            },
            &storage,
        ).await.unwrap();
        let v2 = match r2 {
            ToolRegistryRegisterOutput::Ok { version, .. } => version,
            _ => panic!("Expected Ok"),
        };

        assert_eq!(v1, 1);
        assert_eq!(v2, 2);
    }
}
