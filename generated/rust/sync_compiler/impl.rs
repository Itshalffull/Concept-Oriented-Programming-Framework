// SyncCompiler concept implementation
// Compiles parsed synchronization ASTs into executable registrations.
// Validates when/then clauses, checks variable bindings, and produces
// CompiledSync objects per Section 6.5 of the architecture doc.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncCompilerHandler;
use serde_json::json;

pub struct SyncCompilerHandlerImpl;

#[async_trait]
impl SyncCompilerHandler for SyncCompilerHandlerImpl {
    async fn compile(
        &self,
        input: SyncCompilerCompileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncCompilerCompileOutput, Box<dyn std::error::Error>> {
        let sync_ref = &input.sync;
        let ast = &input.ast;

        // Validate the AST has a name
        let name = match ast.get("name").and_then(|v| v.as_str()) {
            Some(n) => n.to_string(),
            None => {
                return Ok(SyncCompilerCompileOutput::Error {
                    message: "Invalid sync AST: missing name".to_string(),
                });
            }
        };

        // Validate when clause exists and is non-empty
        let when = ast.get("when").and_then(|v| v.as_array());
        match when {
            Some(w) if w.is_empty() => {
                return Ok(SyncCompilerCompileOutput::Error {
                    message: format!("Sync \"{}\": when clause is required", name),
                });
            }
            None => {
                return Ok(SyncCompilerCompileOutput::Error {
                    message: format!("Sync \"{}\": when clause is required", name),
                });
            }
            _ => {}
        }

        // Validate then clause exists and is non-empty
        let then = ast.get("then").and_then(|v| v.as_array());
        match then {
            Some(t) if t.is_empty() => {
                return Ok(SyncCompilerCompileOutput::Error {
                    message: format!("Sync \"{}\": then clause is required", name),
                });
            }
            None => {
                return Ok(SyncCompilerCompileOutput::Error {
                    message: format!("Sync \"{}\": then clause is required", name),
                });
            }
            _ => {}
        }

        // Collect bound variables from when-clause patterns
        let mut bound_vars = std::collections::HashSet::new();

        if let Some(when_patterns) = when {
            for pattern in when_patterns {
                // Variables from inputFields
                if let Some(fields) = pattern.get("inputFields").and_then(|v| v.as_array()) {
                    for field in fields {
                        if let Some(m) = field.get("match") {
                            if m.get("type").and_then(|v| v.as_str()) == Some("variable") {
                                if let Some(var_name) = m.get("name").and_then(|v| v.as_str()) {
                                    bound_vars.insert(var_name.to_string());
                                }
                            }
                        }
                    }
                }
                // Variables from outputFields
                if let Some(fields) = pattern.get("outputFields").and_then(|v| v.as_array()) {
                    for field in fields {
                        if let Some(m) = field.get("match") {
                            if m.get("type").and_then(|v| v.as_str()) == Some("variable") {
                                if let Some(var_name) = m.get("name").and_then(|v| v.as_str()) {
                                    bound_vars.insert(var_name.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        // Variables from where-clause
        if let Some(where_entries) = ast.get("where").and_then(|v| v.as_array()) {
            for entry in where_entries {
                if entry.get("type").and_then(|v| v.as_str()) == Some("bind") {
                    if let Some(as_name) = entry.get("as").and_then(|v| v.as_str()) {
                        bound_vars.insert(as_name.to_string());
                    }
                }
                if entry.get("type").and_then(|v| v.as_str()) == Some("query") {
                    if let Some(bindings) = entry.get("bindings").and_then(|v| v.as_array()) {
                        for b in bindings {
                            if let Some(var) = b.get("variable").and_then(|v| v.as_str()) {
                                bound_vars.insert(var.to_string());
                            }
                        }
                    }
                }
            }
        }

        // Check then-clause references only bound variables
        let mut unbound_in_then = Vec::new();
        if let Some(then_actions) = then {
            for action in then_actions {
                if let Some(fields) = action.get("fields").and_then(|v| v.as_array()) {
                    for field in fields {
                        if let Some(val) = field.get("value") {
                            if val.get("type").and_then(|v| v.as_str()) == Some("variable") {
                                if let Some(var_name) = val.get("name").and_then(|v| v.as_str()) {
                                    if !bound_vars.contains(var_name) {
                                        unbound_in_then.push(var_name.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if !unbound_in_then.is_empty() {
            return Ok(SyncCompilerCompileOutput::Error {
                message: format!(
                    "Sync \"{}\": then-clause references unbound variables: {}",
                    name,
                    unbound_in_then.join(", ")
                ),
            });
        }

        // Build the compiled sync object
        let compiled = json!({
            "name": &name,
            "annotations": ast.get("annotations").cloned().unwrap_or(json!({})),
            "when": ast.get("when").cloned().unwrap_or(json!([])),
            "where": ast.get("where").cloned().unwrap_or(json!([])),
            "then": ast.get("then").cloned().unwrap_or(json!([])),
        });

        // Store the compiled sync
        storage.put("compiled", sync_ref, json!({
            "syncRef": sync_ref,
            "compiled": &compiled,
        })).await?;

        Ok(SyncCompilerCompileOutput::Ok { compiled })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_compile_valid_ast() {
        let storage = InMemoryStorage::new();
        let handler = SyncCompilerHandlerImpl;
        let result = handler.compile(
            SyncCompilerCompileInput {
                sync: "test-sync".to_string(),
                ast: json!({
                    "name": "UserFollowSync",
                    "when": [{"concept": "User", "action": "follow", "inputFields": [], "outputFields": []}],
                    "then": [{"concept": "Follow", "action": "create", "fields": []}],
                }),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncCompilerCompileOutput::Ok { compiled } => {
                assert_eq!(compiled["name"].as_str().unwrap(), "UserFollowSync");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_compile_missing_name() {
        let storage = InMemoryStorage::new();
        let handler = SyncCompilerHandlerImpl;
        let result = handler.compile(
            SyncCompilerCompileInput {
                sync: "test-sync".to_string(),
                ast: json!({}),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncCompilerCompileOutput::Error { message } => {
                assert!(message.contains("missing name"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_compile_missing_when() {
        let storage = InMemoryStorage::new();
        let handler = SyncCompilerHandlerImpl;
        let result = handler.compile(
            SyncCompilerCompileInput {
                sync: "test-sync".to_string(),
                ast: json!({"name": "TestSync"}),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncCompilerCompileOutput::Error { message } => {
                assert!(message.contains("when clause is required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_compile_empty_then() {
        let storage = InMemoryStorage::new();
        let handler = SyncCompilerHandlerImpl;
        let result = handler.compile(
            SyncCompilerCompileInput {
                sync: "test-sync".to_string(),
                ast: json!({
                    "name": "TestSync",
                    "when": [{"concept": "A"}],
                    "then": [],
                }),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncCompilerCompileOutput::Error { message } => {
                assert!(message.contains("then clause is required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
